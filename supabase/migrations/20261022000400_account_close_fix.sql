-- Close account failed on production after 20261022000300.
-- PostgREST leaves request.jwt.claim.role empty inside the RPC, while
-- auth.role() still reads service_role from request.jwt.claims.
-- pgcrypto lives in the extensions schema, so digest() was missing when
-- the close function hashed the email. This does not delete any rows.

CREATE OR REPLACE FUNCTION public.loyalty_email_hash(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT CASE
    WHEN raw IS NULL OR length(trim(raw)) = 0 THEN NULL
    ELSE encode(digest('email:' || lower(trim(raw)), 'sha256'), 'hex')
  END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user_account(target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  IF target_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Account not found.';
  END IF;
  IF to_regclass('public.user_roles') IS NOT NULL AND to_regclass('public.roles') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = target_user_id AND r.key = 'super_admin'
    ) THEN
      RAISE EXCEPTION 'The owner account cannot be deleted.';
    END IF;
  END IF;

  IF public.account_must_keep_history(target_user_id) THEN
    PERFORM public.anonymize_closed_account(target_user_id);
    RETURN 'anonymized';
  END IF;

  BEGIN
    PERFORM set_config('app.wallet_update', 'true', true);
    PERFORM public.lock_welcome_reward_identity(target_user_id);
    IF to_regclass('public.loyalty_phone_challenges') IS NOT NULL THEN
      DELETE FROM public.loyalty_phone_challenges WHERE user_id = target_user_id;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'admin_id'
    ) THEN
      UPDATE public.conversations SET admin_id = NULL WHERE admin_id = target_user_id;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'deposit_requests' AND column_name = 'reviewed_by'
    ) THEN
      UPDATE public.deposit_requests SET reviewed_by = NULL WHERE reviewed_by = target_user_id;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'newsletter_campaigns' AND column_name = 'created_by'
    ) THEN
      UPDATE public.newsletter_campaigns SET created_by = NULL WHERE created_by = target_user_id;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'created_by'
    ) THEN
      UPDATE public.wallet_transactions SET created_by = NULL WHERE created_by = target_user_id;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'referred_by'
    ) THEN
      UPDATE public.profiles SET referred_by = NULL WHERE referred_by = target_user_id;
    END IF;
    PERFORM set_config('app.allow_account_purge', 'true', true);
    IF to_regclass('auth.users') IS NOT NULL THEN
      DELETE FROM auth.users WHERE id = target_user_id;
    END IF;
    DELETE FROM public.profiles WHERE id = target_user_id;
    RETURN 'deleted';
  EXCEPTION WHEN foreign_key_violation OR insufficient_privilege THEN
    PERFORM public.anonymize_closed_account(target_user_id);
    RETURN 'anonymized';
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_account(uuid) TO service_role;
