-- Spinora admin-essentials · Add WinSweeps progression columns to existing profiles
-- Safe: only ADD COLUMN, never recreates profiles.

create or replace function public.calculate_level(xp_total bigint)
returns integer
language sql
immutable
as $$
  select greatest(1, floor(sqrt(greatest(xp_total, 0) / 100.0))::int + 1);
$$;

create or replace function public.xp_for_level(level_target integer)
returns bigint
language sql
immutable
as $$
  select (100 * power(greatest(level_target, 1) - 1, 2))::bigint;
$$;

alter table public.profiles add column if not exists xp bigint not null default 0;
alter table public.profiles add column if not exists level integer not null default 1;
alter table public.profiles add column if not exists coins_balance bigint not null default 0;
alter table public.profiles add column if not exists lifetime_coins bigint not null default 0;
alter table public.profiles add column if not exists current_streak integer not null default 0;
alter table public.profiles add column if not exists longest_streak integer not null default 0;
alter table public.profiles add column if not exists last_daily_claim date;
alter table public.profiles add column if not exists profile_completed boolean not null default false;
alter table public.profiles add column if not exists marketing_opt_in boolean not null default false;
alter table public.profiles add column if not exists last_seen_at timestamptz not null default now();

create or replace function public.sync_profile_level()
returns trigger
language plpgsql
as $$
begin
  new.level := public.calculate_level(new.xp);
  new.longest_streak := greatest(new.longest_streak, new.current_streak);
  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_level on public.profiles;
create trigger trg_profiles_sync_level
  before insert or update of xp, current_streak on public.profiles
  for each row execute function public.sync_profile_level();
