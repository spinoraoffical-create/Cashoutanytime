-- Paydora checkout uses the service role. These tables exist, but that role
-- cannot read or write them, and check_rate_limit was never created.
-- Deposits stop before a checkout link is returned until this runs.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits (window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket text,
  p_max_hits integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w_start timestamptz;
  current_hits integer;
BEGIN
  w_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.rate_limits (bucket, window_start, hits)
  VALUES (p_bucket, w_start, 1)
  ON CONFLICT (bucket, window_start)
  DO UPDATE SET hits = public.rate_limits.hits + 1
  RETURNING hits INTO current_hits;

  RETURN current_hits <= p_max_hits;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'payment_intents',
    'deposit_bonus_ledger',
    'agent_commissions',
    'webhook_events',
    'cashout_holds',
    'platform_ops',
    'game_load_requests',
    'paydora_processed_events',
    'rate_limits'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.credit_paydora_deposit(uuid, numeric, text, text, text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.credit_paydora_deposit(uuid, numeric, text, text, text) TO service_role;
  END IF;
  IF to_regprocedure('public.reverse_paydora_deposit(uuid, numeric, text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.reverse_paydora_deposit(uuid, numeric, text) TO service_role;
  END IF;
  IF to_regprocedure('public.debit_paydora_payout(uuid, numeric, text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.debit_paydora_payout(uuid, numeric, text) TO service_role;
  END IF;
END $$;
