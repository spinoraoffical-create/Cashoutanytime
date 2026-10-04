-- Email OTP login (phone identifies account, code sent to email)
-- Optional: only needed if SUPABASE_SERVICE_ROLE_KEY is not set on the server.
-- With service role in .env, the app resolves phone → email without this file.

CREATE OR REPLACE FUNCTION public.resolve_login_email(p_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_email TEXT;
BEGIN
  p_identifier := TRIM(p_identifier);
  IF p_identifier = '' THEN RETURN NULL; END IF;

  IF p_identifier LIKE '%@%' THEN
    RETURN LOWER(p_identifier);
  END IF;

  v_phone := '+' || regexp_replace(p_identifier, '\D', '', 'g');
  IF length(regexp_replace(v_phone, '\D', '', 'g')) < 8 THEN RETURN NULL; END IF;

  SELECT email INTO v_email
  FROM public.profiles
  WHERE phone = v_phone
  LIMIT 1;

  IF v_email IS NULL OR v_email LIKE '%@phone.spinora.local' THEN
    RETURN NULL;
  END IF;

  RETURN LOWER(v_email);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO anon, authenticated, service_role;
