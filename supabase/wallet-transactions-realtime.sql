-- Live admin Transaction Management (new rows appear without refresh).
-- Run in Supabase SQL Editor after wallets.sql.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'wallet_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;
  END IF;
END $$;

ALTER TABLE public.wallet_transactions REPLICA IDENTITY FULL;
