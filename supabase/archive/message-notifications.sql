-- Run in Supabase SQL Editor so chat messages create bell notifications.

CREATE OR REPLACE FUNCTION public.notify_message_recipient()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_user_id UUID;
  conv_admin_id UUID;
  sender_role TEXT;
  sender_name TEXT;
  recipient_id UUID;
  preview TEXT;
BEGIN
  SELECT c.user_id, c.admin_id
  INTO conv_user_id, conv_admin_id
  FROM conversations c
  WHERE c.id = NEW.conversation_id;

  SELECT role, COALESCE(NULLIF(TRIM(full_name), ''), 'Customer')
  INTO sender_role, sender_name
  FROM profiles
  WHERE id = NEW.sender_id;

  IF sender_role = 'admin' THEN
    RETURN NEW;
  END IF;

  recipient_id := conv_admin_id;
  IF recipient_id IS NULL THEN
    SELECT id INTO recipient_id
    FROM profiles
    WHERE role = 'admin'
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF recipient_id IS NULL OR recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  preview := COALESCE(
    NULLIF(TRIM(NEW.content), ''),
    CASE
      WHEN NEW.attachment_type = 'image' THEN 'Sent you an image'
      WHEN NEW.attachment_type = 'file' THEN 'Sent you a file'
      ELSE 'Sent you a message'
    END
  );

  IF LENGTH(preview) > 140 THEN
    preview := LEFT(preview, 137) || '...';
  END IF;

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    recipient_id,
    CASE
      WHEN sender_role = 'admin' THEN 'New message from Support'
      ELSE 'New message from ' || sender_name
    END,
    preview,
    'info'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_notify ON messages;
CREATE TRIGGER on_message_notify
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_message_recipient();
