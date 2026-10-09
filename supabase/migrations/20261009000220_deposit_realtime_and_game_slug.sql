-- Admin deposit popups need deposit_requests on the realtime publication.
-- Archive SQL is not applied. This does not change games.is_active.

DO $$
BEGIN
  IF to_regclass('public.deposit_requests') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'deposit_requests'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_requests;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.canonical_game_slug(p_slug TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(replace(replace(coalesce(p_slug, ''), '_', '-'), ' ', ''))
    WHEN 'vegas' THEN 'vegas-sweeps'
    WHEN 'vegas-sweeps' THEN 'vegas-sweeps'
    WHEN 'cashmachine' THEN 'cash-machine'
    WHEN 'cash-machine' THEN 'cash-machine'
    WHEN 'cashfrenzy' THEN 'cash-frenzy'
    WHEN 'cash-frenzy' THEN 'cash-frenzy'
    WHEN 'gamevault' THEN 'game-vault'
    WHEN 'game-vault' THEN 'game-vault'
    WHEN 'firekirin' THEN 'fire-kirin'
    WHEN 'fire-kirin' THEN 'fire-kirin'
    WHEN 'mrallinone' THEN 'mr-all-in-one'
    WHEN 'mr-all-in-one' THEN 'mr-all-in-one'
    WHEN 'pandamaster' THEN 'panda-master'
    WHEN 'panda-master' THEN 'panda-master'
    ELSE lower(replace(replace(coalesce(p_slug, ''), '_', '-'), ' ', ''))
  END;
$$;

CREATE OR REPLACE FUNCTION public.game_id_for_slug(p_slug TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.games') IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN (
    SELECT id
    FROM public.games
    WHERE public.canonical_game_slug(slug) = public.canonical_game_slug(p_slug)
    LIMIT 1
  );
END;
$$;
