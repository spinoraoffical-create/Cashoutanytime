-- Run in Supabase SQL Editor after schema.sql and wheel-spins.sql

-- Wallet balances on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_wallet NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashout_wallet NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- Transaction history
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  wallet_type TEXT NOT NULL CHECK (wallet_type IN ('current', 'bonus', 'cashout')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'adjustment')),
  source TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet transactions"
  ON wallet_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all wallet transactions"
  ON wallet_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Credit wallet (spin prizes, admin grants) — SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.credit_wallet(
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() <> p_user_id AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_wallet_type = 'bonus' THEN
    PERFORM set_config('app.wallet_update', 'true', true);
    UPDATE profiles SET bonus_wallet = bonus_wallet + p_amount WHERE id = p_user_id;
  ELSIF p_wallet_type = 'current' THEN
    PERFORM set_config('app.wallet_update', 'true', true);
    UPDATE profiles SET wallet_balance = wallet_balance + p_amount WHERE id = p_user_id;
  ELSIF p_wallet_type = 'cashout' THEN
    PERFORM set_config('app.wallet_update', 'true', true);
    UPDATE profiles SET cashout_wallet = cashout_wallet + p_amount WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid wallet type';
  END IF;

  INSERT INTO wallet_transactions (user_id, amount, wallet_type, transaction_type, source, description, created_by)
  VALUES (p_user_id, p_amount, p_wallet_type, 'credit', p_source, p_description, auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_wallet(UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

-- Debit wallet (admin only when adjusting another user)
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
  ELSIF p_wallet_type = 'cashout' THEN
    SELECT LEAST(cashout_wallet, p_amount) INTO v_removed FROM profiles WHERE id = p_user_id;
    UPDATE profiles SET cashout_wallet = GREATEST(0, cashout_wallet - p_amount) WHERE id = p_user_id;
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

-- Reset wallet balance to zero (admin only)
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
  ELSIF p_wallet_type = 'cashout' THEN
    SELECT cashout_wallet INTO v_removed FROM profiles WHERE id = p_user_id;
    UPDATE profiles SET cashout_wallet = 0 WHERE id = p_user_id;
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

-- Prevent users from manually editing wallet columns via profile update
CREATE OR REPLACE FUNCTION public.protect_wallet_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (OLD.wallet_balance IS DISTINCT FROM NEW.wallet_balance
      OR OLD.bonus_wallet IS DISTINCT FROM NEW.bonus_wallet
      OR OLD.cashout_wallet IS DISTINCT FROM NEW.cashout_wallet) THEN
    IF current_setting('app.wallet_update', true) = 'true'
       OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
      NEW.wallet_balance := OLD.wallet_balance;
      NEW.bonus_wallet := OLD.bonus_wallet;
      NEW.cashout_wallet := OLD.cashout_wallet;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_wallet_columns_trigger ON profiles;
CREATE TRIGGER protect_wallet_columns_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_wallet_columns();
