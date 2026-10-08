-- Automatic deposits, bonuses, game loads, commissions, and cash-out holds.
-- Wallet credit stays in credit_paydora_deposit (unique payment_id). This file
-- does not add a second credit path.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_deposit_bonus_percent NUMERIC(6, 2) NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS reload_bonus_percent NUMERIC(6, 2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS bonus_text TEXT;

ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_first_deposit_bonus_percent_check;
ALTER TABLE public.games
  ADD CONSTRAINT games_first_deposit_bonus_percent_check
  CHECK (first_deposit_bonus_percent >= 0 AND first_deposit_bonus_percent <= 200);

ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_reload_bonus_percent_check;
ALTER TABLE public.games
  ADD CONSTRAINT games_reload_bonus_percent_check
  CHECK (reload_bonus_percent >= 0 AND reload_bonus_percent <= 200);

ALTER TABLE public.game_load_requests
  ADD COLUMN IF NOT EXISTS source_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS game_load_requests_source_key_uidx
  ON public.game_load_requests (source_key)
  WHERE source_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  game_slug TEXT,
  game_name TEXT,
  promo_code TEXT,
  base_amount NUMERIC(12, 2),
  bonus_percent NUMERIC(6, 2),
  bonus_amount NUMERIC(12, 2),
  final_credit NUMERIC(12, 2),
  deposit_kind TEXT CHECK (deposit_kind IS NULL OR deposit_kind IN ('first', 'reload')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);

CREATE TABLE IF NOT EXISTS public.deposit_bonus_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_key TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  game_slug TEXT,
  base_amount NUMERIC(12, 2) NOT NULL,
  bonus_percent NUMERIC(6, 2) NOT NULL,
  bonus_amount NUMERIC(12, 2) NOT NULL,
  final_credit NUMERIC(12, 2) NOT NULL,
  deposit_kind TEXT NOT NULL CHECK (deposit_kind IN ('first', 'reload')),
  wallet_credited BOOLEAN NOT NULL DEFAULT false,
  game_load_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (game_load_status IN ('pending', 'loaded', 'failed', 'skipped')),
  game_load_request_id UUID,
  game_load_error TEXT,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_key TEXT NOT NULL UNIQUE,
  agent_id UUID NOT NULL,
  player_id UUID NOT NULL,
  base_amount NUMERIC(12, 2) NOT NULL,
  commission_bps INTEGER NOT NULL CHECK (commission_bps >= 0 AND commission_bps <= 10000),
  commission_amount NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_key TEXT NOT NULL,
  event_name TEXT,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'failed', 'ignored')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (provider, event_key)
);

CREATE TABLE IF NOT EXISTS public.cashout_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_key TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.platform_ops (
  key TEXT PRIMARY KEY,
  cashout_auto_limit NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cashout_auto_limit >= 0),
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.platform_ops (key, cashout_auto_limit)
VALUES ('cashout', 0)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_bonus_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashout_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_ops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players read own bonus ledger" ON public.deposit_bonus_ledger;
CREATE POLICY "Players read own bonus ledger"
  ON public.deposit_bonus_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Agents read own commissions" ON public.agent_commissions;
CREATE POLICY "Agents read own commissions"
  ON public.agent_commissions FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

DROP POLICY IF EXISTS "Players read own cashout holds" ON public.cashout_holds;
CREATE POLICY "Players read own cashout holds"
  ON public.cashout_holds FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- One automatic game load per deposit. A retry reuses the same row and does not insert another debit.
CREATE OR REPLACE FUNCTION public.request_auto_game_load(
  p_user_id UUID,
  p_game_slug TEXT,
  p_game_name TEXT,
  p_amount NUMERIC,
  p_game_username TEXT,
  p_source_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.game_load_requests;
  v_amount NUMERIC;
  v_balance NUMERIC;
  v_id UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;

  v_amount := round(p_amount, 2);
  IF p_user_id IS NULL OR nullif(trim(p_source_key), '') IS NULL OR v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'invalid auto load';
  END IF;

  SELECT * INTO v_existing
  FROM public.game_load_requests
  WHERE source_key = p_source_key
  FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.status IN ('completed', 'pending', 'processing') THEN
      RETURN v_existing.id;
    END IF;
    IF v_existing.wallet_refunded THEN
      PERFORM set_config('app.wallet_update', 'true', true);
      UPDATE public.profiles
      SET wallet_balance = wallet_balance - v_amount
      WHERE id = p_user_id AND wallet_balance >= v_amount
      RETURNING wallet_balance INTO v_balance;
      IF v_balance IS NULL THEN
        RAISE EXCEPTION 'Insufficient wallet balance';
      END IF;
      UPDATE public.game_load_requests
      SET status = 'processing', wallet_refunded = false, error_message = NULL, updated_at = now()
      WHERE id = v_existing.id;
      RETURN v_existing.id;
    END IF;
    UPDATE public.game_load_requests
    SET status = 'processing', updated_at = now()
    WHERE id = v_existing.id;
    RETURN v_existing.id;
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);
  UPDATE public.profiles
  SET wallet_balance = wallet_balance - v_amount
  WHERE id = p_user_id AND wallet_balance >= v_amount
  RETURNING wallet_balance INTO v_balance;
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  INSERT INTO public.game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type, game_username, status, source_key, admin_notes
  ) VALUES (
    p_user_id, p_game_slug, p_game_name, v_amount, 'current', 'reload',
    nullif(trim(p_game_username), ''), 'processing', p_source_key, 'Automatic deposit load'
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_auto_game_load(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_auto_game_load(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT) TO service_role;
