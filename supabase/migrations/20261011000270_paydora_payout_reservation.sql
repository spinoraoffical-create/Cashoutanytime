-- One open Paydora cash-out per player, amount, method, and destination.
-- paydora_processed_events only dedupes a payment id the caller supplies.
-- The payout route used to mint a new id on every click, so a retry debited
-- the wallet again and created another withdrawal. This table stores the
-- request and its provider idempotency key before Paydora is called.
-- debit_paydora_payout and credit_cashout_payout_void are unchanged.
-- Run this in the Supabase SQL editor. Do not apply it from the app.

CREATE TABLE IF NOT EXISTS public.paydora_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL,
  destination_key TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('requested', 'reserved', 'submitted', 'paid', 'failed', 'manual_review')),
  provider_withdrawal_id TEXT,
  provider_reference_id TEXT,
  provider_status TEXT,
  hold_reason TEXT,
  provider_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS paydora_payout_requests_one_open
  ON public.paydora_payout_requests (user_id, amount, method, destination_key)
  WHERE status IN ('requested', 'reserved', 'submitted', 'manual_review');

CREATE INDEX IF NOT EXISTS idx_paydora_payout_requests_user
  ON public.paydora_payout_requests (user_id, created_at DESC);

ALTER TABLE public.paydora_payout_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.paydora_payout_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.paydora_payout_requests TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_paydora_payout(
  p_user_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_destination_key TEXT,
  p_hold BOOLEAN,
  p_hold_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
  v_method TEXT;
  v_dest TEXT;
  v_key TEXT;
  v_balance NUMERIC;
  v_row public.paydora_payout_requests;
  v_debit JSONB;
BEGIN
  v_amount := round(p_amount::numeric, 2);
  v_method := nullif(trim(p_method), '');
  v_dest := nullif(trim(p_destination_key), '');
  IF p_user_id IS NULL OR v_method IS NULL OR v_dest IS NULL OR v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'invalid payout request';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext(v_amount::text || '|' || v_method || '|' || v_dest)
  );

  SELECT * INTO v_row
  FROM public.paydora_payout_requests
  WHERE user_id = p_user_id
    AND amount = v_amount
    AND method = v_method
    AND destination_key = v_dest
    AND status IN ('requested', 'reserved', 'submitted', 'manual_review')
  FOR UPDATE;

  IF FOUND AND v_row.status = 'manual_review' AND NOT COALESCE(p_hold, FALSE) THEN
    v_debit := public.debit_paydora_payout(p_user_id, v_amount, v_row.idempotency_key);
    IF COALESCE((v_debit->>'debited')::boolean, FALSE) IS NOT TRUE
       AND COALESCE((v_debit->>'duplicate')::boolean, FALSE) IS NOT TRUE THEN
      RAISE EXCEPTION 'could not reserve payout';
    END IF;
    UPDATE public.paydora_payout_requests
    SET status = 'reserved', updated_at = now()
    WHERE id = v_row.id AND status = 'manual_review';
    RETURN jsonb_build_object(
      'reused', true,
      'debited', COALESCE((v_debit->>'debited')::boolean, FALSE),
      'promoted', true,
      'idempotency_key', v_row.idempotency_key,
      'status', 'reserved',
      'amount', v_amount,
      'provider_withdrawal_id', v_row.provider_withdrawal_id,
      'provider_reference_id', v_row.provider_reference_id,
      'provider_status', v_row.provider_status
    );
  END IF;

  IF FOUND AND v_row.status = 'requested' THEN
    v_debit := public.debit_paydora_payout(p_user_id, v_amount, v_row.idempotency_key);
    IF COALESCE((v_debit->>'debited')::boolean, FALSE) IS NOT TRUE
       AND COALESCE((v_debit->>'duplicate')::boolean, FALSE) IS NOT TRUE THEN
      RAISE EXCEPTION 'could not reserve payout';
    END IF;
    UPDATE public.paydora_payout_requests
    SET status = 'reserved', updated_at = now()
    WHERE id = v_row.id AND status = 'requested';
    RETURN jsonb_build_object(
      'reused', true,
      'debited', COALESCE((v_debit->>'debited')::boolean, FALSE),
      'promoted', false,
      'idempotency_key', v_row.idempotency_key,
      'status', 'reserved',
      'amount', v_amount
    );
  END IF;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'reused', true,
      'debited', false,
      'promoted', false,
      'idempotency_key', v_row.idempotency_key,
      'status', v_row.status,
      'amount', v_row.amount,
      'provider_withdrawal_id', v_row.provider_withdrawal_id,
      'provider_reference_id', v_row.provider_reference_id,
      'provider_status', v_row.provider_status
    );
  END IF;

  SELECT cashout_wallet INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < v_amount THEN
    RAISE EXCEPTION 'insufficient funds' USING ERRCODE = 'P0001';
  END IF;

  v_key := 'wd_' || gen_random_uuid()::text;

  BEGIN
    IF COALESCE(p_hold, FALSE) THEN
      INSERT INTO public.paydora_payout_requests (
        user_id, amount, method, destination_key, idempotency_key, status, hold_reason
      ) VALUES (
        p_user_id, v_amount, v_method, v_dest, v_key, 'manual_review', nullif(trim(p_hold_reason), '')
      );
      RETURN jsonb_build_object(
        'reused', false,
        'debited', false,
        'promoted', false,
        'idempotency_key', v_key,
        'status', 'manual_review',
        'amount', v_amount
      );
    END IF;

    INSERT INTO public.paydora_payout_requests (
      user_id, amount, method, destination_key, idempotency_key, status
    ) VALUES (
      p_user_id, v_amount, v_method, v_dest, v_key, 'requested'
    );
  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO v_row
      FROM public.paydora_payout_requests
      WHERE user_id = p_user_id
        AND amount = v_amount
        AND method = v_method
        AND destination_key = v_dest
        AND status IN ('requested', 'reserved', 'submitted', 'manual_review');
      IF NOT FOUND THEN
        RAISE;
      END IF;
      RETURN jsonb_build_object(
        'reused', true,
        'debited', false,
        'promoted', false,
        'idempotency_key', v_row.idempotency_key,
        'status', v_row.status,
        'amount', v_row.amount,
        'provider_withdrawal_id', v_row.provider_withdrawal_id,
        'provider_reference_id', v_row.provider_reference_id,
        'provider_status', v_row.provider_status
      );
  END;

  v_debit := public.debit_paydora_payout(p_user_id, v_amount, v_key);
  IF COALESCE((v_debit->>'debited')::boolean, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'could not reserve payout';
  END IF;

  UPDATE public.paydora_payout_requests
  SET status = 'reserved', updated_at = now()
  WHERE idempotency_key = v_key AND status = 'requested';

  RETURN jsonb_build_object(
    'reused', false,
    'debited', true,
    'promoted', false,
    'idempotency_key', v_key,
    'status', 'reserved',
    'amount', v_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_paydora_provider_attempt(
  p_user_id UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
  v_row public.paydora_payout_requests;
BEGIN
  v_key := nullif(trim(p_idempotency_key), '');
  IF p_user_id IS NULL OR v_key IS NULL THEN
    RAISE EXCEPTION 'payout not found';
  END IF;

  SELECT * INTO v_row
  FROM public.paydora_payout_requests
  WHERE user_id = p_user_id AND idempotency_key = v_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payout not found';
  END IF;

  IF v_row.status IN ('submitted', 'paid', 'manual_review', 'failed') OR v_row.status <> 'reserved' THEN
    RETURN jsonb_build_object(
      'call_provider', false,
      'in_progress', false,
      'status', v_row.status,
      'idempotency_key', v_row.idempotency_key,
      'provider_withdrawal_id', v_row.provider_withdrawal_id,
      'provider_reference_id', v_row.provider_reference_id,
      'provider_status', v_row.provider_status
    );
  END IF;

  IF v_row.provider_attempt_at IS NOT NULL AND v_row.provider_attempt_at > now() - interval '2 minutes' THEN
    RETURN jsonb_build_object(
      'call_provider', false,
      'in_progress', true,
      'status', 'reserved',
      'idempotency_key', v_row.idempotency_key
    );
  END IF;

  UPDATE public.paydora_payout_requests
  SET provider_attempt_at = now(), updated_at = now()
  WHERE id = v_row.id AND status = 'reserved';

  RETURN jsonb_build_object(
    'call_provider', true,
    'in_progress', false,
    'status', 'reserved',
    'idempotency_key', v_row.idempotency_key
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_paydora_payout_submitted(
  p_user_id UUID,
  p_idempotency_key TEXT,
  p_withdrawal_id TEXT,
  p_reference_id TEXT,
  p_provider_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
  v_status TEXT;
  v_row public.paydora_payout_requests;
BEGIN
  v_key := nullif(trim(p_idempotency_key), '');
  IF p_user_id IS NULL OR v_key IS NULL THEN
    RAISE EXCEPTION 'payout not found';
  END IF;

  SELECT * INTO v_row
  FROM public.paydora_payout_requests
  WHERE user_id = p_user_id AND idempotency_key = v_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payout not found';
  END IF;

  IF v_row.status = 'paid' THEN
    RETURN jsonb_build_object('updated', false, 'status', 'paid');
  END IF;

  IF v_row.status <> 'reserved' AND v_row.status <> 'submitted' THEN
    RETURN jsonb_build_object('updated', false, 'status', v_row.status);
  END IF;

  v_status := CASE
    WHEN lower(trim(coalesce(p_provider_status, ''))) = 'paid' THEN 'paid'
    ELSE 'submitted'
  END;

  UPDATE public.paydora_payout_requests
  SET status = v_status,
      provider_withdrawal_id = COALESCE(nullif(trim(p_withdrawal_id), ''), provider_withdrawal_id),
      provider_reference_id = COALESCE(nullif(trim(p_reference_id), ''), provider_reference_id),
      provider_status = COALESCE(nullif(trim(p_provider_status), ''), provider_status),
      updated_at = now()
  WHERE id = v_row.id;

  RETURN jsonb_build_object('updated', true, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_paydora_payout(
  p_user_id UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
  v_row public.paydora_payout_requests;
  v_void JSONB;
BEGIN
  v_key := nullif(trim(p_idempotency_key), '');
  IF p_user_id IS NULL OR v_key IS NULL THEN
    RAISE EXCEPTION 'payout not found';
  END IF;

  SELECT * INTO v_row
  FROM public.paydora_payout_requests
  WHERE user_id = p_user_id AND idempotency_key = v_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payout not found';
  END IF;

  IF v_row.status = 'failed' THEN
    RETURN jsonb_build_object('refunded', false, 'duplicate', true, 'status', 'failed');
  END IF;

  IF v_row.status <> 'reserved' THEN
    RETURN jsonb_build_object('refunded', false, 'duplicate', false, 'status', v_row.status);
  END IF;

  v_void := public.credit_cashout_payout_void(p_user_id, v_row.amount, v_row.idempotency_key);

  UPDATE public.paydora_payout_requests
  SET status = 'failed', updated_at = now()
  WHERE id = v_row.id AND status = 'reserved';

  RETURN jsonb_build_object(
    'refunded', COALESCE((v_void->>'credited')::boolean, FALSE),
    'duplicate', COALESCE((v_void->>'duplicate')::boolean, FALSE),
    'status', 'failed'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_paydora_payout(UUID, NUMERIC, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_paydora_provider_attempt(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_paydora_payout_submitted(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_paydora_payout(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_paydora_payout(UUID, NUMERIC, TEXT, TEXT, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_paydora_provider_attempt(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_paydora_payout_submitted(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_paydora_payout(UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
