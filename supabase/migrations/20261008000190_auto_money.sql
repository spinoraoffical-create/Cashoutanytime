-- Automatic loads, redeems, and cash-outs. Staff money moves stay in complete_game_load.

ALTER TABLE public.game_load_requests
  ADD COLUMN IF NOT EXISTS game_api_debited boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF to_regclass('public.paydora_processed_events') IS NOT NULL THEN
    ALTER TABLE public.paydora_processed_events ADD COLUMN IF NOT EXISTS unpaid_remainder numeric;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.mark_game_api_debited(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.game_load_requests
  SET game_api_debited = true, updated_at = now()
  WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_game_api_debited(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_game_api_debited(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.refund_game_load_wallet(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
BEGIN
  SELECT * INTO v_row FROM public.game_load_requests WHERE id = p_request_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.wallet_refunded THEN
    RETURN;
  END IF;
  IF COALESCE(v_row.game_api_debited, false) THEN
    RETURN;
  END IF;
  IF v_row.load_type NOT IN ('load', 'reload') OR COALESCE(v_row.amount, 0) <= 0 THEN
    RETURN;
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);
  UPDATE public.profiles
  SET wallet_balance = wallet_balance + v_row.amount
  WHERE id = v_row.user_id;

  IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
    INSERT INTO public.wallet_transactions (
      user_id, amount, wallet_type, transaction_type, source, description, created_by
    ) VALUES (
      v_row.user_id, v_row.amount, 'current', 'credit', 'game_load_refund',
      format('Refund failed load $%s to %s', v_row.amount, v_row.game_name), v_row.user_id
    );
  END IF;

  UPDATE public.game_load_requests
  SET wallet_refunded = true, updated_at = now()
  WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_game_load_wallet(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_game_load_wallet(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_my_game_load(p_request_id uuid)
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
  SELECT * INTO v_row FROM public.game_load_requests
  WHERE id = p_request_id AND user_id = auth.uid() AND status IN ('pending', 'processing')
  FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Request not found or already finished';
  END IF;
  IF v_row.load_type IN ('load', 'reload') THEN
    PERFORM public.refund_game_load_wallet(p_request_id);
  END IF;
  UPDATE public.game_load_requests
  SET status = 'cancelled',
      error_message = COALESCE(NULLIF(trim(error_message), ''), 'Cancelled — you can start a new request.'),
      updated_at = now()
  WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_my_game_load(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_game_load(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_game_load_service(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  SELECT * INTO v_row FROM public.game_load_requests
  WHERE id = p_request_id AND status IN ('pending', 'processing')
  FOR UPDATE;
  IF v_row.id IS NULL THEN
    RETURN;
  END IF;
  IF v_row.load_type IN ('load', 'reload') THEN
    PERFORM public.refund_game_load_wallet(p_request_id);
  END IF;
  UPDATE public.game_load_requests
  SET status = 'cancelled',
      error_message = COALESCE(NULLIF(trim(error_message), ''), 'Cancelled.'),
      updated_at = now()
  WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_game_load_service(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_game_load_service(uuid) TO service_role;

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

  IF NOT p_success AND v_row.load_type IN ('load', 'reload') THEN
    PERFORM public.refund_game_load_wallet(p_request_id);
  END IF;

  IF p_success THEN
    IF v_row.load_type IN ('load', 'reload', 'redeem') THEN
      UPDATE public.game_load_requests
      SET game_api_debited = true
      WHERE id = p_request_id;
    END IF;

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

CREATE OR REPLACE FUNCTION public.request_game_account_create(
  p_game_slug TEXT,
  p_game_name TEXT,
  p_username TEXT DEFAULT NULL,
  p_password TEXT DEFAULT NULL,
  p_replace BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request_id UUID;
  v_username TEXT := NULLIF(trim(p_username), '');
  v_password TEXT := NULLIF(p_password, '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.fail_stale_game_loads(15, v_user_id, p_game_slug);

  IF EXISTS (
    SELECT 1 FROM public.game_load_requests
    WHERE user_id = v_user_id AND game_slug = p_game_slug
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'A request is already in progress for this game. Cancel it under Recent activity, or wait for the bot.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.game_load_requests
    WHERE user_id = v_user_id
      AND game_slug = p_game_slug
      AND status = 'completed'
      AND load_type IN ('create_account', 'new_account')
      AND game_username IS NOT NULL
  ) AND NOT COALESCE(p_replace, FALSE) THEN
    RAISE EXCEPTION 'You already have a game account. Use Replace Account to get new login details.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.game_load_requests
    WHERE user_id = v_user_id
      AND game_slug = p_game_slug
      AND status = 'completed'
      AND load_type IN ('create_account', 'new_account')
      AND game_username IS NOT NULL
  ) AND COALESCE(p_replace, FALSE) THEN
    RAISE EXCEPTION 'No account to replace yet. Create your first account instead.';
  END IF;

  IF v_username IS NOT NULL AND v_password IS NULL THEN
    RAISE EXCEPTION 'Password required when choosing a custom username';
  END IF;

  INSERT INTO public.game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type, game_username, game_password, status, admin_notes
  )
  VALUES (
    v_user_id, p_game_slug, p_game_name, 0, 'current', 'create_account', v_username, v_password, 'pending',
    CASE WHEN COALESCE(p_replace, FALSE) THEN 'account_replace' ELSE NULL END
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_game_account_create(TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_game_account_create(TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.debit_paydora_payout(
  p_user_id UUID,
  p_amount NUMERIC,
  p_payout_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
  v_key TEXT;
  v_balance NUMERIC;
BEGIN
  v_key := nullif(trim(p_payout_key), '');
  IF p_user_id IS NULL OR v_key IS NULL THEN
    RAISE EXCEPTION 'user_id and payout_key required';
  END IF;
  IF v_key LIKE 'refund:%' THEN
    RAISE EXCEPTION 'invalid payout key';
  END IF;

  v_amount := round(p_amount::numeric, 2);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  INSERT INTO public.paydora_processed_events (payment_id, user_id, amount, direction)
  VALUES (v_key, p_user_id, v_amount, 'debit');

  PERFORM set_config('app.wallet_update', 'true', true);

  UPDATE public.profiles
  SET cashout_wallet = cashout_wallet - v_amount
  WHERE id = p_user_id AND cashout_wallet >= v_amount
  RETURNING cashout_wallet INTO v_balance;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient funds' USING ERRCODE = 'P0001';
  END IF;

  IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
    INSERT INTO public.wallet_transactions (
      user_id, amount, wallet_type, transaction_type, source, description, created_by
    ) VALUES (
      p_user_id, v_amount, 'cashout', 'debit', 'withdrawal',
      format('Paydora payout $%s (%s)', v_amount, v_key),
      p_user_id
    );
  END IF;

  RETURN jsonb_build_object('debited', true, 'duplicate', false, 'new_balance', v_balance);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('debited', false, 'duplicate', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_cashout_payout_void(
  p_user_id UUID,
  p_amount NUMERIC,
  p_payout_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
  v_key TEXT;
  v_balance NUMERIC;
BEGIN
  v_key := 'payout-void:' || nullif(trim(p_payout_key), '');
  IF p_user_id IS NULL OR v_key = 'payout-void:' OR v_key LIKE 'refund:%' THEN
    RAISE EXCEPTION 'invalid payout void';
  END IF;
  v_amount := round(p_amount::numeric, 2);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  INSERT INTO public.paydora_processed_events (payment_id, user_id, amount, direction, order_id)
  VALUES (v_key, p_user_id, v_amount, 'credit', p_payout_key);

  PERFORM set_config('app.wallet_update', 'true', true);
  UPDATE public.profiles
  SET cashout_wallet = cashout_wallet + v_amount
  WHERE id = p_user_id
  RETURNING cashout_wallet INTO v_balance;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
    INSERT INTO public.wallet_transactions (
      user_id, amount, wallet_type, transaction_type, source, description, created_by
    ) VALUES (
      p_user_id, v_amount, 'cashout', 'credit', 'withdrawal',
      format('Paydora payout returned $%s (%s)', v_amount, v_key),
      p_user_id
    );
  END IF;

  RETURN jsonb_build_object('credited', true, 'duplicate', false, 'new_balance', v_balance);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('credited', false, 'duplicate', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_paydora_deposit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_payment_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
  v_key TEXT;
  v_before NUMERIC;
  v_applied NUMERIC;
  v_unpaid NUMERIC;
  v_balance NUMERIC;
BEGIN
  v_key := 'refund:' || nullif(trim(p_payment_id), '');
  IF p_user_id IS NULL OR v_key = 'refund:' THEN
    RAISE EXCEPTION 'user_id and payment_id required';
  END IF;

  v_amount := round(p_amount::numeric, 2);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  INSERT INTO public.paydora_processed_events (payment_id, user_id, amount, direction, order_id)
  VALUES (v_key, p_user_id, v_amount, 'debit', p_payment_id);

  PERFORM set_config('app.wallet_update', 'true', true);

  SELECT wallet_balance INTO v_before
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  v_applied := round(LEAST(GREATEST(v_before, 0), v_amount), 2);
  v_unpaid := round(v_amount - v_applied, 2);

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - v_applied
  WHERE id = p_user_id
  RETURNING wallet_balance INTO v_balance;

  UPDATE public.paydora_processed_events
  SET unpaid_remainder = v_unpaid
  WHERE payment_id = v_key;

  IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
    INSERT INTO public.wallet_transactions (
      user_id, amount, wallet_type, transaction_type, source, description, created_by
    ) VALUES (
      p_user_id, v_amount, 'current', 'debit', 'deposit',
      format('Paydora refund $%s applied $%s unpaid $%s (%s)', v_amount, v_applied, v_unpaid, v_key),
      NULL
    );
  END IF;

  IF to_regclass('public.deposit_requests') IS NOT NULL THEN
    UPDATE public.deposit_requests
    SET status = 'rejected', admin_notes = 'Paydora refunded this deposit'
    WHERE proof_url = format('paydora/%s', p_payment_id);
  END IF;

  RETURN jsonb_build_object(
    'reversed', true,
    'duplicate', false,
    'new_balance', v_balance,
    'applied', v_applied,
    'unpaid_remainder', v_unpaid
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('reversed', false, 'duplicate', true);
END;
$$;

REVOKE ALL ON FUNCTION public.debit_paydora_payout(UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_cashout_payout_void(UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_paydora_deposit(UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_paydora_payout(UUID, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_cashout_payout_void(UUID, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_paydora_deposit(UUID, NUMERIC, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR current_setting('app.wallet_update', true) = 'true'
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF to_jsonb(NEW)->>'wallet_balance' IS DISTINCT FROM to_jsonb(OLD)->>'wallet_balance'
     OR to_jsonb(NEW)->>'cashout_wallet' IS DISTINCT FROM to_jsonb(OLD)->>'cashout_wallet'
     OR to_jsonb(NEW)->>'role' IS DISTINCT FROM to_jsonb(OLD)->>'role'
     OR to_jsonb(NEW)->>'kyc_status' IS DISTINCT FROM to_jsonb(OLD)->>'kyc_status'
     OR to_jsonb(NEW)->>'xp' IS DISTINCT FROM to_jsonb(OLD)->>'xp'
     OR to_jsonb(NEW)->>'level' IS DISTINCT FROM to_jsonb(OLD)->>'level'
     OR to_jsonb(NEW)->>'coins_balance' IS DISTINCT FROM to_jsonb(OLD)->>'coins_balance'
     OR to_jsonb(NEW)->>'lifetime_coins' IS DISTINCT FROM to_jsonb(OLD)->>'lifetime_coins'
     OR to_jsonb(NEW)->>'is_banned' IS DISTINCT FROM to_jsonb(OLD)->>'is_banned'
     OR to_jsonb(NEW)->>'referral_code' IS DISTINCT FROM to_jsonb(OLD)->>'referral_code'
     OR to_jsonb(NEW)->>'vip_tier' IS DISTINCT FROM to_jsonb(OLD)->>'vip_tier'
     OR to_jsonb(NEW)->>'vip_points' IS DISTINCT FROM to_jsonb(OLD)->>'vip_points'
     OR to_jsonb(NEW)->>'referred_by' IS DISTINCT FROM to_jsonb(OLD)->>'referred_by'
     OR to_jsonb(NEW)->>'is_suspended' IS DISTINCT FROM to_jsonb(OLD)->>'is_suspended'
  THEN
    RAISE EXCEPTION 'column protected' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.wheel_spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prize_label TEXT NOT NULL,
  prize_type TEXT NOT NULL DEFAULT 'luck',
  prize_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.wheel_spins DROP CONSTRAINT IF EXISTS wheel_spins_prize_type_check;
ALTER TABLE public.wheel_spins
  ADD CONSTRAINT wheel_spins_prize_type_check
  CHECK (prize_type IN ('cash', 'luck', 'points'));

CREATE INDEX IF NOT EXISTS idx_wheel_spins_user_id ON public.wheel_spins(user_id);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_created_at ON public.wheel_spins(created_at);

ALTER TABLE public.wheel_spins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own wheel spins" ON public.wheel_spins;
DROP POLICY IF EXISTS "Users can view own wheel spins" ON public.wheel_spins;
CREATE POLICY "Users can view own wheel spins"
  ON public.wheel_spins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.record_wheel_spin(
  p_prize_label TEXT,
  p_prize_type TEXT,
  p_prize_value INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_tier TEXT;
  v_limit INTEGER;
  v_count INTEGER;
  v_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_prize_type NOT IN ('cash', 'luck', 'points') THEN
    RAISE EXCEPTION 'invalid prize';
  END IF;
  IF p_prize_type = 'cash' AND p_prize_value > 10 THEN
    RAISE EXCEPTION 'invalid prize';
  END IF;
  IF p_prize_type = 'points' AND p_prize_value > 100 THEN
    RAISE EXCEPTION 'invalid prize';
  END IF;
  IF p_prize_value < 0 THEN
    RAISE EXCEPTION 'invalid prize';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  SELECT COALESCE(vip_tier, 'bronze') INTO v_tier
  FROM public.profiles
  WHERE id = v_user;
  v_limit := CASE v_tier
    WHEN 'silver' THEN 2
    WHEN 'gold' THEN 3
    WHEN 'platinum' THEN 3
    ELSE 1
  END;

  SELECT COUNT(*) INTO v_count
  FROM public.wheel_spins
  WHERE user_id = v_user
    AND created_at >= now() - interval '24 hours';

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'No spins left';
  END IF;

  INSERT INTO public.wheel_spins (user_id, prize_label, prize_type, prize_value)
  VALUES (v_user, p_prize_label, p_prize_type, p_prize_value)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_wheel_spin(TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_wheel_spin(TEXT, TEXT, INTEGER) TO authenticated;
