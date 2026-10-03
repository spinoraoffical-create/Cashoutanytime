-- Admin proactive chat + automatic welcome message on signup
-- Run in Supabase SQL Editor

-- Allow admins to start conversations with any user
DROP POLICY IF EXISTS "Admins can create conversations for users" ON public.conversations;
CREATE POLICY "Admins can create conversations for users"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Signup: create profile + welcome conversation/message from first admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_code TEXT;
  referrer UUID;
  meta_ref TEXT;
  user_phone TEXT;
  user_whatsapp TEXT;
  user_email TEXT;
  admin_user UUID;
  conv_id UUID;
  welcome_msg TEXT := 'Hey! Welcome to Spinora — we''re genuinely glad you joined us. Browse games, try your daily spin, and message us anytime if you need help with accounts, deposits, or VIP rewards. Our team is here for you!';
BEGIN
  ref_code := UPPER(SUBSTRING(MD5(NEW.id::TEXT) FROM 1 FOR 8));
  meta_ref := NULLIF(TRIM(NEW.raw_user_meta_data->>'referral_code'), '');

  user_phone := COALESCE(NEW.phone, NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''));
  user_whatsapp := NULLIF(TRIM(NEW.raw_user_meta_data->>'whatsapp_number'), '');
  user_email := COALESCE(
    NULLIF(TRIM(NEW.email), ''),
    CASE WHEN user_phone IS NOT NULL THEN user_phone || '@phone.spinora.local' ELSE '' END
  );

  IF meta_ref IS NOT NULL THEN
    SELECT id INTO referrer
    FROM public.profiles
    WHERE referral_code = UPPER(meta_ref);
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, whatsapp, referral_code, referred_by)
  VALUES (
    NEW.id,
    user_email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    user_phone,
    user_whatsapp,
    ref_code,
    referrer
  );

  IF referrer IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id, reward_points)
    VALUES (referrer, NEW.id, 100);

    UPDATE public.profiles
    SET vip_points = vip_points + 100
    WHERE id = referrer;
  END IF;

  -- Welcome chat from first admin account
  SELECT id INTO admin_user
  FROM public.profiles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  IF admin_user IS NOT NULL THEN
    INSERT INTO public.conversations (user_id, admin_id)
    VALUES (NEW.id, admin_user)
    RETURNING id INTO conv_id;

    INSERT INTO public.messages (conversation_id, sender_id, content, is_read)
    VALUES (conv_id, admin_user, welcome_msg, false);

    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    VALUES (
      NEW.id,
      'Welcome to Spinora!',
      'Our team sent you a welcome message. Open Messages to read it.',
      'info',
      false
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user error: %', SQLERRM;
    RAISE;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role, supabase_auth_admin;
