-- Durable provider transfer ledger. Prepared only. Do not apply without approval.
-- Run this file only on the current Sweepstakes Hub database. It has no connection
-- string and cannot select a project by itself. Do not run it on the old Spinora project.
-- Does not change credit_wallet, debit_wallet, request_game_load, or complete_game_load.
-- A unique operation key stops a second internal send. It cannot make Milky Way or Orion Stars
-- idempotent: those documents have no provider transaction id, so an uncertain send stays in review.
--
-- Rollback, only if no operation row is still pending, submitted, unknown, or manual_review:
--   DROP TRIGGER IF EXISTS provider_transfer_state_guard ON public.provider_transfer_operations;
--   DROP FUNCTION IF EXISTS public.record_provider_read(text, boolean, numeric, boolean, text);
--   DROP FUNCTION IF EXISTS public.set_provider_automation_paused(text, boolean, text);
--   DROP FUNCTION IF EXISTS public.reconcile_provider_transfer(text, text, text);
--   DROP FUNCTION IF EXISTS public.confirm_provider_transfer(text);
--   DROP FUNCTION IF EXISTS public.finish_provider_transfer(text, text, jsonb);
--   DROP FUNCTION IF EXISTS public.mark_provider_transfer_submitted(text);
--   DROP FUNCTION IF EXISTS public.claim_provider_transfer(text, text, text, numeric, uuid, text, text, boolean, jsonb);
--   DROP FUNCTION IF EXISTS public.provider_transfer_state_guard();
--   DROP FUNCTION IF EXISTS public.redact_provider_meta(jsonb);
--   DROP TABLE IF EXISTS public.provider_read_snapshots;
--   DROP TABLE IF EXISTS public.provider_transfer_operations;
--   DROP TABLE IF EXISTS public.provider_automation_controls;
-- Rollback does not change wallet balances. Staff still use the existing load tools for money.

CREATE TABLE IF NOT EXISTS public.provider_automation_controls (
  provider text PRIMARY KEY,
  paused boolean NOT NULL DEFAULT true,
  reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_automation_controls_provider_check
    CHECK (provider IN ('fire-kirin', 'milky-way', 'orion-stars'))
);

INSERT INTO public.provider_automation_controls (provider, paused, reason)
VALUES
  ('fire-kirin', true, 'Paused until a supervised transfer test is approved.'),
  ('milky-way', true, 'Paused until a supervised transfer test is approved.'),
  ('orion-stars', true, 'Paused. Terminal API login is not confirmed.')
