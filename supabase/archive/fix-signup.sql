-- FIX: "Database error saving new user"
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/drpitkvjcwrbzzufwwjt/sql/new

-- 1. Recreate the signup trigger function (with correct Supabase settings)
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
BEGIN
  ref_code := UPPER(SUBSTRING(MD5(NEW.id::TEXT) FROM 1 FOR 8));
  meta_ref := NULLIF(TRIM(NEW.raw_user_meta_data->>'referral_code'), '');

  IF meta_ref IS NOT NULL THEN
    SELECT id INTO referrer
    FROM public.profiles
    WHERE referral_code = UPPER(meta_ref);
  END IF;

  INSERT INTO public.profiles (id, email, full_name, referral_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
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

-- 2. Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Grants required for auth to run the trigger
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, service_role;
GRANT ALL ON public.referrals TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role, supabase_auth_admin;

-- 4. Allow the trigger to insert profiles (RLS was blocking signup)
DROP POLICY IF EXISTS "Service can insert profiles on signup" ON public.profiles;
CREATE POLICY "Service can insert profiles on signup"
  ON public.profiles
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service can insert referrals on signup" ON public.referrals;
CREATE POLICY "Service can insert referrals on signup"
  ON public.referrals
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (true);
