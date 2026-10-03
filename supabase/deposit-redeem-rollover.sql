-- Deposit-wallet redeem rollover: 3x min / 8x max per individual deposit load (not summed).
-- Run in Supabase SQL Editor after game-load-minimum-5.sql

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
  FROM game_load_requests
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
  FROM game_load_requests
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

  IF p_wallet_type NOT IN ('current', 'bonus') THEN
    RAISE EXCEPTION 'Invalid wallet type';
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

  IF p_wallet_type = 'current' THEN
    SELECT active_load_amount, redeemed_since_active
    INTO v_active_load, v_redeemed_since
    FROM public.get_deposit_rollover_totals(v_user_id, p_game_slug);

    IF v_active_load > 0 THEN
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
    END IF;
  END IF;

  INSERT INTO game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type, game_username, redeem_all, status
  )
  VALUES (
    v_user_id,
    p_game_slug,
    p_game_name,
    CASE WHEN p_redeem_all THEN 0 ELSE p_amount END,
    p_wallet_type,
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
