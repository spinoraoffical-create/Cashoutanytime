-- ============================================================================
-- WinSweeps · 0018 · Replace SECURITY DEFINER view with definer functions
-- Resolves the Supabase advisor "Security Definer View" (CRITICAL) on
-- public.public_profiles. The view exposed only a safe public projection, but
-- definer *views* are flagged generically. Definer *functions* with a fixed
-- search_path are the Supabase-recommended pattern for exposing a controlled
-- projection past RLS, and are not flagged.
-- ============================================================================

drop view if exists public.public_profiles;

-- Safe public projection by id list (leaderboards, referral usernames).
create or replace function public.public_profiles_by_ids(p_ids uuid[])
returns table (
  id uuid,
  username citext,
  display_name text,
  avatar_url text,
  country text,
  xp bigint,
  level integer,
  current_streak integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.country,
         p.xp, p.level, p.current_streak, p.created_at
  from public.profiles p
  where p.id = any (p_ids)
    and p.is_banned = false;
$$;

-- Safe public projection: top members by XP (leaderboard preview).
create or replace function public.public_profiles_top(p_limit integer default 10)
returns table (
  id uuid,
  username citext,
  display_name text,
  avatar_url text,
  country text,
  xp bigint,
  level integer,
  current_streak integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.country,
         p.xp, p.level, p.current_streak, p.created_at
  from public.profiles p
  where p.is_banned = false
  order by p.xp desc
  limit greatest(1, least(p_limit, 100));
$$;

revoke execute on function public.public_profiles_by_ids(uuid[]) from public;
revoke execute on function public.public_profiles_top(integer) from public;
grant execute on function public.public_profiles_by_ids(uuid[]) to anon, authenticated;
grant execute on function public.public_profiles_top(integer) to anon, authenticated;
