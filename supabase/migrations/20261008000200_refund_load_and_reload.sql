-- A failed game load stores load_type = 'load'. Refund that and 'reload' once.

ALTER TABLE public.game_load_requests
  ADD COLUMN IF NOT EXISTS game_api_debited boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.refund_game_load_wallet(p_request_id uuid)
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

  IF v_row.id IS NULL OR COALESCE(v_row.wallet_refunded, false) THEN
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
