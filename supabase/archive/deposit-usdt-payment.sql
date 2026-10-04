-- Add USDT to deposit payment methods (run once if deposit_requests already exists)
ALTER TABLE public.deposit_requests
  DROP CONSTRAINT IF EXISTS deposit_requests_payment_method_check;

ALTER TABLE public.deposit_requests
  ADD CONSTRAINT deposit_requests_payment_method_check
  CHECK (payment_method IN ('paypal', 'chime', 'cashapp', 'bitcoin', 'usdt', 'venmo'));
