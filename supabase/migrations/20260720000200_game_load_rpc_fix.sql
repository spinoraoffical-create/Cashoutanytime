-- Safe fix: request_game_load for Supabase projects WITHOUT wallet_ledger
-- (uses wallet_transactions — do NOT run 20260617000085 if wallet_ledger is missing)
-- Run entire file once in Supabase SQL Editor.

-- ── Wallet transaction log (if you never ran wallets.sql) ─────────────────────
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  wallet_type TEXT NOT NULL CHECK (wallet_type IN ('current', 'bonus', 'cashout')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'adjustment')),
  source TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id
  ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at
  ON public.wallet_transactions(created_at DESC);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view own wallet transactions"
  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── game_load_requests load types ───────────────────────────────────────────
ALTER TABLE public.game_load_requests DROP CONSTRAINT IF EXISTS game_load_requests_load_type_check;
ALTER TABLE public.game_load_requests ADD CONSTRAINT game_load_requests_load_type_check
  CHECK (load_type IN ('new_account', 'reload', 'create_account', 'load', 'redeem', 'check_balance'));

ALTER TABLE public.game_load_requests DROP CONSTRAINT IF EXISTS game_load_requests_amount_check;
ALTER TABLE public.game_load_requests ADD CONSTRAINT game_load_requests_amount_check
  CHECK (amount >= 0);

-- ── Replace old 5-arg RPC with 6-arg wallet load ────────────────────────────
DROP FUNCTION IF EXISTS public.request_game_load(text, text, numeric, text, text);
DROP FUNCTION IF EXISTS public.request_game_load(text, text, numeric, text, text, text);

CREATE OR REPLACE FUNCTION public.request_game_load(
  p_game_slug TEXT,
  p_game_name TEXT,
  p_amount NUMERIC,
  p_wallet_type TEXT,
  p_load_type TEXT,
  p_game_username TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance NUMERIC;
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_load_type NOT IN ('new_account', 'reload', 'create_account', 'load') THEN
    RAISE EXCEPTION 'Invalid load type';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.game_load_requests
    WHERE user_id = v_user_id AND game_slug = p_game_slug
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'A request is already in progress for this game';
  END IF;

  IF p_load_type = 'create_account' THEN
    INSERT INTO public.game_load_requests (
      user_id, game_slug, game_name, amount, wallet_type, load_type, status
    )
    VALUES (v_user_id, p_game_slug, p_game_name, 0, 'current', 'create_account', 'pending')
    RETURNING id INTO v_request_id;
    RETURN v_request_id;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_wallet_type NOT IN ('current', 'bonus') THEN
    RAISE EXCEPTION 'Invalid wallet type';
  END IF;

  IF p_load_type IN ('reload', 'load')
     AND (p_game_username IS NULL OR trim(p_game_username) = '') THEN
    RAISE EXCEPTION 'Game username required for load';
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);

  IF p_wallet_type = 'current' THEN
    SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = v_user_id FOR UPDATE;
    IF v_balance IS NULL OR v_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;
    UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = v_user_id;
  ELSE
    SELECT bonus_wallet INTO v_balance FROM public.profiles WHERE id = v_user_id FOR UPDATE;
    IF v_balance IS NULL OR v_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient bonus wallet balance';
    END IF;
    UPDATE public.profiles SET bonus_wallet = bonus_wallet - p_amount WHERE id = v_user_id;
  END IF;

  -- Log debit: wallet_transactions (this project) — NOT wallet_ledger
  INSERT INTO public.wallet_transactions (
    user_id, amount, wallet_type, transaction_type, source, description, created_by
  )
  VALUES (
    v_user_id,
    p_amount,
    p_wallet_type,
    'debit',
    'game_load',
    format('Load $%s to %s', p_amount, p_game_name),
    v_user_id
  );

  INSERT INTO public.game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type, game_username, status
  )
  VALUES (
    v_user_id,
    p_game_slug,
    p_game_name,
    p_amount,
    p_wallet_type,
    CASE WHEN p_load_type = 'reload' THEN 'load' ELSE p_load_type END,
    NULLIF(trim(p_game_username), ''),
    'pending'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_game_load(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
