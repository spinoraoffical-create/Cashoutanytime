-- Spinora multi-account + freeplay abuse protection
-- Run in Supabase SQL Editor AFTER schema.sql / profiles exist.
--
-- Policy:
--   • 3+ accounts on same device → block new signup
--   • 3+ signups from same IP in 7 days → block new signup
--   • 2nd account on same device → signup allowed but freeplay blocked (spin + daily task cash)
--   • Phone uniqueness stays in app (profiles.phone)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE public.security_action AS ENUM (
    'signup',
    'login',
    'spin',
    'task_claim',
    'deposit',
    'withdraw'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ip_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ip_address INET NOT NULL,
  action public.security_action NOT NULL,
  device_id TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_logs_ip_created ON public.ip_logs (ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ip_logs_user_created ON public.ip_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ip_logs_signup_ip ON public.ip_logs (ip_address, created_at DESC)
  WHERE action = 'signup';

CREATE TABLE IF NOT EXISTS public.device_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (device_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_device_map_device ON public.device_map (device_id);
CREATE INDEX IF NOT EXISTS idx_device_map_user ON public.device_map (user_id);

CREATE TABLE IF NOT EXISTS public.fraud_scores (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  risk_score SMALLINT NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocked BOOLEAN NOT NULL DEFAULT false,
  rewards_blocked BOOLEAN NOT NULL DEFAULT false,
  manual_review BOOLEAN NOT NULL DEFAULT false,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_scores_rewards_blocked
  ON public.fraud_scores (rewards_blocked) WHERE rewards_blocked = true;

CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket_key TEXT PRIMARY KEY,
  action public.security_action NOT NULL,
  attempt_count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.parse_client_ip(p_ip TEXT)
RETURNS INET
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v TEXT;
BEGIN
  v := trim(split_part(COALESCE(p_ip, ''), ',', 1));
  IF v = '' THEN RETURN NULL; END IF;
  BEGIN
    RETURN v::inet;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket_key TEXT,
  p_action public.security_action,
  p_max_attempts INT,
  p_window_seconds INT,
  p_block_seconds INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.rate_limits%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_row FROM public.rate_limits WHERE bucket_key = p_bucket_key FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (bucket_key, action, attempt_count, window_start)
    VALUES (p_bucket_key, p_action, 1, v_now);
    RETURN jsonb_build_object('allowed', true);
  END IF;

  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until > v_now THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'cooldown');
  END IF;

  IF v_row.window_start + make_interval(secs => p_window_seconds) < v_now THEN
    UPDATE public.rate_limits
    SET attempt_count = 1, window_start = v_now, blocked_until = NULL, updated_at = v_now
    WHERE bucket_key = p_bucket_key;
    RETURN jsonb_build_object('allowed', true);
  END IF;

  IF v_row.attempt_count >= p_max_attempts THEN
    IF p_block_seconds > 0 THEN
      UPDATE public.rate_limits
      SET blocked_until = v_now + make_interval(secs => p_block_seconds), updated_at = v_now
      WHERE bucket_key = p_bucket_key;
    END IF;
    RETURN jsonb_build_object('allowed', false, 'reason', 'rate_limit');
  END IF;

  UPDATE public.rate_limits
  SET attempt_count = attempt_count + 1, updated_at = v_now
  WHERE bucket_key = p_bucket_key;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- Count distinct accounts linked to a device
CREATE OR REPLACE FUNCTION public.device_account_count(p_device_id TEXT)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT user_id)::INT
  FROM public.device_map
  WHERE device_id = p_device_id AND length(device_id) >= 16;
$$;

-- Signups from IP in last N days
CREATE OR REPLACE FUNCTION public.ip_signup_count(p_ip INET, p_days INT DEFAULT 7)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT user_id)::INT
  FROM public.ip_logs
  WHERE action = 'signup'
    AND ip_address = p_ip
    AND user_id IS NOT NULL
    AND created_at > NOW() - make_interval(days => p_days);
$$;

-- Called from Next.js BEFORE sending OTP / creating auth user
CREATE OR REPLACE FUNCTION public.check_signup_allowed(
  p_ip TEXT,
  p_device_id TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip INET := public.parse_client_ip(p_ip);
  v_rl JSONB;
  v_device_users INT := 0;
  v_ip_signups INT := 0;
BEGIN
  IF v_ip IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_request');
  END IF;

  v_rl := public.check_rate_limit('signup:ip:' || host(v_ip), 'signup', 5, 86400, 3600);
  IF NOT (v_rl->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'too_many_attempts',
      'message', 'Too many signup attempts from this network. Try again later.'
    );
  END IF;

  IF p_device_id IS NOT NULL AND length(p_device_id) >= 16 THEN
    v_rl := public.check_rate_limit('signup:device:' || p_device_id, 'signup', 3, 86400, 7200);
    IF NOT (v_rl->>'allowed')::boolean THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'too_many_attempts',
        'message', 'Too many signup attempts from this device. Try again later.'
      );
    END IF;

    v_device_users := public.device_account_count(p_device_id);
    IF v_device_users >= 2 THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'multi_account_device',
        'message', 'Only one Spinora account is allowed per device. Sign in to your existing account.'
      );
    END IF;
  END IF;

  v_ip_signups := public.ip_signup_count(v_ip, 7);
  IF v_ip_signups >= 2 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'multi_account_ip',
      'message', 'Too many accounts were created from this network recently. Contact support if you need help.'
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'secondary_device_account', COALESCE(v_device_users, 0) >= 1
  );
END;
$$;

