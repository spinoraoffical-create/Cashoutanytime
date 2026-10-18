BEGIN;

-- Label Paydora checkouts with the method the player chose.
-- Adds card, Google Pay, and Apple Pay to the deposit-request check.
-- Does not credit a wallet, change a balance, or enable deposits.

ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.deposit_requests
    WHERE payment_method NOT IN (
      'paypal', 'chime', 'cashapp', 'bitcoin', 'usdt', 'venmo', 'card', 'googlepay', 'applepay'
    )
  ) THEN
    RAISE EXCEPTION 'existing deposit method is outside the new check';
  END IF;
END $$;

ALTER TABLE public.deposit_requests DROP CONSTRAINT IF EXISTS deposit_requests_payment_method_check;
ALTER TABLE public.deposit_requests
  ADD CONSTRAINT deposit_requests_payment_method_check
  CHECK (
    payment_method = ANY (
      ARRAY['paypal', 'chime', 'cashapp', 'bitcoin', 'usdt', 'venmo', 'card', 'googlepay', 'applepay']::text[]
    )
  );

COMMIT;