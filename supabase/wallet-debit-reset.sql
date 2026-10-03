-- Run this if you already ran wallets.sql before debit/reset was added

CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_wallet_type TEXT,
  p_source TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_removed NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);

  IF p_wallet_type = 'bonus' THEN
    SELECT LEAST(bonus_wallet, p_amount) INTO v_removed FROM profiles WHERE id = p_user_id;
    UPDATE profiles SET bonus_wallet = GREATEST(0, bonus_wallet - p_amount) WHERE id = p_user_id;
  ELSIF p_wallet_type = 'current' THEN
    SELECT LEAST(wallet_balance, p_amount) INTO v_removed FROM profiles WHERE id = p_user_id;
    UPDATE profiles SET wallet_balance = GREATEST(0, wallet_balance - p_amount) WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid wallet type';
  END IF;

  IF v_removed IS NULL OR v_removed <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO wallet_transactions (user_id, amount, wallet_type, transaction_type, source, description, created_by)
  VALUES (p_user_id, v_removed, p_wallet_type, 'debit', p_source, p_description, auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.debit_wallet(UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_wallet(
  p_user_id UUID,
  p_wallet_type TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_removed NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);

  IF p_wallet_type = 'bonus' THEN
    SELECT bonus_wallet INTO v_removed FROM profiles WHERE id = p_user_id;
    UPDATE profiles SET bonus_wallet = 0 WHERE id = p_user_id;
  ELSIF p_wallet_type = 'current' THEN
    SELECT wallet_balance INTO v_removed FROM profiles WHERE id = p_user_id;
    UPDATE profiles SET wallet_balance = 0 WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid wallet type';
  END IF;

  IF v_removed IS NULL OR v_removed <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO wallet_transactions (user_id, amount, wallet_type, transaction_type, source, description, created_by)
  VALUES (p_user_id, v_removed, p_wallet_type, 'adjustment', 'admin', COALESCE(p_description, 'Wallet reset to zero'), auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_wallet(UUID, TEXT, TEXT) TO authenticated;
