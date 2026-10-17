-- Once-only player-account claims. Prepared only. Do not apply without approval.
-- Run this file only on the current Sweepstakes Hub database. It has no connection
-- string and cannot select a project by itself. Do not run it on the old Spinora project.
-- Does not change credit_wallet, debit_wallet, request_game_load, refund_game_load_wallet,
-- or complete_game_load. A row here does not change a player balance.
--
-- Rollback, only if no row is still pending, submitted, unknown, or manual_review:
--   DROP FUNCTION IF EXISTS public.finish_provider_account(text, text);
--   DROP FUNCTION IF EXISTS public.claim_provider_account(text, text, text);
--   DROP TABLE IF EXISTS public.provider_account_operations;
-- Rollback does not change wallet balances.

CREATE TABLE IF NOT EXISTS public.provider_account_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_key text NOT NULL,
  provider text NOT NULL,
  player_account text NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_account_operations_key_unique UNIQUE (operation_key),
  CONSTRAINT provider_account_operations_provider_check
    CHECK (provider IN ('fire-kirin', 'milky-way', 'orion-stars')),
  CONSTRAINT provider_account_operations_state_check
    CHECK (state IN ('pending', 'submitted', 'confirmed', 'failed', 'unknown', 'manual_review'))
);

CREATE OR REPLACE FUNCTION public.claim_provider_account(
  p_operation_key text,
  p_provider text,
  p_player_account text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_state text;
BEGIN
  IF p_operation_key IS NULL OR length(trim(p_operation_key)) < 8 THEN
    RAISE EXCEPTION 'operation key required';
  END IF;
  IF p_provider NOT IN ('fire-kirin', 'milky-way', 'orion-stars') THEN
    RAISE EXCEPTION 'invalid provider';
  END IF;
  IF p_player_account IS NULL OR length(trim(p_player_account)) < 6 THEN
    RAISE EXCEPTION 'player account required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(trim(p_operation_key), 0));

  INSERT INTO public.provider_account_operations (operation_key, provider, player_account)
  VALUES (trim(p_operation_key), p_provider, left(trim(p_player_account), 64))
  ON CONFLICT (operation_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN 'proceed';
  END IF;

  SELECT state INTO v_state
  FROM public.provider_account_operations
  WHERE operation_key = trim(p_operation_key);
  IF v_state = 'failed' THEN
    RETURN 'hold';
  END IF;
  RETURN 'hold';
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_provider_account(
  p_operation_key text,
  p_outcome text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_outcome NOT IN ('submitted', 'confirmed', 'failed', 'unknown', 'manual_review') THEN
    RAISE EXCEPTION 'invalid account outcome';
  END IF;
  UPDATE public.provider_account_operations
  SET state = p_outcome, updated_at = now()
  WHERE operation_key = trim(p_operation_key)
    AND (
      (state = 'pending' AND p_outcome IN ('submitted', 'failed'))
      OR (state = 'submitted' AND p_outcome IN ('confirmed', 'unknown', 'manual_review', 'failed'))
      OR (state IN ('unknown', 'manual_review') AND p_outcome = 'manual_review')
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account operation could not be finished';
  END IF;
END;
$$;

ALTER TABLE public.provider_account_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.provider_account_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.provider_account_operations TO service_role;
REVOKE ALL ON FUNCTION public.claim_provider_account(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_provider_account(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_provider_account(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_provider_account(text, text) TO service_role;
