-- Live wallet updates for users (sidebar + game pages).
-- Without this, only a full page refresh shows new balances after admin grants or game loads.
-- Run in Supabase SQL Editor.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

-- Send full row on UPDATE so wallet columns arrive in realtime payloads.
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
