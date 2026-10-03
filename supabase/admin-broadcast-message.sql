-- Broadcast a notice to every user (in-app notification + optional support chat message).
-- Run once in Supabase SQL Editor, then use Admin Panel → Broadcast notice for future sends.

CREATE OR REPLACE FUNCTION public.admin_broadcast_to_all_users(
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'warning',
  p_send_chat BOOLEAN DEFAULT true
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_user RECORD;
  v_conv_id UUID;
  v_count INTEGER := 0;
  v_chat_body TEXT;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF trim(p_title) = '' OR trim(p_message) = '' THEN
    RAISE EXCEPTION 'Title and message are required';
  END IF;

  IF p_type NOT IN ('info', 'success', 'warning', 'promo') THEN
    RAISE EXCEPTION 'Invalid notification type';
  END IF;

  v_chat_body := trim(p_title) || E'\n\n' || trim(p_message);

  FOR v_user IN
    SELECT id FROM public.profiles WHERE role IS DISTINCT FROM 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    VALUES (v_user.id, trim(p_title), trim(p_message), p_type, false);

    IF p_send_chat THEN
      SELECT id INTO v_conv_id
      FROM public.conversations
      WHERE user_id = v_user.id AND is_active = true
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1;

      IF v_conv_id IS NULL THEN
        INSERT INTO public.conversations (user_id, admin_id)
        VALUES (v_user.id, v_admin_id)
        RETURNING id INTO v_conv_id;
      ELSE
        UPDATE public.conversations
        SET admin_id = v_admin_id, updated_at = NOW()
        WHERE id = v_conv_id;
      END IF;

      INSERT INTO public.messages (conversation_id, sender_id, content, is_read)
      VALUES (v_conv_id, v_admin_id, v_chat_body, false);
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_broadcast_to_all_users(TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- ONE-TIME maintenance blast (SQL Editor — no website login needed)
-- Uncomment and run AFTER replacing the message if you want a different text.
-- ---------------------------------------------------------------------------
/*
DO $$
DECLARE
  v_admin_id UUID;
  v_user RECORD;
  v_conv_id UUID;
  v_title TEXT := 'Site under maintenance';
  v_message TEXT := 'Spinora is currently under maintenance. No requests (loads, redeems, new accounts, or deposits) will be approved until further notice. Thank you for your patience — we will update you when service resumes.';
  v_chat_body TEXT;
  v_count INTEGER := 0;
BEGIN
  SELECT id INTO v_admin_id
  FROM public.profiles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin account found in profiles';
  END IF;

  v_chat_body := v_title || E'\n\n' || v_message;

  FOR v_user IN
    SELECT id FROM public.profiles WHERE role IS DISTINCT FROM 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    VALUES (v_user.id, v_title, v_message, 'warning', false);

    SELECT id INTO v_conv_id
    FROM public.conversations
    WHERE user_id = v_user.id AND is_active = true
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_conv_id IS NULL THEN
      INSERT INTO public.conversations (user_id, admin_id)
      VALUES (v_user.id, v_admin_id)
      RETURNING id INTO v_conv_id;
    ELSE
      UPDATE public.conversations
      SET admin_id = v_admin_id, updated_at = NOW()
      WHERE id = v_conv_id;
    END IF;

    INSERT INTO public.messages (conversation_id, sender_id, content, is_read)
    VALUES (v_conv_id, v_admin_id, v_chat_body, false);

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Maintenance notice sent to % users', v_count;
END $$;
*/
