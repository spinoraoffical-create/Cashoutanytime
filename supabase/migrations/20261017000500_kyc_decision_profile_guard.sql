-- Proposed only. Do not apply until the owner approves this file.
-- The live admin_decide_kyc update of profiles.kyc_status is rejected by
-- protect_profile_columns because that guard reads request.jwt.claim.role,
-- which is empty inside this security-definer call. auth.role() still sees
-- service_role through request.jwt.claims, so the function passes its own
-- role check and then the profile update raises "column protected".
-- The transaction rolls back, so the identity check stays pending.
--
-- This does not reuse app.wallet_update. That flag lets the same transaction
-- change wallet balances, role, and the other protected profile columns.
-- app.kyc_status_update is transaction-local and the guard allows only
-- kyc_status to change while it is set. Wallet columns stay protected.
--
-- Rollback: reapply supabase/migrations/20261014000160_admin_decide_kyc.sql

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF current_setting('app.kyc_status_update', true) = 'true' THEN
    IF to_jsonb(NEW)->>'wallet_balance' IS DISTINCT FROM to_jsonb(OLD)->>'wallet_balance'
       OR to_jsonb(NEW)->>'cashout_wallet' IS DISTINCT FROM to_jsonb(OLD)->>'cashout_wallet'
       OR to_jsonb(NEW)->>'bonus_wallet' IS DISTINCT FROM to_jsonb(OLD)->>'bonus_wallet'
       OR to_jsonb(NEW)->>'role' IS DISTINCT FROM to_jsonb(OLD)->>'role'
       OR to_jsonb(NEW)->>'xp' IS DISTINCT FROM to_jsonb(OLD)->>'xp'
       OR to_jsonb(NEW)->>'level' IS DISTINCT FROM to_jsonb(OLD)->>'level'
       OR to_jsonb(NEW)->>'coins_balance' IS DISTINCT FROM to_jsonb(OLD)->>'coins_balance'
       OR to_jsonb(NEW)->>'lifetime_coins' IS DISTINCT FROM to_jsonb(OLD)->>'lifetime_coins'
       OR to_jsonb(NEW)->>'is_banned' IS DISTINCT FROM to_jsonb(OLD)->>'is_banned'
       OR to_jsonb(NEW)->>'referral_code' IS DISTINCT FROM to_jsonb(OLD)->>'referral_code'
       OR to_jsonb(NEW)->>'vip_tier' IS DISTINCT FROM to_jsonb(OLD)->>'vip_tier'
       OR to_jsonb(NEW)->>'vip_points' IS DISTINCT FROM to_jsonb(OLD)->>'vip_points'
       OR to_jsonb(NEW)->>'referred_by' IS DISTINCT FROM to_jsonb(OLD)->>'referred_by'
       OR to_jsonb(NEW)->>'is_suspended' IS DISTINCT FROM to_jsonb(OLD)->>'is_suspended'
    THEN
      RAISE EXCEPTION 'column protected' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR current_setting('app.wallet_update', true) = 'true'
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF to_jsonb(NEW)->>'wallet_balance' IS DISTINCT FROM to_jsonb(OLD)->>'wallet_balance'
     OR to_jsonb(NEW)->>'cashout_wallet' IS DISTINCT FROM to_jsonb(OLD)->>'cashout_wallet'
     OR to_jsonb(NEW)->>'role' IS DISTINCT FROM to_jsonb(OLD)->>'role'
     OR to_jsonb(NEW)->>'kyc_status' IS DISTINCT FROM to_jsonb(OLD)->>'kyc_status'
     OR to_jsonb(NEW)->>'xp' IS DISTINCT FROM to_jsonb(OLD)->>'xp'
     OR to_jsonb(NEW)->>'level' IS DISTINCT FROM to_jsonb(OLD)->>'level'
     OR to_jsonb(NEW)->>'coins_balance' IS DISTINCT FROM to_jsonb(OLD)->>'coins_balance'
     OR to_jsonb(NEW)->>'lifetime_coins' IS DISTINCT FROM to_jsonb(OLD)->>'lifetime_coins'
     OR to_jsonb(NEW)->>'is_banned' IS DISTINCT FROM to_jsonb(OLD)->>'is_banned'
     OR to_jsonb(NEW)->>'referral_code' IS DISTINCT FROM to_jsonb(OLD)->>'referral_code'
     OR to_jsonb(NEW)->>'vip_tier' IS DISTINCT FROM to_jsonb(OLD)->>'vip_tier'
     OR to_jsonb(NEW)->>'vip_points' IS DISTINCT FROM to_jsonb(OLD)->>'vip_points'
     OR to_jsonb(NEW)->>'referred_by' IS DISTINCT FROM to_jsonb(OLD)->>'referred_by'
     OR to_jsonb(NEW)->>'is_suspended' IS DISTINCT FROM to_jsonb(OLD)->>'is_suspended'
  THEN
    RAISE EXCEPTION 'column protected' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_decide_kyc(
  p_submission_id uuid,
  p_status text,
  p_actor uuid,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_row public.kyc_submissions;
  v_profile_status text;
  v_current_profile text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_actor) THEN
    RAISE EXCEPTION 'actor not found';
  END IF;
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid identity status';
  END IF;

  SELECT * INTO v_row
  FROM public.kyc_submissions
  WHERE id = p_submission_id
  FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'identity check not found';
  END IF;

  v_profile_status := CASE WHEN p_status = 'approved' THEN 'verified' ELSE 'rejected' END;

  SELECT kyc_status INTO v_current_profile
  FROM public.profiles
  WHERE id = v_row.user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'player profile not found';
  END IF;

  IF v_row.status = p_status AND v_current_profile = v_profile_status THEN
    RETURN;
  END IF;

  UPDATE public.kyc_submissions
  SET status = p_status, updated_at = now()
  WHERE id = v_row.id;

  PERFORM set_config('app.kyc_status_update', 'true', true);

  UPDATE public.profiles
  SET kyc_status = v_profile_status, updated_at = now()
  WHERE id = v_row.user_id;

  PERFORM set_config('app.kyc_status_update', 'false', true);

  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data, ip_address, user_agent
  ) VALUES (
    p_actor,
    CASE WHEN p_status = 'approved' THEN 'kyc.approve' ELSE 'kyc.reject' END,
    'kyc_submission',
    v_row.user_id::text,
    jsonb_build_object('status', v_row.status),
    jsonb_build_object('status', p_status),
    p_ip,
    p_user_agent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_decide_kyc(uuid, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_decide_kyc(uuid, text, uuid, text, text) TO service_role;
