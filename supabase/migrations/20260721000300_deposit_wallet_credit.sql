-- Credit Total Deposit wallet when admin confirms a deposit request.
-- Run once in Supabase SQL Editor after deposit-requests.sql and wallets.sql

DO $$
BEGIN
  IF to_regclass('public.deposit_requests') IS NOT NULL THEN
    ALTER TABLE public.deposit_requests
      ADD COLUMN IF NOT EXISTS wallet_credited BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.complete_deposit_request(
  p_deposit_id UUID,
  p_amount NUMERIC DEFAULT NULL,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.deposit_requests;
  v_amount NUMERIC;
  v_method TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v_row
  FROM public.deposit_requests
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Deposit request not found';
  END IF;

  IF v_row.wallet_credited OR v_row.status = 'completed' THEN
    RAISE EXCEPTION 'Deposit already completed';
  END IF;

  v_amount := COALESCE(p_amount, v_row.amount);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Deposit amount is required';
  END IF;

  v_amount := round(v_amount::numeric, 2);

  PERFORM set_config('app.wallet_update', 'true', true);

  UPDATE public.profiles
  SET wallet_balance = wallet_balance + v_amount
  WHERE id = v_row.user_id;

  v_method := COALESCE(v_row.payment_method, 'payment');

  INSERT INTO public.wallet_transactions (
    user_id, amount, wallet_type, transaction_type, source, description, created_by
  )
  VALUES (
    v_row.user_id,
    v_amount,
    'current',
    'credit',
    'deposit',
    format('Deposit confirmed — $%s via %s (%s)', v_amount, v_method, v_row.game_name),
    auth.uid()
  );

  UPDATE public.deposit_requests
  SET
    status = 'completed',
    amount = v_amount,
    wallet_credited = true,
    admin_notes = COALESCE(NULLIF(trim(p_admin_notes), ''), admin_notes),
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_deposit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_deposit_request(UUID, NUMERIC, TEXT) TO authenticated;
