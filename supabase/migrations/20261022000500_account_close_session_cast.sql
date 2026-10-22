-- auth.refresh_tokens.user_id is text on the live database.
-- Comparing it to a uuid aborted account closure after the email lock succeeded.
-- The comparison is text on both sides, so uuid and text columns both match.
-- This does not delete any existing account.

CREATE OR REPLACE FUNCTION public.anonymize_closed_account(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  closed_email text := 'deleted+' || target::text || '@users.invalid';
BEGIN
  PERFORM public.lock_welcome_reward_identity(target);
  IF to_regclass('public.loyalty_phone_challenges') IS NOT NULL THEN
    DELETE FROM public.loyalty_phone_challenges WHERE user_id = target;
  END IF;
  PERFORM set_config('app.wallet_update', 'true', true);
  UPDATE public.profiles
     SET email = closed_email,
         full_name = 'Deleted player',
         phone = NULL,
         is_suspended = true
   WHERE id = target;
  IF to_regclass('auth.users') IS NOT NULL THEN
    UPDATE auth.users
       SET email = closed_email,
           phone = NULL,
           banned_until = 'infinity'
     WHERE id = target;
  END IF;
  IF to_regclass('auth.refresh_tokens') IS NOT NULL THEN
    DELETE FROM auth.refresh_tokens WHERE user_id::text = target::text;
  END IF;
  IF to_regclass('auth.sessions') IS NOT NULL THEN
    DELETE FROM auth.sessions WHERE user_id = target;
  END IF;
  IF to_regclass('auth.identities') IS NOT NULL THEN
    DELETE FROM auth.identities WHERE user_id = target;
  END IF;
END;
$$;
