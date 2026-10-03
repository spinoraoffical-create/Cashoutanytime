-- Remove bonus wallet balances (zero out) and block new bonus-wallet game loads/redeems.
-- Spin prizes and game loads use Total Deposit only after app deploy.
-- Run in Supabase SQL Editor.

-- 1. Zero all bonus wallet balances
UPDATE profiles
SET bonus_wallet = 0,
    bonus_redeem_wallet = 0
WHERE bonus_wallet <> 0 OR bonus_redeem_wallet <> 0;

-- 2. Game loads: Total Deposit only
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
  v_min_load NUMERIC := 5;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_load_type NOT IN ('new_account', 'reload', 'create_account', 'load') THEN
    RAISE EXCEPTION 'Invalid load type';
  END IF;

  IF p_load_type = 'create_account' THEN
    IF p_amount <> 0 THEN
      RAISE EXCEPTION 'Create account does not charge wallet';
    END IF;

    IF EXISTS (
      SELECT 1 FROM game_load_requests
      WHERE user_id = v_user_id AND game_slug = p_game_slug
        AND load_type = 'create_account'
        AND status IN ('pending', 'processing')
    ) THEN
      RAISE EXCEPTION 'Account creation already in progress';
    END IF;

    INSERT INTO game_load_requests (
      user_id, game_slug, game_name, amount, wallet_type, load_type, game_username, status
    )
    VALUES (
      v_user_id, p_game_slug, p_game_name, 0, 'current', 'create_account', NULL, 'pending'
    )
    RETURNING id INTO v_request_id;

    RETURN v_request_id;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_amount < v_min_load THEN
    RAISE EXCEPTION 'Minimum load amount is $5';
  END IF;

  IF p_wallet_type <> 'current' THEN
    RAISE EXCEPTION 'Loads must use Total Deposit wallet';
  END IF;

  IF p_load_type IN ('reload', 'load') AND (p_game_username IS NULL OR trim(p_game_username) = '') THEN
    RAISE EXCEPTION 'Game username required for load';
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);

  SELECT wallet_balance INTO v_balance FROM profiles WHERE id = v_user_id FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;
  UPDATE profiles SET wallet_balance = wallet_balance - p_amount WHERE id = v_user_id;

  INSERT INTO wallet_transactions (user_id, amount, wallet_type, transaction_type, source, description, created_by)
  VALUES (
    v_user_id,
    p_amount,
    'current',
    'debit',
    'game_load',
    'Load to ' || p_game_name,
    v_user_id
  );

  INSERT INTO game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type, game_username, status
  )
  VALUES (
    v_user_id,
    p_game_slug,
    p_game_name,
    p_amount,
    'current',
    p_load_type,
    NULLIF(trim(p_game_username), ''),
    'pending'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- 3. Game redeems: Deposit Redeem only (3x / 8x)
CREATE OR REPLACE FUNCTION public.request_game_redeem(
  p_game_slug TEXT,
  p_game_name TEXT,
  p_amount NUMERIC,
  p_game_username TEXT,
  p_redeem_all BOOLEAN DEFAULT false,
  p_wallet_type TEXT DEFAULT 'current'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request_id UUID;
  v_min_redeem NUMERIC := 5;
  v_active_load NUMERIC;
  v_redeemed_since NUMERIC;
  v_max_remaining NUMERIC;
  v_min_game_balance NUMERIC;
  v_last_balance NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_game_username IS NULL OR trim(p_game_username) = '' THEN
    RAISE EXCEPTION 'Game username required for redeem';
  END IF;

  IF p_wallet_type <> 'current' THEN
    RAISE EXCEPTION 'Redeems go to Deposit Redeem wallet only';
  END IF;

  IF NOT p_redeem_all AND (p_amount IS NULL OR p_amount <= 0) THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF NOT p_redeem_all AND p_amount < v_min_redeem THEN
    RAISE EXCEPTION 'Minimum redeem amount is $5';
  END IF;

  IF EXISTS (
    SELECT 1 FROM game_load_requests
    WHERE user_id = v_user_id AND game_slug = p_game_slug
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'A request is already in progress for this game';
  END IF;

  SELECT active_load_amount, redeemed_since_active
  INTO v_active_load, v_redeemed_since
  FROM public.get_deposit_rollover_totals(v_user_id, p_game_slug);

  IF COALESCE(v_active_load, 0) <= 0 THEN
    RAISE EXCEPTION 'Load credits from Total Deposit into this game before redeeming.';
  END IF;

  v_min_game_balance := v_active_load * 3;
  v_max_remaining := GREATEST(0, v_active_load * 8 - v_redeemed_since);

  SELECT amount INTO v_last_balance
  FROM game_load_requests
  WHERE user_id = v_user_id
    AND game_slug = p_game_slug
    AND load_type = 'check_balance'
    AND status = 'completed'
  ORDER BY completed_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF v_last_balance IS NULL OR v_last_balance < v_min_game_balance THEN
    RAISE EXCEPTION
      'Need at least $% in game (3x your $% deposit). Check your live game balance first.',
      v_min_game_balance,
      v_active_load;
  END IF;

  IF v_max_remaining <= 0 THEN
    RAISE EXCEPTION 'You have reached the 8x redeem limit for this deposit';
  END IF;

  IF NOT p_redeem_all AND p_amount > v_max_remaining THEN
    RAISE EXCEPTION 'Maximum redeem is $% (8x this deposit minus prior redeems)', v_max_remaining;
  END IF;

  INSERT INTO game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type, game_username, redeem_all, status
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

GRANT EXECUTE ON FUNCTION public.request_game_redeem(TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, TEXT) TO authenticated;

-- 4. Freeplay message (spin only — daily tasks removed)
CREATE OR REPLACE FUNCTION public.assert_freeplay_allowed(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suspended BOOLEAN;
  v_blocked BOOLEAN;
  v_rewards_blocked BOOLEAN;
  v_risk SMALLINT;
BEGIN
  SELECT is_suspended INTO v_suspended FROM public.profiles WHERE id = p_user_id;
  IF COALESCE(v_suspended, false) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'suspended',
      'message', 'Your account is suspended. Contact support.'
    );
  END IF;

  SELECT blocked, rewards_blocked, risk_score
  INTO v_blocked, v_rewards_blocked, v_risk
  FROM public.fraud_scores
  WHERE user_id = p_user_id;

  IF COALESCE(v_blocked, false) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'blocked',
      'message', 'This account cannot claim free rewards. Contact support.'
    );
  END IF;

  IF COALESCE(v_rewards_blocked, false) OR COALESCE(v_risk, 0) >= 50 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rewards_blocked',
      'message', 'Free spin rewards are not available on this account. Make a deposit or contact support.'
    );
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_freeplay_allowed TO service_role;
