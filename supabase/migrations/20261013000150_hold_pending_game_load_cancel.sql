-- A pending load or reload may already have reached the game.
-- Cancel used to refund the wallet and mark the row cancelled anyway.
-- This replacement refuses that. It does not change the wallet.
-- Create, balance check, and redeem rows can still be cancelled.
-- Do not run this file until you have read DATABASE_VERIFICATION_REPORT.md.

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
    RAISE EXCEPTION 'A person has to confirm this game load before the wallet can change';
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

  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE id = p_request_id
    AND status IN ('pending', 'processing')
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN;
  END IF;

  IF v_row.load_type IN ('load', 'reload') THEN
    RAISE EXCEPTION 'A person has to confirm this game load before the wallet can change';
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
