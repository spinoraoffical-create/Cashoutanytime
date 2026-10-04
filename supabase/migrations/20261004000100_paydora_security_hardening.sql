-- Paydora atomic/idempotent wallet credit, RPC lockdown, profile/role hardening.
-- Also paste into the Supabase SQL editor if migrations are not auto-applied.

-- ── Idempotent payment ledger ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paydora_processed_events (
  payment_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paydora_processed_events_user
  ON public.paydora_processed_events (user_id, created_at DESC);

ALTER TABLE public.paydora_processed_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.credit_paydora_deposit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_payment_id TEXT,
  p_order_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
  v_payment_id TEXT;
  v_balance NUMERIC;
BEGIN
  v_payment_id := nullif(trim(p_payment_id), '');
  IF p_user_id IS NULL OR v_payment_id IS NULL THEN
    RAISE EXCEPTION 'user_id and payment_id required';
  END IF;

  v_amount := round(p_amount::numeric, 2);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  INSERT INTO public.paydora_processed_events (payment_id, user_id, amount, direction, order_id)
  VALUES (v_payment_id, p_user_id, v_amount, 'credit', p_order_id);

  PERFORM set_config('app.wallet_update', 'true', true);

  UPDATE public.profiles
  SET wallet_balance = wallet_balance + v_amount
  WHERE id = p_user_id
  RETURNING wallet_balance INTO v_balance;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.wallet_transactions (
        user_id, amount, wallet_type, transaction_type, source, description, created_by
      ) VALUES (
        p_user_id, v_amount, 'current', 'credit', 'deposit',
        COALESCE(p_description, format('Paydora deposit %s', v_payment_id)),
        NULL
      );
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  IF to_regclass('public.deposit_requests') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.deposit_requests (
        user_id, game_name, payment_method, amount, proof_url, status, wallet_credited, admin_notes
      ) VALUES (
        p_user_id,
        'Paydora deposit',
        'cashapp',
        v_amount,
        format('paydora/%s', v_payment_id),
        'completed',
        true,
        COALESCE(p_order_id, 'Paid online')
      );
    EXCEPTION
      WHEN unique_violation THEN
        UPDATE public.deposit_requests
        SET status = 'completed', wallet_credited = true, amount = v_amount
        WHERE proof_url = format('paydora/%s', v_payment_id);
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  RETURN jsonb_build_object('credited', true, 'duplicate', false, 'new_balance', v_balance);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('credited', false, 'duplicate', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_paydora_deposit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_payment_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
  v_key TEXT;
  v_balance NUMERIC;
BEGIN
  v_key := 'refund:' || nullif(trim(p_payment_id), '');
  IF p_user_id IS NULL OR v_key = 'refund:' THEN
    RAISE EXCEPTION 'user_id and payment_id required';
  END IF;

  v_amount := round(p_amount::numeric, 2);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  INSERT INTO public.paydora_processed_events (payment_id, user_id, amount, direction, order_id)
  VALUES (v_key, p_user_id, v_amount, 'debit', p_payment_id);

  PERFORM set_config('app.wallet_update', 'true', true);

  UPDATE public.profiles
  SET wallet_balance = GREATEST(0, wallet_balance - v_amount)
  WHERE id = p_user_id
  RETURNING wallet_balance INTO v_balance;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
    INSERT INTO public.wallet_transactions (
      user_id, amount, wallet_type, transaction_type, source, description, created_by
    ) VALUES (
      p_user_id, v_amount, 'current', 'debit', 'deposit',
      format('Paydora refund $%s (%s)', v_amount, v_key),
      NULL
    );
  END IF;

  IF to_regclass('public.deposit_requests') IS NOT NULL THEN
    UPDATE public.deposit_requests
    SET status = 'rejected', admin_notes = 'Paydora refunded this deposit'
    WHERE proof_url = format('paydora/%s', p_payment_id);
  END IF;

  RETURN jsonb_build_object('reversed', true, 'duplicate', false, 'new_balance', v_balance);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('reversed', false, 'duplicate', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.debit_paydora_payout(
  p_user_id UUID,
  p_amount NUMERIC,
  p_payout_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
  v_key TEXT;
  v_balance NUMERIC;
BEGIN
  v_key := nullif(trim(p_payout_key), '');
  IF p_user_id IS NULL OR v_key IS NULL THEN
    RAISE EXCEPTION 'user_id and payout_key required';
  END IF;

  v_amount := round(p_amount::numeric, 2);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  INSERT INTO public.paydora_processed_events (payment_id, user_id, amount, direction)
  VALUES (v_key, p_user_id, v_amount, 'debit');

  PERFORM set_config('app.wallet_update', 'true', true);

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - v_amount
  WHERE id = p_user_id AND wallet_balance >= v_amount
  RETURNING wallet_balance INTO v_balance;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient funds' USING ERRCODE = 'P0001';
  END IF;

  IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
    INSERT INTO public.wallet_transactions (
      user_id, amount, wallet_type, transaction_type, source, description, created_by
    ) VALUES (
      p_user_id, v_amount, 'current', 'debit', 'withdrawal',
      format('Paydora payout $%s (%s)', v_amount, v_key),
      p_user_id
    );
  END IF;

  RETURN jsonb_build_object('debited', true, 'duplicate', false, 'new_balance', v_balance);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('debited', false, 'duplicate', true);
END;
$$;

REVOKE ALL ON FUNCTION public.credit_paydora_deposit(UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_paydora_deposit(UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.debit_paydora_payout(UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_paydora_deposit(UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_paydora_deposit(UUID, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.debit_paydora_payout(UUID, NUMERIC, TEXT) TO service_role;

-- ── Lock leftover worker / money RPCs ────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'fail_stale_game_loads',
        'claim_next_game_load',
        'complete_game_load',
        'credit_wallet',
        'debit_wallet',
        'credit_redeem_completion',
        'credit_system_wallet'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated', r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- ── Profile role / KYC cannot be self-edited ─────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonus_wallet NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonus_redeem_wallet NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cashout_wallet NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- This project may not have the full RBAC pack (user_roles / app_role).
-- Staff checks use profiles.role, and user_roles when that table exists.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT lower(coalesce(to_jsonb(p)->>'role', 'user'))
    INTO v_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_role IN ('admin', 'super_admin', 'manager', 'support_agent', 'moderator', 'staff') THEN
    RETURN true;
  END IF;

  IF to_regclass('public.user_roles') IS NOT NULL AND to_regclass('public.roles') IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.key::text IN ('super_admin', 'admin', 'manager', 'support_agent', 'moderator')
    );
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT lower(coalesce(to_jsonb(p)->>'role', 'user'))
    INTO v_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_role IN ('admin', 'super_admin') THEN
    RETURN true;
  END IF;

  IF to_regclass('public.user_roles') IS NOT NULL AND to_regclass('public.roles') IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.key::text IN ('super_admin', 'admin')
    );
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR current_setting('app.wallet_update', true) = 'true'
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF to_jsonb(NEW)->>'wallet_balance' IS DISTINCT FROM to_jsonb(OLD)->>'wallet_balance'
     OR to_jsonb(NEW)->>'cashout_wallet' IS DISTINCT FROM to_jsonb(OLD)->>'cashout_wallet'
     OR to_jsonb(NEW)->>'role' IS DISTINCT FROM to_jsonb(OLD)->>'role'
     OR to_jsonb(NEW)->>'kyc_status' IS DISTINCT FROM to_jsonb(OLD)->>'kyc_status'
     OR to_jsonb(NEW)->>'xp' IS DISTINCT FROM to_jsonb(OLD)->>'xp'
     OR to_jsonb(NEW)->>'level' IS DISTINCT FROM to_jsonb(OLD)->>'level'
     OR to_jsonb(NEW)->>'coins_balance' IS DISTINCT FROM to_jsonb(OLD)->>'coins_balance'
     OR to_jsonb(NEW)->>'lifetime_coins' IS DISTINCT FROM to_jsonb(OLD)->>'lifetime_coins'
     OR to_jsonb(NEW)->>'is_banned' IS DISTINCT FROM to_jsonb(OLD)->>'is_banned'
     OR to_jsonb(NEW)->>'referral_code' IS DISTINCT FROM to_jsonb(OLD)->>'referral_code'
  THEN
    RAISE EXCEPTION 'column protected' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_wallet_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.wallet_update', true) = 'true'
     OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF OLD.wallet_balance IS DISTINCT FROM NEW.wallet_balance
     OR OLD.bonus_wallet IS DISTINCT FROM NEW.bonus_wallet
     OR OLD.cashout_wallet IS DISTINCT FROM NEW.cashout_wallet
     OR OLD.bonus_redeem_wallet IS DISTINCT FROM NEW.bonus_redeem_wallet THEN
    NEW.wallet_balance := OLD.wallet_balance;
    NEW.bonus_wallet := OLD.bonus_wallet;
    NEW.cashout_wallet := OLD.cashout_wallet;
    NEW.bonus_redeem_wallet := OLD.bonus_redeem_wallet;
  END IF;

  IF to_jsonb(NEW) ? 'kyc_status' AND to_jsonb(NEW)->>'kyc_status' IS DISTINCT FROM to_jsonb(OLD)->>'kyc_status' THEN
    NEW.kyc_status := OLD.kyc_status;
  END IF;

  RETURN NEW;
END;
$$;

-- ── Profiles: self + staff only (keep admin lookup) ──────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "profiles self readable" ON public.profiles;
CREATE POLICY "profiles self readable" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_staff());
