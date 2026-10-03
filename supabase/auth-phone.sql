-- Phone & WhatsApp auth support for Spinora profiles
-- Run in Supabase SQL Editor after main schema

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles (phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_whatsapp ON public.profiles (whatsapp) WHERE whatsapp IS NOT NULL;

-- Update signup trigger to store phone / WhatsApp from auth metadata
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
