-- refund_game_load_wallet updates profiles.wallet_balance. The live
-- protect_wallet_columns trigger allows that only for is_service_role()
-- or for the signed-in player. is_service_role() reads
-- request.jwt.claim.role, which PostgREST often leaves empty inside this
-- RPC, so the refund raises and rolls back. The load stays pending and
-- wallet_refunded stays false.
--
-- This function is already executable only by service_role. Setting the
-- claim for this transaction lets the existing trigger accept the update.
-- It does not credit any existing request.

CREATE OR REPLACE FUNCTION public.refund_game_load_wallet(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
  v_wallet text;
BEGIN
  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_row.id IS NULL OR COALESCE(v_row.wallet_refunded, false) THEN
    RETURN;
  END IF;
  IF COALESCE(v_row.game_api_debited, false) THEN
    RETURN;
  END IF;
  IF v_row.load_type NOT IN ('load', 'reload') OR COALESCE(v_row.amount, 0) <= 0 THEN
    RETURN;
  END IF;
  IF v_row.amount = 'NaN'::numeric THEN
    RAISE EXCEPTION 'invalid refund amount';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('app.wallet_update', 'true', true);

  IF v_row.wallet_type = 'bonus' THEN
    v_wallet := 'bonus';
    UPDATE public.profiles
    SET bonus_wallet = bonus_wallet + v_row.amount
    WHERE id = v_row.user_id;
  ELSE
    v_wallet := 'current';
    UPDATE public.profiles
    SET wallet_balance = wallet_balance + v_row.amount
    WHERE id = v_row.user_id;
  END IF;

  IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
    INSERT INTO public.wallet_transactions (
      user_id, amount, wallet_type, transaction_type, source, description, created_by
    ) VALUES (
      v_row.user_id, v_row.amount, v_wallet, 'credit', 'game_load_refund',
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
