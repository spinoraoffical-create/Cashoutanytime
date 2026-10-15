-- Do not run this file until the owner approves it on a database copy.
-- The application does not call this function yet.
-- Rollback: DROP FUNCTION IF EXISTS public.admin_decide_kyc(uuid, text, uuid, text, text);

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
SET search_path = public
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

  UPDATE public.profiles
  SET kyc_status = v_profile_status, updated_at = now()
  WHERE id = v_row.user_id;

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
