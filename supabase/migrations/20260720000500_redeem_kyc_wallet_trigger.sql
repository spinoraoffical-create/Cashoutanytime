-- Redeem + KYC + wallet trigger fix (run once in Supabase SQL Editor)
-- Ensures: KYC required for redeem, wallet credits work, bots can complete redeems

-- ── Wallet columns ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cashout_wallet NUMERIC(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'unverified';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bonus_redeem_wallet NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- ── Protect wallet columns (must allow service-role SQL functions to update) ───
CREATE OR REPLACE FUNCTION public.protect_wallet_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    OLD.wallet_balance IS DISTINCT FROM NEW.wallet_balance
    OR OLD.bonus_wallet IS DISTINCT FROM NEW.bonus_wallet
    OR OLD.cashout_wallet IS DISTINCT FROM NEW.cashout_wallet
    OR OLD.bonus_redeem_wallet IS DISTINCT FROM NEW.bonus_redeem_wallet
  ) THEN
    IF current_setting('app.wallet_update', true) = 'true'
       OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RETURN NEW;
    END IF;
    NEW.wallet_balance := OLD.wallet_balance;
    NEW.bonus_wallet := OLD.bonus_wallet;
    NEW.cashout_wallet := OLD.cashout_wallet;
    NEW.bonus_redeem_wallet := OLD.bonus_redeem_wallet;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_wallet_columns_trigger ON public.profiles;
CREATE TRIGGER protect_wallet_columns_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_wallet_columns();

-- ── request_game_redeem with KYC gate ─────────────────────────────────────────
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
  v_kyc TEXT;
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT kyc_status INTO v_kyc FROM public.profiles WHERE id = v_user_id;
  IF v_kyc IS DISTINCT FROM 'verified' THEN
    IF v_kyc = 'pending' THEN
      RAISE EXCEPTION 'KYC under review — admin must approve your ID before redeeming';
    END IF;
    RAISE EXCEPTION 'KYC Verification Required — upload ID at Dashboard → KYC before redeeming';
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
      AND load_type IN ('load', 'reload', 'redeem')
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'A load or redeem is already in progress for this game';
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

-- ── Bot-safe redeem credit (fallback if complete_game_load fails) ─────────────
CREATE OR REPLACE FUNCTION public.credit_redeem_completion(
  p_request_id UUID,
  p_redeemed_amount NUMERIC,
  p_game_username TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
  v_credit NUMERIC;
BEGIN
  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_row.id IS NULL OR v_row.load_type <> 'redeem' THEN
    RAISE EXCEPTION 'Invalid redeem request';
  END IF;

  IF v_row.status = 'completed' THEN
    RETURN;
  END IF;

  v_credit := COALESCE(p_redeemed_amount, NULLIF(v_row.amount, 0));
  IF v_credit IS NULL OR v_credit <= 0 THEN
    RAISE EXCEPTION 'Redeem amount must be positive';
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);

  UPDATE public.profiles
  SET cashout_wallet = cashout_wallet + v_credit
  WHERE id = v_row.user_id;

  INSERT INTO public.wallet_transactions (
    user_id, amount, wallet_type, transaction_type, source, description, created_by
  )
  VALUES (
    v_row.user_id, v_credit, 'cashout', 'credit', 'game_redeem',
    format('Redeem $%s from %s', v_credit, v_row.game_name), v_row.user_id
  );

  UPDATE public.game_load_requests
  SET
    status = 'completed',
    amount = v_credit,
    game_username = COALESCE(p_game_username, game_username),
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_redeem_completion(UUID, NUMERIC, TEXT) TO service_role;
