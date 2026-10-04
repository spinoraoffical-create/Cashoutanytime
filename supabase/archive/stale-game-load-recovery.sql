-- Fail wallet-load jobs stuck in pending/processing so users can retry.
-- Also adds cancel_my_game_load for the game wallet UI.
-- Run in Supabase SQL Editor after game-load-requests.sql

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
  v_count INTEGER;
BEGIN
  UPDATE public.game_load_requests
  SET
    status = 'failed',
    error_message = COALESCE(
      NULLIF(trim(error_message), ''),
      'Timed out waiting for the game bot. Restart the bot on your PC, then try again.'
    ),
    updated_at = NOW()
  WHERE status IN ('pending', 'processing')
    AND updated_at < NOW() - make_interval(mins => GREATEST(p_stale_minutes, 5))
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_game_slug IS NULL OR game_slug = p_game_slug);

  GET DIAGNOSTICS v_count = ROW_COUNT;
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.game_load_requests
  SET
    status = 'cancelled',
    error_message = COALESCE(
      NULLIF(trim(error_message), ''),
      'Cancelled — you can start a new request.'
    ),
    updated_at = NOW()
  WHERE id = p_request_id
    AND user_id = auth.uid()
    AND status IN ('pending', 'processing');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already finished';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_my_game_load(UUID) TO authenticated;

-- Bot: fail very stale jobs for this game before claiming the next pending row.
CREATE OR REPLACE FUNCTION public.claim_next_game_load(p_game_slug TEXT)
RETURNS SETOF public.game_load_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
BEGIN
  PERFORM public.fail_stale_game_loads(15, NULL, p_game_slug);

  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE game_slug = p_game_slug
    AND status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_row.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.game_load_requests
  SET status = 'processing',
      bot_attempts = bot_attempts + 1,
      updated_at = NOW()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN NEXT v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_next_game_load(TEXT) TO service_role;

-- Auto-fail stale jobs before checking "already in progress".
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
    SELECT 1 FROM game_load_requests
    WHERE user_id = v_user_id AND game_slug = p_game_slug
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'A request is already in progress for this game. Cancel it under Recent activity, or wait for the bot.';
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
