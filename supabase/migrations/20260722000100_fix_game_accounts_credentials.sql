-- Migration: 20260722000100_fix_game_accounts_credentials.sql
-- Adds game_password support to game_accounts and updates complete_game_load RPC

DO $$
BEGIN
  IF to_regclass('public.game_accounts') IS NOT NULL THEN
    ALTER TABLE public.game_accounts ADD COLUMN IF NOT EXISTS game_password TEXT;
  END IF;
END $$;

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

  IF p_success THEN
    -- Account Creation / New Account Insertion into game_accounts
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
      UPDATE public.game_accounts
      SET credits_balance = credits_balance + COALESCE(v_row.amount, 0),
          last_synced_at = v_now,
          updated_at = v_now
      WHERE user_id = v_row.user_id AND game_id = v_game_id;

    ELSIF v_row.load_type = 'redeem' THEN
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
            last_synced_at = v_now,
            updated_at = v_now
        WHERE user_id = v_row.user_id AND game_id = v_game_id;
      ELSIF to_regclass('public.game_accounts') IS NOT NULL AND v_row.game_username IS NOT NULL THEN
        UPDATE public.game_accounts
        SET credits_balance = GREATEST(0, credits_balance - v_credit),
            last_synced_at = v_now,
            updated_at = v_now
        WHERE user_id = v_row.user_id AND game_username = v_row.game_username;
      END IF;

    ELSIF v_row.load_type = 'check_balance' AND p_redeemed_amount IS NOT NULL THEN
      IF v_game_id IS NOT NULL THEN
        UPDATE public.game_accounts
        SET credits_balance = p_redeemed_amount, last_synced_at = v_now, updated_at = v_now
        WHERE user_id = v_row.user_id AND game_id = v_game_id;
      ELSIF to_regclass('public.game_accounts') IS NOT NULL AND v_row.game_username IS NOT NULL THEN
        UPDATE public.game_accounts
        SET credits_balance = p_redeemed_amount, last_synced_at = v_now, updated_at = v_now
        WHERE user_id = v_row.user_id AND game_username = v_row.game_username;
      END IF;
    END IF;
  END IF;

  UPDATE public.game_load_requests
  SET
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    game_username = COALESCE(p_game_username, game_username),
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

GRANT EXECUTE ON FUNCTION public.complete_game_load(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC) TO service_role;
