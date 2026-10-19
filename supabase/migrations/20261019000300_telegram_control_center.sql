-- Telegram Control Center. Review before running. Do not apply from the app.
-- Tokens stay in the server environment. This file stores routes, links, and delivery history.
-- Existing telegram_link_codes and telegram_links are left in place.
-- Not applied yet. CREATE IF NOT EXISTS plus ALTER keeps a re-run from failing.

CREATE TABLE IF NOT EXISTS public.telegram_link_challenges (
  code_hash TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('owner', 'customer')),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  replaced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_link_challenges
  ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_link_challenges_one_open
  ON public.telegram_link_challenges (user_id, purpose)
  WHERE consumed_at IS NULL AND replaced_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_telegram_link_challenges_user
  ON public.telegram_link_challenges (user_id, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS public.telegram_account_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose TEXT NOT NULL CHECK (purpose IN ('owner', 'customer')),
  telegram_user_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (purpose, telegram_user_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_account_links_user
  ON public.telegram_account_links (user_id, purpose);

CREATE TABLE IF NOT EXISTS public.telegram_delivery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  bot_key TEXT NOT NULL CHECK (bot_key IN ('payments', 'players', 'errors', 'owner', 'support')),
  category TEXT NOT NULL,
  chat_id TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sending', 'accepted', 'failed', 'retry_pending', 'uncertain', 'unconfigured', 'duplicate', 'needs_investigation')),
  legacy_outcome TEXT CHECK (legacy_outcome IN ('not_used', 'attempt_started', 'accepted', 'uncertain', 'unavailable', 'skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  telegram_message_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_delivery_jobs_due
  ON public.telegram_delivery_jobs (status, next_attempt_at);

ALTER TABLE public.telegram_delivery_jobs
  ADD COLUMN IF NOT EXISTS legacy_outcome TEXT;

ALTER TABLE public.telegram_delivery_jobs DROP CONSTRAINT IF EXISTS telegram_delivery_jobs_status_check;
ALTER TABLE public.telegram_delivery_jobs
  ADD CONSTRAINT telegram_delivery_jobs_status_check
  CHECK (status IN ('queued', 'sending', 'accepted', 'failed', 'retry_pending', 'uncertain', 'unconfigured', 'duplicate', 'needs_investigation'));

ALTER TABLE public.telegram_delivery_jobs DROP CONSTRAINT IF EXISTS telegram_delivery_jobs_legacy_outcome_check;
ALTER TABLE public.telegram_delivery_jobs
  ADD CONSTRAINT telegram_delivery_jobs_legacy_outcome_check
  CHECK (legacy_outcome IS NULL OR legacy_outcome IN ('not_used', 'attempt_started', 'accepted', 'uncertain', 'unavailable', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_telegram_delivery_jobs_sending
  ON public.telegram_delivery_jobs (updated_at)
  WHERE status = 'sending';

CREATE TABLE IF NOT EXISTS public.telegram_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.telegram_delivery_jobs (id) ON DELETE CASCADE,
  outcome TEXT NOT NULL,
  http_status INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_delivery_attempts_job
  ON public.telegram_delivery_attempts (job_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.telegram_webhook_updates (
  bot_key TEXT NOT NULL,
  update_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'failed', 'exhausted', 'reviewed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  command_name TEXT,
  last_error TEXT,
  processed_at TIMESTAMPTZ,
  PRIMARY KEY (bot_key, update_id)
);

ALTER TABLE public.telegram_webhook_updates
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS command_name TEXT,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

ALTER TABLE public.telegram_webhook_updates DROP CONSTRAINT IF EXISTS telegram_webhook_updates_status_check;
ALTER TABLE public.telegram_webhook_updates
  ADD CONSTRAINT telegram_webhook_updates_status_check
  CHECK (status IN ('received', 'processed', 'failed', 'exhausted', 'reviewed'));

CREATE TABLE IF NOT EXISTS public.telegram_incidents (
  fingerprint TEXT PRIMARY KEY,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  title TEXT NOT NULL,
  seen_count INTEGER NOT NULL DEFAULT 1,
  last_sent_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_control_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_link_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_account_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_delivery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_webhook_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_control_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.telegram_link_challenges FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.telegram_account_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.telegram_delivery_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.telegram_delivery_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.telegram_webhook_updates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.telegram_incidents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.telegram_control_audit FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.telegram_link_challenges TO service_role;
GRANT ALL ON TABLE public.telegram_account_links TO service_role;
GRANT ALL ON TABLE public.telegram_delivery_jobs TO service_role;
GRANT ALL ON TABLE public.telegram_delivery_attempts TO service_role;
GRANT ALL ON TABLE public.telegram_webhook_updates TO service_role;
GRANT ALL ON TABLE public.telegram_incidents TO service_role;
GRANT ALL ON TABLE public.telegram_control_audit TO service_role;

-- One transaction: check the owner role before the code is consumed, then save the link.
-- A failed save rolls back and leaves the code unused.
CREATE OR REPLACE FUNCTION public.redeem_telegram_link(
  p_code_hash TEXT,
  p_telegram_user_id BIGINT,
  p_chat_id BIGINT,
  p_expected_purpose TEXT
)
RETURNS TABLE (user_id UUID, purpose TEXT, result TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_purpose TEXT;
  v_owner BOOLEAN;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF p_expected_purpose IS DISTINCT FROM 'owner' AND p_expected_purpose IS DISTINCT FROM 'customer' THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 'purpose'::TEXT;
    RETURN;
  END IF;
  IF p_code_hash IS NULL OR length(trim(p_code_hash)) < 32 OR p_telegram_user_id IS NULL OR p_chat_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 'missing'::TEXT;
    RETURN;
  END IF;

  SELECT c.user_id, c.purpose
  INTO v_user, v_purpose
  FROM public.telegram_link_challenges c
  WHERE c.code_hash = trim(p_code_hash)
    AND c.consumed_at IS NULL
    AND c.replaced_at IS NULL
    AND c.expires_at > now()
  FOR UPDATE;

  IF v_user IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 'missing'::TEXT;
    RETURN;
  END IF;
  IF v_purpose IS DISTINCT FROM p_expected_purpose THEN
    RETURN QUERY SELECT NULL::UUID, v_purpose, 'purpose'::TEXT;
    RETURN;
  END IF;
  IF p_expected_purpose = 'owner' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_user
        AND r.key = 'super_admin'
    )
    INTO v_owner;
    IF NOT COALESCE(v_owner, false) THEN
      RETURN QUERY SELECT v_user, v_purpose, 'not_owner'::TEXT;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.telegram_account_links (purpose, telegram_user_id, chat_id, user_id, revoked_at, linked_at)
  VALUES (v_purpose, p_telegram_user_id, p_chat_id, v_user, NULL, now())
  ON CONFLICT (purpose, telegram_user_id) DO UPDATE
    SET chat_id = EXCLUDED.chat_id,
        user_id = EXCLUDED.user_id,
        revoked_at = NULL,
        linked_at = now();

  UPDATE public.telegram_link_challenges
  SET consumed_at = now()
  WHERE code_hash = trim(p_code_hash)
    AND consumed_at IS NULL
    AND replaced_at IS NULL;

  RETURN QUERY SELECT v_user, v_purpose, 'linked'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_telegram_link(TEXT, BIGINT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_telegram_link(TEXT, BIGINT, BIGINT, TEXT) TO service_role;

DROP FUNCTION IF EXISTS public.consume_telegram_link_code(TEXT);

-- Full sums and counts for owner commands. A missing table returns null, which the app shows as unavailable.
CREATE OR REPLACE FUNCTION public.telegram_owner_totals(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposits JSONB := NULL;
  v_payouts JSONB := NULL;
  v_loads_pending BIGINT := NULL;
  v_loads_failed BIGINT := NULL;
  v_tickets BIGINT := NULL;
  v_signups BIGINT := NULL;
  v_players BIGINT := NULL;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end <= p_start THEN
    RAISE EXCEPTION 'invalid report window';
  END IF;

  IF to_regclass('public.deposit_bonus_ledger') IS NOT NULL THEN
    SELECT jsonb_build_object(
      'complete', true,
      'confirmed', COALESCE(SUM(final_credit) FILTER (WHERE wallet_credited), 0),
      'confirmed_count', COUNT(*) FILTER (WHERE wallet_credited),
      'pending', COALESCE(SUM(final_credit) FILTER (WHERE NOT wallet_credited), 0),
      'pending_count', COUNT(*) FILTER (WHERE NOT wallet_credited),
      'failed', 0,
      'failed_count', 0,
      'failed_known', false
    )
    INTO v_deposits
    FROM public.deposit_bonus_ledger
    WHERE created_at >= p_start AND created_at < p_end;
  END IF;

  IF to_regclass('public.paydora_payout_requests') IS NOT NULL THEN
    SELECT jsonb_build_object(
      'complete', true,
      'confirmed', COALESCE(SUM(amount) FILTER (WHERE lower(status) = 'paid'), 0),
      'confirmed_count', COUNT(*) FILTER (WHERE lower(status) = 'paid'),
      'pending', COALESCE(SUM(amount) FILTER (WHERE lower(status) IN ('requested', 'reserved', 'submitted', 'manual_review')), 0),
      'pending_count', COUNT(*) FILTER (WHERE lower(status) IN ('requested', 'reserved', 'submitted', 'manual_review')),
      'failed', COALESCE(SUM(amount) FILTER (WHERE lower(status) = 'failed'), 0),
      'failed_count', COUNT(*) FILTER (WHERE lower(status) = 'failed'),
      'failed_known', true
    )
    INTO v_payouts
    FROM public.paydora_payout_requests
    WHERE created_at >= p_start AND created_at < p_end;
  END IF;

  IF to_regclass('public.game_load_requests') IS NOT NULL THEN
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending'),
      COUNT(*) FILTER (WHERE status = 'failed')
    INTO v_loads_pending, v_loads_failed
    FROM public.game_load_requests;
  END IF;

  IF to_regclass('public.support_tickets') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_tickets
    FROM public.support_tickets
    WHERE status IN ('open', 'pending', 'in_progress');
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_players FROM public.profiles;
    SELECT COUNT(*) INTO v_signups
    FROM public.profiles
    WHERE created_at >= p_start AND created_at < p_end;
  END IF;

  RETURN jsonb_build_object(
    'deposits', v_deposits,
    'payouts', v_payouts,
    'loads_pending', v_loads_pending,
    'loads_failed', v_loads_failed,
    'tickets_open', v_tickets,
    'signups', v_signups,
    'players', v_players
  );
END;
$$;

REVOKE ALL ON FUNCTION public.telegram_owner_totals(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_owner_totals(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
