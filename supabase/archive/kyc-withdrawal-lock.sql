-- Enforce KYC Verification for Cashouts & Withdrawals in Supabase

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'unverified';

-- Update request_game_load function to enforce KYC on cashouts/redeems
CREATE OR REPLACE FUNCTION public.request_game_load(
  p_game_slug TEXT,
  p_game_name TEXT,
  p_amount NUMERIC,
  p_wallet_type TEXT,
  p_load_type TEXT,
  p_game_username TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_kyc_status TEXT;
  v_balance NUMERIC;
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM public.profiles ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found. Please log in or sign up first.';
  END IF;

  -- Check KYC status for withdrawal / redeem requests
  SELECT kyc_status INTO v_kyc_status FROM public.profiles WHERE id = v_user_id;

  IF p_load_type = 'redeem' AND (v_kyc_status IS NULL OR v_kyc_status != 'verified') THEN
    RAISE EXCEPTION 'KYC Verification Required! Please complete ID verification on your dashboard before requesting a cashout.';
  END IF;

  IF p_amount < 0 THEN
    RAISE EXCEPTION 'Amount cannot be negative';
  END IF;

  INSERT INTO public.game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type, game_username, status
  )
  VALUES (
    v_user_id,
    p_game_slug,
    p_game_name,
    p_amount,
    p_wallet_type,
    p_load_type,
    NULLIF(trim(p_game_username), ''),
    'pending'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_game_load(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role, anon;
