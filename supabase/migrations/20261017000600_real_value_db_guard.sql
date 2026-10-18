-- Proposed only. Do not apply until the owner approves this file.
-- The website switches are not checked by a direct database call.
-- A signed-in player can call request_game_load and request_game_redeem.
-- These triggers stop new deposit credits, payout reservations, game-load
-- debits, redemptions, and ledger adjustments while the matching row is off.
-- They do not change wallet formulas. Refund rows and payout-void credits
-- stay allowed so an already accepted payment can still be reversed.
-- Every row starts off. ON CONFLICT DO NOTHING never turns a row on.
-- Applying this file also stops those actions on the current website.

CREATE TABLE IF NOT EXISTS public.real_value_controls (
  operation text PRIMARY KEY CHECK (
    operation IN ('deposits', 'game_loads', 'redemptions', 'payouts', 'adjustments')
  ),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.real_value_controls (operation, enabled)
VALUES
  ('deposits', false),
  ('game_loads', false),
  ('redemptions', false),
  ('payouts', false),
  ('adjustments', false)
ON CONFLICT (operation) DO NOTHING;

ALTER TABLE public.real_value_controls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.real_value_controls FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.real_value_controls TO service_role;

CREATE OR REPLACE FUNCTION public.real_value_operation_enabled(p_operation text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE((
    SELECT enabled
    FROM public.real_value_controls
    WHERE operation = p_operation
  ), false);
$$;

REVOKE ALL ON FUNCTION public.real_value_operation_enabled(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.real_value_operation_enabled(text) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_real_value_ledger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_operation text;
BEGIN
  v_operation := CASE NEW.kind
    WHEN 'deposit' THEN 'deposits'
    WHEN 'refund' THEN 'deposits'
    WHEN 'game_load' THEN 'game_loads'
    WHEN 'game_redeem' THEN 'redemptions'
    WHEN 'payout' THEN 'payouts'
    WHEN 'adjustment' THEN 'adjustments'
    ELSE NULL
  END;
  IF v_operation IS NOT NULL AND NOT public.real_value_operation_enabled(v_operation) THEN
    RAISE EXCEPTION 'real value off';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_real_value_game_load()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.load_type IN ('load', 'reload', 'new_account') AND COALESCE(NEW.amount, 0) > 0 THEN
    IF NOT public.real_value_operation_enabled('game_loads') THEN
      RAISE EXCEPTION 'real value off';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.load_type = 'redeem' THEN
    IF NOT public.real_value_operation_enabled('redemptions') THEN
      RAISE EXCEPTION 'real value off';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.wallet_refunded IS TRUE AND NEW.wallet_refunded IS FALSE THEN
    IF NOT public.real_value_operation_enabled('game_loads') THEN
      RAISE EXCEPTION 'real value off';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_real_value_paydora_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.direction = 'credit' AND COALESCE(NEW.payment_id, '') NOT LIKE 'payout-void:%' THEN
    IF NOT public.real_value_operation_enabled('deposits') THEN
      RAISE EXCEPTION 'real value off';
    END IF;
  ELSIF NEW.direction = 'debit' AND COALESCE(NEW.payment_id, '') NOT LIKE 'refund:%' THEN
    IF NOT public.real_value_operation_enabled('payouts') THEN
      RAISE EXCEPTION 'real value off';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.wallet_ledger') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_real_value_wallet_ledger ON public.wallet_ledger;
    CREATE TRIGGER trg_real_value_wallet_ledger
      BEFORE INSERT ON public.wallet_ledger
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_real_value_ledger();
  END IF;

  IF to_regclass('public.game_load_requests') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_real_value_game_load ON public.game_load_requests;
    CREATE TRIGGER trg_real_value_game_load
      BEFORE INSERT OR UPDATE ON public.game_load_requests
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_real_value_game_load();
  END IF;

  IF to_regclass('public.paydora_processed_events') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_real_value_paydora_event ON public.paydora_processed_events;
    CREATE TRIGGER trg_real_value_paydora_event
      BEFORE INSERT ON public.paydora_processed_events
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_real_value_paydora_event();
  END IF;
END;
$$;
