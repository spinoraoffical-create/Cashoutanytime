-- Redeem fix: queue redeems reliably + credit Deposit Redeem (cashout_wallet) on bot completion
-- Uses wallet_transactions (NOT wallet_ledger). Safe to run once in Supabase SQL Editor.

-- Helper: resolve game UUID by slug (returns NULL if games table missing or slug unknown)
CREATE OR REPLACE FUNCTION public.game_id_for_slug(p_slug TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.games') IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN (SELECT id FROM public.games WHERE slug = p_slug LIMIT 1);
END;
$$;

-- ── Profile redeem wallets ────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cashout_wallet NUMERIC(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bonus_redeem_wallet NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- ── game_load_requests redeem column ──────────────────────────────────────────
ALTER TABLE public.game_load_requests
  ADD COLUMN IF NOT EXISTS redeem_all BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.game_load_requests DROP CONSTRAINT IF EXISTS game_load_requests_load_type_check;
ALTER TABLE public.game_load_requests ADD CONSTRAINT game_load_requests_load_type_check
  CHECK (load_type IN ('new_account', 'reload', 'create_account', 'load', 'redeem', 'check_balance'));

-- ── wallet_transactions types (cashout + bonus_redeem for redeem credits) ─────
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_wallet_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_wallet_type_check
  CHECK (wallet_type IN ('current', 'bonus', 'cashout', 'bonus_redeem'));

-- Allow payout source
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_source_check;
-- Only add if you have a source check; otherwise skip silently
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallet_transactions_source_check'
      AND conrelid = 'public.wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.wallet_transactions DROP CONSTRAINT wallet_transactions_source_check;
  END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ── Deposit rollover helper (redeem validation) ─────────────────────────────
DROP FUNCTION IF EXISTS public.get_deposit_rollover_totals(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.get_deposit_rollover_totals(
  p_user_id UUID,
  p_game_slug TEXT
)
RETURNS TABLE (active_load_amount NUMERIC, redeemed_since_active NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_amount NUMERIC := 0;
  v_active_at TIMESTAMPTZ;
  v_redeemed_since NUMERIC := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT amount, completed_at
  INTO v_active_amount, v_active_at
  FROM public.game_load_requests
  WHERE user_id = p_user_id
    AND game_slug = p_game_slug
    AND wallet_type = 'current'
    AND load_type IN ('load', 'reload')
    AND status = 'completed'
  ORDER BY completed_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF v_active_amount IS NULL OR v_active_amount <= 0 THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_redeemed_since
  FROM public.game_load_requests
  WHERE user_id = p_user_id
    AND game_slug = p_game_slug
    AND wallet_type = 'current'
    AND load_type = 'redeem'
    AND status = 'completed'
    AND (v_active_at IS NULL OR completed_at >= v_active_at);

  RETURN QUERY SELECT v_active_amount, v_redeemed_since;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_deposit_rollover_totals(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_deposit_rollover_totals(UUID, TEXT) TO service_role;

-- ── Queue redeem (pull from game panel → pending bot job) ─────────────────────
DROP FUNCTION IF EXISTS public.request_game_redeem(TEXT, TEXT, NUMERIC, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.request_game_redeem(TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.request_game_redeem(
  p_game_slug TEXT,
  p_game_name TEXT,
  p_amount NUMERIC,
  p_game_username TEXT,
  p_redeem_all BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_game_username IS NULL OR trim(p_game_username) = '' THEN
    RAISE EXCEPTION 'Game username required for redeem';
  END IF;

  IF NOT p_redeem_all AND (p_amount IS NULL OR p_amount <= 0) THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.game_load_requests
    WHERE user_id = v_user_id AND game_slug = p_game_slug
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'A request is already in progress for this game';
  END IF;

  INSERT INTO public.game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type,
    game_username, redeem_all, status
  )
  VALUES (
    v_user_id,
    p_game_slug,
    p_game_name,
    CASE WHEN p_redeem_all THEN 0 ELSE p_amount END,
    'current',
    'redeem',
    NULLIF(trim(p_game_username), ''),
    p_redeem_all,
    'pending'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_game_redeem(TEXT, TEXT, NUMERIC, TEXT, BOOLEAN) TO authenticated;

-- ── Bot completion: credit cashout_wallet on successful redeem ────────────────
DROP FUNCTION IF EXISTS public.complete_game_load(UUID, BOOLEAN, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.complete_game_load(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.complete_game_load(
  p_request_id UUID,
  p_success BOOLEAN,
  p_game_username TEXT DEFAULT NULL,
  p_game_password TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_redeemed_amount NUMERIC DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
  v_credit NUMERIC;
  v_dest_wallet TEXT;
  v_game_id UUID;
BEGIN
  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE id = p_request_id
    AND status IN ('pending', 'processing')
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN;
  END IF;

  v_game_id := public.game_id_for_slug(v_row.game_slug);

  -- Refund failed loads (debit happened at queue time for load/reload)
  IF NOT p_success AND v_row.load_type IN ('load', 'reload') AND COALESCE(v_row.amount, 0) > 0 THEN
    PERFORM set_config('app.wallet_update', 'true', true);
    IF v_row.wallet_type = 'bonus' THEN
      UPDATE public.profiles SET bonus_wallet = bonus_wallet + v_row.amount WHERE id = v_row.user_id;
    ELSE
      UPDATE public.profiles SET wallet_balance = wallet_balance + v_row.amount WHERE id = v_row.user_id;
    END IF;
    INSERT INTO public.wallet_transactions (
      user_id, amount, wallet_type, transaction_type, source, description, created_by
    )
    VALUES (
      v_row.user_id, v_row.amount, v_row.wallet_type, 'credit', 'game_load_refund',
      format('Refund failed load $%s to %s', v_row.amount, v_row.game_name), v_row.user_id
    );
  END IF;

  IF p_success AND v_row.load_type = 'redeem' THEN
    v_credit := COALESCE(p_redeemed_amount, NULLIF(v_row.amount, 0));
    IF v_credit IS NULL OR v_credit <= 0 THEN
      RAISE EXCEPTION 'Redeem completion requires a positive amount';
    END IF;

    v_dest_wallet := CASE WHEN v_row.wallet_type = 'bonus' THEN 'bonus_redeem' ELSE 'cashout' END;

    PERFORM set_config('app.wallet_update', 'true', true);

    IF v_dest_wallet = 'bonus_redeem' THEN
      UPDATE public.profiles
      SET bonus_redeem_wallet = bonus_redeem_wallet + v_credit
      WHERE id = v_row.user_id;
    ELSE
      UPDATE public.profiles
      SET cashout_wallet = cashout_wallet + v_credit
      WHERE id = v_row.user_id;
    END IF;

    INSERT INTO public.wallet_transactions (
      user_id, amount, wallet_type, transaction_type, source, description, created_by
    )
    VALUES (
      v_row.user_id,
      v_credit,
      v_dest_wallet,
      'credit',
      'game_redeem',
      format('Redeem $%s from %s', v_credit, v_row.game_name),
      v_row.user_id
    );

    IF v_game_id IS NOT NULL THEN
      UPDATE public.game_accounts
      SET credits_balance = GREATEST(0, credits_balance - v_credit),
          last_synced_at = NOW(),
          updated_at = NOW()
      WHERE user_id = v_row.user_id AND game_id = v_game_id;
    ELSIF to_regclass('public.game_accounts') IS NOT NULL AND v_row.game_username IS NOT NULL THEN
      UPDATE public.game_accounts
      SET credits_balance = GREATEST(0, credits_balance - v_credit),
          last_synced_at = NOW(),
          updated_at = NOW()
      WHERE user_id = v_row.user_id AND game_username = v_row.game_username;
    END IF;
  END IF;

  IF p_success AND v_row.load_type = 'check_balance' AND p_redeemed_amount IS NOT NULL THEN
    IF v_game_id IS NOT NULL THEN
      UPDATE public.game_accounts
      SET credits_balance = p_redeemed_amount, last_synced_at = NOW(), updated_at = NOW()
      WHERE user_id = v_row.user_id AND game_id = v_game_id;
    ELSIF to_regclass('public.game_accounts') IS NOT NULL AND v_row.game_username IS NOT NULL THEN
      UPDATE public.game_accounts
      SET credits_balance = p_redeemed_amount, last_synced_at = NOW(), updated_at = NOW()
      WHERE user_id = v_row.user_id AND game_username = v_row.game_username;
    END IF;
  END IF;

  UPDATE public.game_load_requests
  SET
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    game_username = COALESCE(p_game_username, game_username),
    game_password = COALESCE(p_game_password, game_password),
    amount = CASE
      WHEN p_success AND v_row.load_type = 'redeem' THEN COALESCE(p_redeemed_amount, amount)
      WHEN p_success AND v_row.load_type = 'check_balance' THEN COALESCE(p_redeemed_amount, amount)
      ELSE amount
    END,
    error_message = p_error_message,
    completed_at = CASE WHEN p_success THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_game_load(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC) TO service_role;

-- ── Admin cash-out payout (debit Deposit Redeem / cashout_wallet) ─────────────
DROP FUNCTION IF EXISTS public.admin_payout_cashout(UUID, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.admin_payout_cashout(
  p_user UUID,
  p_amount NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bal NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payout amount must be positive';
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);

  UPDATE public.profiles
  SET cashout_wallet = cashout_wallet - p_amount
  WHERE id = p_user AND cashout_wallet >= p_amount
  RETURNING cashout_wallet INTO v_bal;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient cash-out balance';
  END IF;

  INSERT INTO public.wallet_transactions (
    user_id, amount, wallet_type, transaction_type, source, description, created_by
  )
  VALUES (
    p_user,
    p_amount,
    'cashout',
    'debit',
    'payout',
    COALESCE(NULLIF(trim(p_note), ''), 'Cash-out payout'),
    p_user
  );

  RETURN v_bal;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_payout_cashout(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_payout_cashout(UUID, NUMERIC, TEXT) TO service_role;

-- ── Bot claim next pending job (required for redeem/load bots) ────────────────
CREATE OR REPLACE FUNCTION public.claim_next_game_load(p_game_slug TEXT)
RETURNS SETOF public.game_load_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
BEGIN
  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE game_slug = p_game_slug AND status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_row.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.game_load_requests
  SET status = 'processing',
      bot_attempts = COALESCE(bot_attempts, 0) + 1,
      updated_at = NOW()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN NEXT v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_next_game_load(TEXT) TO service_role;
