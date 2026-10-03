-- Spinora admin-essentials · Profile helpers adapted for Spinora schema
-- Maps full_name / email / vip_points to what the admin UI expects.

drop view if exists public.public_profiles;

create or replace function public.public_profiles_by_ids(p_ids uuid[])
returns table (
  id uuid,
  username text,
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
  select
    p.id,
    coalesce(nullif(trim(p.email), ''), p.id::text) as username,
    coalesce(nullif(trim(p.full_name), ''), p.email, 'Player') as display_name,
    p.avatar_url,
    null::text as country,
    coalesce(p.vip_points, 0)::bigint as xp,
    1 as level,
    0 as current_streak,
    p.created_at
  from public.profiles p
  where p.id = any (p_ids)
    and coalesce(p.is_suspended, false) = false;
$$;

create or replace function public.public_profiles_top(p_limit integer default 10)
returns table (
  id uuid,
  username text,
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
  select
    p.id,
    coalesce(nullif(trim(p.email), ''), p.id::text) as username,
    coalesce(nullif(trim(p.full_name), ''), p.email, 'Player') as display_name,
    p.avatar_url,
    null::text as country,
    coalesce(p.vip_points, 0)::bigint as xp,
    1 as level,
    0 as current_streak,
    p.created_at
  from public.profiles p
  where coalesce(p.is_suspended, false) = false
  order by p.vip_points desc nulls last
  limit greatest(1, least(p_limit, 100));
$$;

revoke execute on function public.public_profiles_by_ids(uuid[]) from public;
revoke execute on function public.public_profiles_top(integer) from public;
grant execute on function public.public_profiles_by_ids(uuid[]) to anon, authenticated;
grant execute on function public.public_profiles_top(integer) to anon, authenticated;
