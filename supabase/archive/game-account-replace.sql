-- One game account per user per slug: block duplicate creates, allow explicit replace.
-- Run in Supabase SQL Editor (updates request_game_account_create).

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

  IF EXISTS (
    SELECT 1 FROM game_load_requests
    WHERE user_id = v_user_id AND game_slug = p_game_slug
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'A request is already in progress for this game';
  END IF;

  IF EXISTS (
    SELECT 1 FROM game_load_requests
    WHERE user_id = v_user_id
      AND game_slug = p_game_slug
      AND status = 'completed'
      AND load_type IN ('create_account', 'new_account')
      AND game_username IS NOT NULL
  ) AND NOT COALESCE(p_replace, FALSE) THEN
    RAISE EXCEPTION 'You already have a game account. Use Replace Account to get new login details.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM game_load_requests
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

  INSERT INTO game_load_requests (
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

GRANT EXECUTE ON FUNCTION public.request_game_account_create(TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
