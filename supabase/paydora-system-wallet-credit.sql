-- Paydora / system wallet credits (service role)
-- Run once in Supabase SQL Editor.
-- Fixes silent wallet reverts that blocked automatic Paydora deposits.

-- 1) Allow service_role to update wallet columns (Paydora, bots, webhooks)
CREATE OR REPLACE FUNCTION public.protect_wallet_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (OLD.wallet_balance IS DISTINCT FROM NEW.wallet_balance
      OR OLD.bonus_wallet IS DISTINCT FROM NEW.bonus_wallet
      OR OLD.cashout_wallet IS DISTINCT FROM NEW.cashout_wallet
      OR OLD.bonus_redeem_wallet IS DISTINCT FROM NEW.bonus_redeem_wallet) THEN
    IF current_setting('app.wallet_update', true) = 'true' THEN
      RETURN NEW;
    END IF;
    -- Service role JWT (PostgREST) must be able to credit wallets
    IF coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
      NEW.wallet_balance := OLD.wallet_balance;
      NEW.bonus_wallet := OLD.bonus_wallet;
      NEW.cashout_wallet := OLD.cashout_wallet;
      NEW.bonus_redeem_wallet := OLD.bonus_redeem_wallet;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Explicit system credit RPC (idempotent by description marker)
CREATE OR REPLACE FUNCTION public.credit_system_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_source TEXT,
  p_description TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_description IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE user_id = p_user_id AND description = p_description
  ) THEN
    RETURN;
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);

  UPDATE public.profiles
  SET wallet_balance = wallet_balance + round(p_amount::numeric, 2)
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO public.wallet_transactions (
    user_id, amount, wallet_type, transaction_type, source, description, created_by
  )
  VALUES (
    p_user_id,
    round(p_amount::numeric, 2),
    'current',
    'credit',
    COALESCE(NULLIF(trim(p_source), ''), 'deposit'),
    p_description,
    NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_system_wallet(UUID, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_system_wallet(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
