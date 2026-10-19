-- Player-callable game load and redeem now refuse a paused account, an under-18
-- account, and an active break on loads. Redeem also keeps the deposit cap.
-- One first-deposit quote per player and game. A submitted payout can be
-- refunded once if the provider later rejects it. Reserved failures stay the
-- same. Paid payouts are not refunded.

CREATE OR REPLACE FUNCTION public.assert_player_can_move_money(p_kind TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_suspended BOOLEAN;
  v_dob DATE;
  v_meta JSONB;
  v_until TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(is_suspended, FALSE), date_of_birth
  INTO v_suspended, v_dob
  FROM public.profiles
  WHERE id = v_user;

  IF v_suspended THEN
    RAISE EXCEPTION 'This account is paused. Contact support.';
  END IF;

  IF v_dob IS NULL OR v_dob > (CURRENT_DATE - INTERVAL '18 years') THEN
    RAISE EXCEPTION 'You must be 18 or older.';
  END IF;

  IF p_kind IS DISTINCT FROM 'load' THEN
    RETURN;
  END IF;

  SELECT raw_user_meta_data INTO v_meta FROM auth.users WHERE id = v_user;
  v_until := v_meta #>> '{prefs,selfExcludeUntil}';
  BEGIN
    IF v_until IS NOT NULL AND btrim(v_until) <> '' AND v_until::timestamptz > now() THEN
      RAISE EXCEPTION 'Self-exclusion is on.';
    END IF;
  EXCEPTION
    WHEN invalid_datetime_format OR datetime_field_overflow THEN
      NULL;
  END;

  v_until := v_meta #>> '{prefs,timeoutUntil}';
  BEGIN
    IF v_until IS NOT NULL AND btrim(v_until) <> '' AND v_until::timestamptz > now() THEN
      RAISE EXCEPTION 'A short-term break is on.';
    END IF;
  EXCEPTION
    WHEN invalid_datetime_format OR datetime_field_overflow THEN
      NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_player_can_move_money(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_player_can_move_money(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_game_load(
  p_game_slug TEXT,
  p_game_name TEXT,
  p_amount NUMERIC,
  p_wallet_type TEXT,
  p_load_type TEXT
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
  v_game_username TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.assert_player_can_move_money('load');

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

  IF p_load_type IN ('reload', 'load') THEN
    SELECT ga.game_username INTO v_game_username
    FROM public.game_accounts ga
    WHERE ga.user_id = v_user_id
      AND ga.game_id = public.game_id_for_slug(p_game_slug)
    LIMIT 1;
    IF v_game_username IS NULL OR trim(v_game_username) = '' THEN
      RAISE EXCEPTION 'Account not found';
    END IF;
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
    NULLIF(trim(v_game_username), ''),
    'pending'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_game_load(TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_game_load(TEXT, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_game_redeem(
  p_game_slug TEXT,
  p_game_name TEXT,
  p_amount NUMERIC,
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
  v_game_username TEXT;
  v_active NUMERIC;
  v_redeemed NUMERIC;
  v_remaining NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.assert_player_can_move_money('redeem');

  SELECT kyc_status INTO v_kyc FROM public.profiles WHERE id = v_user_id;
  IF v_kyc IS DISTINCT FROM 'verified' THEN
    IF v_kyc = 'pending' THEN
      RAISE EXCEPTION 'KYC under review — admin must approve your ID before redeeming';
    END IF;
    RAISE EXCEPTION 'KYC Verification Required — upload ID at Dashboard → KYC before redeeming';
  END IF;

  SELECT ga.game_username INTO v_game_username
  FROM public.game_accounts ga
  WHERE ga.user_id = v_user_id
    AND ga.game_id = public.game_id_for_slug(p_game_slug)
  LIMIT 1;
  IF v_game_username IS NULL OR trim(v_game_username) = '' THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF NOT p_redeem_all AND (p_amount IS NULL OR p_amount <= 0) THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT active_load_amount, redeemed_since_active
  INTO v_active, v_redeemed
  FROM public.get_deposit_rollover_totals(v_user_id, p_game_slug);

  v_active := COALESCE(v_active, 0);
  v_redeemed := COALESCE(v_redeemed, 0);
  v_remaining := round((v_active * 8) - v_redeemed, 2);
  IF v_active <= 0 THEN
    RAISE EXCEPTION 'Load credits from Total Deposit into this game before redeeming.';
  END IF;
  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'You have reached the 8x redeem limit for this deposit.';
  END IF;
  IF NOT COALESCE(p_redeem_all, FALSE) AND round(p_amount, 2) > v_remaining THEN
    RAISE EXCEPTION 'Maximum redeem is the 8x limit for this deposit.';
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
    trim(v_game_username),
    p_redeem_all,
    'pending'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_game_redeem(TEXT, TEXT, NUMERIC, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_game_redeem(TEXT, TEXT, NUMERIC, BOOLEAN) TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_one_first_deposit
  ON public.payment_intents (user_id, game_slug)
  WHERE deposit_kind = 'first' AND final_credit IS NOT NULL;

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

  IF v_row.status = 'paid' THEN
    RETURN jsonb_build_object('refunded', false, 'duplicate', true, 'status', 'paid');
  END IF;

  IF v_row.status = 'failed' THEN
    RETURN jsonb_build_object('refunded', false, 'duplicate', true, 'status', 'failed');
  END IF;

  IF v_row.status NOT IN ('reserved', 'submitted') THEN
    RETURN jsonb_build_object('refunded', false, 'duplicate', false, 'status', v_row.status);
  END IF;

  v_void := public.credit_cashout_payout_void(p_user_id, v_row.amount, v_row.idempotency_key);

  UPDATE public.paydora_payout_requests
  SET status = 'failed', updated_at = now()
  WHERE id = v_row.id AND status IN ('reserved', 'submitted');

  RETURN jsonb_build_object(
    'refunded', COALESCE((v_void->>'credited')::boolean, FALSE),
    'duplicate', COALESCE((v_void->>'duplicate')::boolean, FALSE),
    'status', 'failed'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fail_paydora_payout(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_paydora_payout(UUID, TEXT) TO service_role;