-- Link device + IP after successful signup (profile must exist)
CREATE OR REPLACE FUNCTION public.link_user_signup(
  p_user_id UUID,
  p_ip TEXT,
  p_device_id TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip INET := public.parse_client_ip(p_ip);
  v_device_users INT := 0;
  v_flags JSONB := '[]'::jsonb;
  v_rewards_blocked BOOLEAN := false;
  v_risk SMALLINT := 0;
BEGIN
  IF p_user_id IS NULL OR v_ip IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  INSERT INTO public.fraud_scores (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  IF EXISTS (
    SELECT 1 FROM public.ip_logs
    WHERE user_id = p_user_id AND action = 'signup'
  ) THEN
    IF p_device_id IS NOT NULL AND length(p_device_id) >= 16 THEN
      INSERT INTO public.device_map (device_id, user_id, user_agent, last_seen_at)
      VALUES (p_device_id, p_user_id, p_user_agent, NOW())
      ON CONFLICT (device_id, user_id)
      DO UPDATE SET last_seen_at = NOW(), user_agent = EXCLUDED.user_agent;
    END IF;
    RETURN jsonb_build_object('ok', true, 'already_linked', true);
  END IF;

  INSERT INTO public.ip_logs (user_id, ip_address, action, device_id, user_agent)
  VALUES (p_user_id, v_ip, 'signup', p_device_id, p_user_agent);

  IF p_device_id IS NOT NULL AND length(p_device_id) >= 16 THEN
    INSERT INTO public.device_map (device_id, user_id, user_agent, last_seen_at)
    VALUES (p_device_id, p_user_id, p_user_agent, NOW())
    ON CONFLICT (device_id, user_id)
    DO UPDATE SET last_seen_at = NOW(), user_agent = EXCLUDED.user_agent;

    v_device_users := public.device_account_count(p_device_id);
    IF v_device_users >= 2 THEN
      v_rewards_blocked := true;
      v_flags := v_flags || jsonb_build_array('shared_device_multi_account');
      v_risk := 60;
    ELSIF v_device_users >= 1 THEN
      -- Should not happen if check_signup_allowed ran first; still flag
      v_rewards_blocked := true;
      v_flags := v_flags || jsonb_build_array('secondary_device_account');
      v_risk := 45;
    END IF;
  END IF;

  IF public.ip_signup_count(v_ip, 7) >= 2 THEN
    v_rewards_blocked := true;
    v_flags := v_flags || jsonb_build_array('shared_ip_multi_account');
    v_risk := GREATEST(v_risk, 50);
  END IF;

  UPDATE public.fraud_scores
  SET
    risk_score = GREATEST(risk_score, v_risk),
    flags = fraud_scores.flags || v_flags,
    rewards_blocked = rewards_blocked OR v_rewards_blocked,
    manual_review = manual_review OR v_rewards_blocked,
    last_calculated_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  IF p_device_id IS NOT NULL AND public.device_account_count(p_device_id) >= 3 THEN
    UPDATE public.profiles SET is_suspended = true WHERE id = p_user_id;
    UPDATE public.fraud_scores
    SET blocked = true, risk_score = GREATEST(risk_score, 90)
    WHERE user_id = p_user_id;
    v_rewards_blocked := true;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'rewards_blocked', v_rewards_blocked,
    'risk_score', v_risk
  );
END;
$$;

-- Block daily spin + task cash claims for flagged / multi-account users
CREATE OR REPLACE FUNCTION public.assert_freeplay_allowed(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suspended BOOLEAN;
  v_blocked BOOLEAN;
  v_rewards_blocked BOOLEAN;
  v_risk SMALLINT;
BEGIN
  SELECT is_suspended INTO v_suspended FROM public.profiles WHERE id = p_user_id;
  IF COALESCE(v_suspended, false) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'suspended',
      'message', 'Your account is suspended. Contact support.'
    );
  END IF;

  SELECT blocked, rewards_blocked, risk_score
  INTO v_blocked, v_rewards_blocked, v_risk
  FROM public.fraud_scores
  WHERE user_id = p_user_id;

  IF COALESCE(v_blocked, false) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'blocked',
      'message', 'This account cannot claim free rewards. Contact support.'
    );
  END IF;

  IF COALESCE(v_rewards_blocked, false) OR COALESCE(v_risk, 0) >= 50 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rewards_blocked',
      'message', 'Free spin and daily task rewards are not available on this account. Make a deposit or contact support.'
    );
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- Auto-init fraud row when profile is created
CREATE OR REPLACE FUNCTION public.init_fraud_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.fraud_scores (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS init_fraud_score_trigger ON public.profiles;
CREATE TRIGGER init_fraud_score_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.init_fraud_score();

-- ---------------------------------------------------------------------------
-- RLS — users cannot write security data; admins can read
-- ---------------------------------------------------------------------------

ALTER TABLE public.ip_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own fraud score" ON public.fraud_scores;
CREATE POLICY "Users read own fraud score"
  ON public.fraud_scores FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read fraud_scores" ON public.fraud_scores;
CREATE POLICY "Admins read fraud_scores"
  ON public.fraud_scores FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins update fraud_scores" ON public.fraud_scores;
CREATE POLICY "Admins update fraud_scores"
  ON public.fraud_scores FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins read ip_logs" ON public.ip_logs;
CREATE POLICY "Admins read ip_logs"
  ON public.ip_logs FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins read device_map" ON public.device_map;
CREATE POLICY "Admins read device_map"
  ON public.device_map FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins read rate_limits" ON public.rate_limits;
CREATE POLICY "Admins read rate_limits"
  ON public.rate_limits FOR SELECT TO authenticated
  USING (public.is_admin());

GRANT EXECUTE ON FUNCTION public.check_signup_allowed TO service_role;
GRANT EXECUTE ON FUNCTION public.link_user_signup TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_freeplay_allowed TO service_role;
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO service_role;
