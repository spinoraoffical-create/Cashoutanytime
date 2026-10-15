-- Prepared correction. Do not apply until the owner approves a production deploy.
-- Production fail_stale_game_loads refunds stale load/reload rows and marks them failed.
-- A timeout is not a confirmed provider failure.
-- This replacement keeps the signature and service-role grant, and it does not
-- update game_load_requests, wallets, or any other customer row.

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
  PERFORM p_stale_minutes, p_user_id, p_game_slug;
  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_stale_game_loads(integer, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_stale_game_loads(integer, uuid, text) TO service_role;
