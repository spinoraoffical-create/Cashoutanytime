-- Safe stale-load hold. Do not apply this file to the hosted database until the owner approves it.
-- A timeout is not a confirmed provider failure.
-- This function never refunds, never changes a wallet, and never closes the request.
-- It marks each open stale row once. The row stays pending or processing, so a second
-- load stays blocked and a later provider confirmation can still complete it.

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
  v_updated integer := 0;
  v_row public.game_load_requests;
  v_note text;
BEGIN
  FOR v_row IN
    SELECT *
    FROM public.game_load_requests
    WHERE status IN ('pending', 'processing')
      AND updated_at < now() - make_interval(mins => greatest(COALESCE(p_stale_minutes, 15), 5))
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND (p_game_slug IS NULL OR game_slug = p_game_slug)
      AND wallet_refunded = false
      AND COALESCE(admin_notes, '') NOT LIKE '[held for review]%'
    FOR UPDATE SKIP LOCKED
  LOOP
    v_note := CASE
      WHEN v_row.game_api_debited THEN
        '[held for review] Provider flag is set. Do not refund. '
      ELSE
        '[held for review] Provider did not confirm. Do not refund. '
    END;

    UPDATE public.game_load_requests
    SET admin_notes = v_note || COALESCE(admin_notes, ''),
        updated_at = now()
    WHERE id = v_row.id
      AND status IN ('pending', 'processing')
      AND wallet_refunded = false
      AND game_api_debited = v_row.game_api_debited
      AND COALESCE(admin_notes, '') NOT LIKE '[held for review]%';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    v_count := v_count + v_updated;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_stale_game_loads(integer, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_stale_game_loads(integer, uuid, text) TO service_role;
