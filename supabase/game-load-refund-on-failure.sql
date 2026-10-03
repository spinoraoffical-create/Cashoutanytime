-- Refund Spinora wallet when a game load fails, is cancelled, or times out.
-- Wallet is debited at queue time (request_game_load); this puts it back if the bot fails.
-- Run in Supabase SQL Editor after game-load-split-flow.sql and redeem-wallets-and-balance-check.sql

ALTER TABLE public.game_load_requests
  ADD COLUMN IF NOT EXISTS wallet_refunded BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.refund_game_load_wallet(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
BEGIN
  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN;
  END IF;

  IF v_row.wallet_refunded THEN
    RETURN;
  END IF;

  IF v_row.load_type NOT IN ('load', 'reload') THEN
    RETURN;
  END IF;

  IF COALESCE(v_row.amount, 0) <= 0 THEN
    RETURN;
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);

  IF v_row.wallet_type = 'bonus' THEN
    UPDATE public.profiles
    SET bonus_wallet = bonus_wallet + v_row.amount
    WHERE id = v_row.user_id;
  ELSE
    UPDATE public.profiles
    SET wallet_balance = wallet_balance + v_row.amount
    WHERE id = v_row.user_id;
  END IF;

  INSERT INTO public.wallet_transactions (
    user_id, amount, wallet_type, transaction_type, source, description, created_by
  )
  VALUES (
    v_row.user_id,
    v_row.amount,
    v_row.wallet_type,
    'credit',
    'game_load_refund',
    format('Refund failed load $%s to %s', v_row.amount, v_row.game_name),
    v_row.user_id
  );

  UPDATE public.game_load_requests
  SET wallet_refunded = true, updated_at = NOW()
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_game_load_wallet(UUID) TO service_role;

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
BEGIN
  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE id = p_request_id
    AND status IN ('pending', 'processing')
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN;
  END IF;

  IF NOT p_success AND v_row.load_type IN ('load', 'reload') THEN
    PERFORM public.refund_game_load_wallet(p_request_id);
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

CREATE OR REPLACE FUNCTION public.fail_stale_game_loads(
  p_stale_minutes INTEGER DEFAULT 15,
  p_user_id UUID DEFAULT NULL,
  p_game_slug TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_row public.game_load_requests;
BEGIN
  FOR v_row IN
    SELECT *
    FROM public.game_load_requests
    WHERE status IN ('pending', 'processing')
      AND updated_at < NOW() - make_interval(mins => GREATEST(p_stale_minutes, 5))
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND (p_game_slug IS NULL OR game_slug = p_game_slug)
    FOR UPDATE
  LOOP
    IF v_row.load_type IN ('load', 'reload') THEN
      PERFORM public.refund_game_load_wallet(v_row.id);
    END IF;

    UPDATE public.game_load_requests
    SET
      status = 'failed',
      error_message = COALESCE(
        NULLIF(trim(error_message), ''),
        'Timed out waiting for the game bot. Restart the bot on your PC, then try again.'
      ),
      updated_at = NOW()
    WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fail_stale_game_loads(INTEGER, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fail_stale_game_loads(INTEGER, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_my_game_load(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE id = p_request_id
    AND user_id = auth.uid()
    AND status IN ('pending', 'processing')
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Request not found or already finished';
  END IF;

  IF v_row.load_type IN ('load', 'reload') THEN
    PERFORM public.refund_game_load_wallet(p_request_id);
  END IF;

  UPDATE public.game_load_requests
  SET
    status = 'cancelled',
    error_message = COALESCE(
      NULLIF(trim(error_message), ''),
      'Cancelled — you can start a new request.'
    ),
    updated_at = NOW()
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_my_game_load(UUID) TO authenticated;
