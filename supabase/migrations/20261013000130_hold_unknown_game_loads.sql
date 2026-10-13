-- A timeout is not proof the game rejected the credit.
-- fail_stale_game_loads used to refund load/reload rows and mark them failed.
-- That can return wallet money after the provider already added game credit.
-- This replacement leaves those rows pending for a person to reconcile.
-- Do not run this file until the owner approves it.

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
BEGIN
  -- Arguments stay so existing callers keep working. Nothing is refunded or closed.
  PERFORM p_stale_minutes, p_user_id, p_game_slug;
  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_stale_game_loads(integer, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_stale_game_loads(integer, uuid, text) TO service_role;
