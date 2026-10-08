-- Game load and redeem use the signed-in player's game_accounts row.
-- fail_stale_game_loads is service-role only.

DROP FUNCTION IF EXISTS public.request_game_load(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.request_game_load(TEXT, TEXT, NUMERIC, TEXT, TEXT);

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

DROP FUNCTION IF EXISTS public.request_game_redeem(TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.request_game_redeem(TEXT, TEXT, NUMERIC, TEXT, BOOLEAN);

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

DROP FUNCTION IF EXISTS public.request_game_check_balance(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.request_game_check_balance(
  p_game_slug TEXT,
  p_game_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_id UUID;
  v_game_username TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT ga.game_username INTO v_game_username
  FROM public.game_accounts ga
  WHERE ga.user_id = v_user
    AND ga.game_id = public.game_id_for_slug(p_game_slug)
  LIMIT 1;
  IF v_game_username IS NULL OR trim(v_game_username) = '' THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.game_load_requests
    WHERE user_id = v_user AND game_slug = p_game_slug AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'A request is already in progress for this game';
  END IF;

  INSERT INTO public.game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type, game_username, status
  )
  VALUES (
    v_user, p_game_slug, p_game_name, 0, 'current', 'check_balance', trim(v_game_username), 'pending'
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_game_check_balance(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_game_check_balance(TEXT, TEXT) TO authenticated;

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
  v_now TIMESTAMPTZ := NOW();
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

  IF p_success THEN
    IF v_row.load_type IN ('create_account', 'new_account') AND v_game_id IS NOT NULL THEN
      INSERT INTO public.game_accounts (
        user_id, game_id, game_username, game_password, credits_balance, last_synced_at, updated_at
      )
      VALUES (
        v_row.user_id,
        v_game_id,
        COALESCE(p_game_username, v_row.game_username, 'player'),
        COALESCE(p_game_password, v_row.game_password),
        0,
        v_now,
        v_now
      )
      ON CONFLICT (user_id, game_id) DO UPDATE
        SET game_username = EXCLUDED.game_username,
            game_password = COALESCE(EXCLUDED.game_password, game_accounts.game_password),
            updated_at = v_now;

    ELSIF v_row.load_type IN ('load', 'reload') AND v_game_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.game_accounts ga
        WHERE ga.user_id = v_row.user_id
          AND ga.game_id = v_game_id
          AND lower(ga.game_username) = lower(coalesce(v_row.game_username, ''))
      ) THEN
        RAISE EXCEPTION 'Account not found';
      END IF;
      UPDATE public.game_accounts
      SET credits_balance = credits_balance + COALESCE(v_row.amount, 0),
          last_synced_at = v_now,
          updated_at = v_now
      WHERE user_id = v_row.user_id AND game_id = v_game_id;

    ELSIF v_row.load_type = 'redeem' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.game_accounts ga
        WHERE ga.user_id = v_row.user_id
          AND (v_game_id IS NULL OR ga.game_id = v_game_id)
          AND lower(ga.game_username) = lower(coalesce(v_row.game_username, ''))
      ) THEN
        RAISE EXCEPTION 'Account not found';
      END IF;

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
        v_row.user_id, v_credit, v_dest_wallet, 'credit', 'game_redeem',
        format('Redeem $%s from %s', v_credit, v_row.game_name), v_row.user_id
      );

      UPDATE public.game_accounts
      SET credits_balance = GREATEST(0, credits_balance - v_credit),
          last_synced_at = v_now,
          updated_at = v_now
      WHERE user_id = v_row.user_id
        AND (v_game_id IS NULL OR game_id = v_game_id)
        AND lower(game_username) = lower(v_row.game_username);

    ELSIF v_row.load_type = 'check_balance' AND p_redeemed_amount IS NOT NULL THEN
      UPDATE public.game_accounts
      SET credits_balance = p_redeemed_amount, last_synced_at = v_now, updated_at = v_now
      WHERE user_id = v_row.user_id
        AND (v_game_id IS NULL OR game_id = v_game_id);
    END IF;
  END IF;

  UPDATE public.game_load_requests
  SET
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    game_username = CASE
      WHEN v_row.load_type IN ('load', 'reload', 'redeem', 'check_balance') THEN game_username
      ELSE COALESCE(p_game_username, game_username)
    END,
    game_password = COALESCE(p_game_password, game_password),
    amount = CASE
      WHEN p_success AND v_row.load_type IN ('redeem', 'check_balance') THEN COALESCE(p_redeemed_amount, amount)
      ELSE amount
    END,
    error_message = p_error_message,
    completed_at = CASE WHEN p_success THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_game_load(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_game_load(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC) TO service_role;

CREATE OR REPLACE FUNCTION public.fail_stale_game_loads(
  p_stale_minutes integer DEFAULT 15,
  p_user_id uuid DEFAULT NULL,
  p_game_slug text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_row public.game_load_requests;
BEGIN
  FOR v_row IN
    SELECT * FROM public.game_load_requests
    WHERE status IN ('pending', 'processing')
      AND updated_at < now() - make_interval(mins => greatest(p_stale_minutes, 5))
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND (p_game_slug IS NULL OR game_slug = p_game_slug)
    FOR UPDATE
  LOOP
    IF v_row.load_type IN ('load', 'reload') THEN
      BEGIN
        PERFORM public.refund_game_load_wallet(v_row.id);
      EXCEPTION WHEN undefined_function THEN
        NULL;
      END;
    END IF;
    UPDATE public.game_load_requests
      SET status = 'failed',
          error_message = COALESCE(NULLIF(trim(error_message), ''),
            'Timed out waiting for the game bot. Restart the bot on your PC, then try again.'),
          updated_at = now()
      WHERE id = v_row.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_stale_game_loads(integer, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_stale_game_loads(integer, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.fail_my_stale_game_load(
  p_stale_minutes integer DEFAULT 15,
  p_game_slug text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  RETURN public.fail_stale_game_loads(p_stale_minutes, v_user, p_game_slug);
END;
$$;

REVOKE ALL ON FUNCTION public.fail_my_stale_game_load(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fail_my_stale_game_load(integer, text) TO authenticated;