ON CONFLICT (provider) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.provider_transfer_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_key text NOT NULL,
  provider text NOT NULL,
  action text NOT NULL,
  game_load_request_id uuid NOT NULL REFERENCES public.game_load_requests (id),
  player_account text NOT NULL,
  amount numeric NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  provider_transaction_id text,
  provider_idempotent boolean NOT NULL DEFAULT false,
  request_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_code text,
  provider_message text,
  review_note text,
  submitted_at timestamptz,
  finished_at timestamptz,
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_transfer_operations_key_unique UNIQUE (operation_key),
  CONSTRAINT provider_transfer_operations_provider_check
    CHECK (provider IN ('fire-kirin', 'milky-way', 'orion-stars')),
  CONSTRAINT provider_transfer_operations_action_check
    CHECK (action IN ('recharge', 'redeem')),
  CONSTRAINT provider_transfer_operations_state_check
    CHECK (state IN ('pending', 'submitted', 'confirmed', 'failed', 'unknown', 'manual_review')),
  CONSTRAINT provider_transfer_operations_amount_check
    CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS provider_transfer_operations_review_idx
  ON public.provider_transfer_operations (provider, state, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.provider_read_snapshots (
  provider text PRIMARY KEY,
  last_success_at timestamptz,
  last_balance numeric,
  last_balance_known boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz,
  last_error text,
  CONSTRAINT provider_read_snapshots_provider_check
    CHECK (provider IN ('fire-kirin', 'milky-way', 'orion-stars'))
);

CREATE OR REPLACE FUNCTION public.redact_provider_meta(p_meta jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_key text;
  v_clean jsonb := '{}'::jsonb;
BEGIN
  IF p_meta IS NULL OR jsonb_typeof(p_meta) <> 'object' THEN
    RETURN '{}'::jsonb;
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_meta)
  LOOP
    IF v_key ~* '(sign|passwd|password|agentkey|authorization|cookie|token|secret)' THEN
      CONTINUE;
    END IF;
    v_clean := v_clean || jsonb_build_object(v_key, p_meta -> v_key);
  END LOOP;
  RETURN v_clean;
END;
$$;

CREATE OR REPLACE FUNCTION public.provider_transfer_state_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.operation_key IS DISTINCT FROM OLD.operation_key THEN
    RAISE EXCEPTION 'operation key is immutable';
  END IF;
  IF NEW.game_load_request_id IS DISTINCT FROM OLD.game_load_request_id THEN
    RAISE EXCEPTION 'wallet reservation is immutable';
  END IF;
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    IF NOT (
      (OLD.state = 'pending' AND NEW.state IN ('submitted', 'failed'))
      OR (OLD.state = 'submitted' AND NEW.state IN ('confirmed', 'failed', 'unknown', 'manual_review'))
      OR (OLD.state = 'unknown' AND NEW.state IN ('manual_review', 'confirmed', 'failed'))
      OR (OLD.state = 'manual_review' AND NEW.state IN ('confirmed', 'failed'))
    ) THEN
      RAISE EXCEPTION 'illegal provider transfer transition';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS provider_transfer_state_guard ON public.provider_transfer_operations;
CREATE TRIGGER provider_transfer_state_guard
  BEFORE UPDATE ON public.provider_transfer_operations
  FOR EACH ROW
  EXECUTE FUNCTION public.provider_transfer_state_guard();

CREATE OR REPLACE FUNCTION public.claim_provider_transfer(
  p_operation_key text,
  p_provider text,
  p_action text,
  p_amount numeric,
  p_request_id uuid,
  p_player_account text,
  p_provider_transaction_id text,
  p_provider_idempotent boolean,
  p_request_meta jsonb
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paused boolean;
  v_load public.game_load_requests;
  v_id uuid;
  v_state text;
BEGIN
  IF p_operation_key IS NULL OR length(trim(p_operation_key)) < 8 THEN
    RAISE EXCEPTION 'operation key required';
  END IF;
  IF p_provider NOT IN ('fire-kirin', 'milky-way', 'orion-stars') THEN
    RAISE EXCEPTION 'invalid provider';
  END IF;
  IF p_action NOT IN ('recharge', 'redeem') THEN
    RAISE EXCEPTION 'invalid action';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'wallet reservation is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_operation_key, 0));

  SELECT paused INTO v_paused
  FROM public.provider_automation_controls
  WHERE provider = p_provider;
  IF COALESCE(v_paused, true) THEN
    RETURN 'paused';
  END IF;

  SELECT * INTO v_load
  FROM public.game_load_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF v_load.id IS NULL OR v_load.wallet_refunded OR v_load.status NOT IN ('pending', 'processing') THEN
    RETURN 'hold';
  END IF;
  IF p_action = 'recharge' AND v_load.load_type NOT IN ('load', 'reload') THEN
    RAISE EXCEPTION 'reservation is not a load';
  END IF;
  IF p_action = 'redeem' AND v_load.load_type <> 'redeem' THEN
    RAISE EXCEPTION 'reservation is not a redeem';
  END IF;
  IF p_action = 'recharge' AND v_load.amount IS DISTINCT FROM p_amount THEN
    RAISE EXCEPTION 'amount does not match the wallet reservation';
  END IF;

  INSERT INTO public.provider_transfer_operations (
    operation_key, provider, action, game_load_request_id, player_account, amount,
    provider_transaction_id, provider_idempotent, request_meta
  )
  VALUES (
    trim(p_operation_key), p_provider, p_action, p_request_id, left(COALESCE(p_player_account, ''), 64), p_amount,
    NULLIF(left(COALESCE(p_provider_transaction_id, ''), 20), ''),
    COALESCE(p_provider_idempotent, false),
    public.redact_provider_meta(p_request_meta)
  )
  ON CONFLICT (operation_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN 'proceed';
  END IF;

  SELECT state INTO v_state
  FROM public.provider_transfer_operations
  WHERE operation_key = trim(p_operation_key);
  IF v_state IN ('confirmed', 'failed') THEN
    RETURN 'already_recorded';
  END IF;
  RETURN 'hold';
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_provider_transfer_submitted(p_operation_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.provider_transfer_operations
  SET state = 'submitted', submitted_at = now()
  WHERE operation_key = trim(p_operation_key) AND state = 'pending'
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_provider_transfer(
  p_operation_key text,
  p_outcome text,
  p_response_meta jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta jsonb := public.redact_provider_meta(p_response_meta);
BEGIN
  IF p_outcome NOT IN ('failed', 'unknown', 'manual_review') THEN
    RAISE EXCEPTION 'invalid finish outcome';
  END IF;
  UPDATE public.provider_transfer_operations
  SET
    state = p_outcome,
    response_meta = v_meta,
    provider_code = left(COALESCE(v_meta ->> 'code', ''), 20),
    provider_message = left(COALESCE(v_meta ->> 'msg', ''), 300),
    finished_at = CASE WHEN p_outcome = 'manual_review' THEN finished_at ELSE now() END
  WHERE operation_key = trim(p_operation_key)
    AND (
      (state = 'pending' AND p_outcome = 'failed')
      OR (state = 'submitted' AND p_outcome IN ('failed', 'unknown', 'manual_review'))
      OR (state = 'unknown' AND p_outcome = 'manual_review')
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'provider transfer could not be finished';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_provider_transfer(p_operation_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.provider_transfer_operations
  SET state = 'confirmed', finished_at = now()
  WHERE operation_key = trim(p_operation_key) AND state = 'manual_review'
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_provider_transfer(
  p_operation_key text,
  p_decision text,
  p_note text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state text;
  v_id uuid;
BEGIN
  IF p_decision NOT IN ('confirmed', 'failed') THEN
    RAISE EXCEPTION 'invalid reconciliation';
  END IF;
  SELECT state INTO v_state
  FROM public.provider_transfer_operations
  WHERE operation_key = trim(p_operation_key)
  FOR UPDATE;
  IF v_state IS NULL OR v_state IN ('confirmed', 'failed') THEN
    RETURN false;
  END IF;
  IF v_state = 'pending' AND p_decision <> 'failed' THEN
    RAISE EXCEPTION 'a pending transfer was not sent and cannot be confirmed';
  END IF;
  IF v_state NOT IN ('pending', 'submitted', 'unknown', 'manual_review') THEN
    RETURN false;
  END IF;
  UPDATE public.provider_transfer_operations
  SET
    state = p_decision,
    review_note = left(COALESCE(p_note, ''), 500),
    reconciled_at = now(),
    finished_at = COALESCE(finished_at, now())
  WHERE operation_key = trim(p_operation_key) AND state = v_state
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_provider_automation_paused(
  p_provider text,
  p_paused boolean,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_provider NOT IN ('fire-kirin', 'milky-way', 'orion-stars') THEN
    RAISE EXCEPTION 'invalid provider';
  END IF;
  INSERT INTO public.provider_automation_controls (provider, paused, reason)
  VALUES (p_provider, p_paused, left(COALESCE(p_reason, ''), 300))
  ON CONFLICT (provider) DO UPDATE
  SET paused = EXCLUDED.paused, reason = EXCLUDED.reason, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.record_provider_read(
  p_provider text,
  p_auth_ok boolean,
  p_balance numeric,
  p_balance_known boolean,
  p_error text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_provider NOT IN ('fire-kirin', 'milky-way', 'orion-stars') THEN
    RAISE EXCEPTION 'invalid provider';
  END IF;
  INSERT INTO public.provider_read_snapshots (
    provider, last_success_at, last_balance, last_balance_known, last_checked_at, last_error
  )
  VALUES (
    p_provider,
    CASE WHEN p_auth_ok THEN now() ELSE NULL END,
    CASE WHEN p_auth_ok AND p_balance_known THEN p_balance ELSE NULL END,
    COALESCE(p_balance_known, false),
    now(),
    left(COALESCE(p_error, ''), 180)
  )
  ON CONFLICT (provider) DO UPDATE
  SET
    last_success_at = CASE WHEN p_auth_ok THEN now() ELSE provider_read_snapshots.last_success_at END,
    last_balance = CASE
      WHEN p_auth_ok AND p_balance_known THEN p_balance
      ELSE provider_read_snapshots.last_balance
    END,
    last_balance_known = CASE
      WHEN p_auth_ok AND p_balance_known THEN true
      ELSE provider_read_snapshots.last_balance_known
    END,
    last_checked_at = now(),
    last_error = CASE WHEN p_auth_ok THEN NULL ELSE left(COALESCE(p_error, ''), 180) END;
END;
$$;

ALTER TABLE public.provider_automation_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_transfer_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_read_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.provider_automation_controls FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.provider_transfer_operations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.provider_read_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.provider_automation_controls TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.provider_transfer_operations TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.provider_read_snapshots TO service_role;

REVOKE ALL ON FUNCTION public.redact_provider_meta(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.provider_transfer_state_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_provider_transfer(text, text, text, numeric, uuid, text, text, boolean, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_provider_transfer_submitted(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_provider_transfer(text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_provider_transfer(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_provider_transfer(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_provider_automation_paused(text, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_provider_read(text, boolean, numeric, boolean, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_provider_transfer(text, text, text, numeric, uuid, text, text, boolean, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_provider_transfer_submitted(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_provider_transfer(text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_provider_transfer(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_provider_transfer(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_provider_automation_paused(text, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_provider_read(text, boolean, numeric, boolean, text) TO service_role;
