-- Do not run this file until the owner approves it on a database copy.
-- The live database rejected an index on profiles.last_seen_at because that column is absent.
-- Add it as nullable with no default so existing rows stay unseen.
-- Leave existing rows null. Filling them with the current time would count every profile as seen today.
-- Then index the column. The dashboard must still say Unavailable when the count fails.
-- Rollback:
--   DROP INDEX IF EXISTS public.profiles_last_seen_at_idx;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS last_seen_at;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx
  ON public.profiles (last_seen_at);
