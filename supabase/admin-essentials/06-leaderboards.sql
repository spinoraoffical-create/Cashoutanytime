-- Spinora admin-essentials · Leaderboards only (does NOT touch referrals table)
-- Safe to run alongside existing Spinora referrals.

create table if not exists public.leaderboard_entries (
  id          uuid primary key default gen_random_uuid(),
  period      public.leaderboard_period not null,
  period_key  text not null,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  score       bigint not null default 0 check (score >= 0),
  rank        integer,
  finalized   boolean not null default false,
  computed_at timestamptz not null default now(),
  unique (period, period_key, user_id)
);

create index if not exists idx_leaderboard_lookup
  on public.leaderboard_entries (period, period_key, rank);
create index if not exists idx_leaderboard_user
  on public.leaderboard_entries (user_id, period);

create or replace function public.period_key_for(p public.leaderboard_period, at_time timestamptz default now())
returns text
language sql
stable
as $$
  select case p
    when 'daily'    then to_char(at_time at time zone 'utc', 'YYYY-MM-DD')
    when 'weekly'   then to_char(at_time at time zone 'utc', 'IYYY"-W"IW')
    when 'monthly'  then to_char(at_time at time zone 'utc', 'YYYY-MM')
    when 'all_time' then 'all'
  end;
$$;

create or replace function public.compute_leaderboard(
  p public.leaderboard_period,
  p_key text default null,
  finalize boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_key text := coalesce(p_key, public.period_key_for(p));
  range_start timestamptz;
  range_end timestamptz;
  rows_written int;
begin
  case p
    when 'daily' then
      range_start := resolved_key::date;
      range_end   := range_start + interval '1 day';
    when 'weekly' then
      range_start := to_date(resolved_key, 'IYYY"-W"IW');
      range_end   := range_start + interval '7 days';
    when 'monthly' then
      range_start := to_date(resolved_key || '-01', 'YYYY-MM-DD');
      range_end   := range_start + interval '1 month';
    when 'all_time' then
      range_start := '-infinity'::timestamptz;
      range_end   := 'infinity'::timestamptz;
  end case;

  with scores as (
    select le.user_id, sum(le.amount) as xp_gained
    from public.ledger_entries le
    join public.profiles pr on pr.id = le.user_id
    where le.currency = 'xp'
      and le.amount > 0
      and le.created_at >= range_start
      and le.created_at < range_end
      and coalesce(pr.is_suspended, false) = false
    group by le.user_id
  ),
  ranked as (
    select user_id, xp_gained,
           rank() over (order by xp_gained desc) as rnk
    from scores
  )
  insert into public.leaderboard_entries
    (period, period_key, user_id, score, rank, finalized, computed_at)
  select p, resolved_key, user_id, xp_gained, rnk, finalize, now()
  from ranked
  on conflict (period, period_key, user_id) do update
    set score = excluded.score,
        rank = excluded.rank,
        finalized = excluded.finalized,
        computed_at = now();

  get diagnostics rows_written = row_count;
  return rows_written;
end;
$$;
