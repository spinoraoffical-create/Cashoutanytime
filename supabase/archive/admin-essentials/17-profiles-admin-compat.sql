-- Spinora admin-essentials · Ensure wallet + progression columns exist on profiles
-- Safe to re-run. Does not recreate or drop profiles.

alter table public.profiles add column if not exists wallet_balance numeric(10, 2) not null default 0;
alter table public.profiles add column if not exists bonus_wallet numeric(10, 2) not null default 0;
alter table public.profiles add column if not exists cashout_wallet numeric(10, 2) not null default 0;
alter table public.profiles add column if not exists xp bigint not null default 0;
alter table public.profiles add column if not exists level integer not null default 1;
alter table public.profiles add column if not exists coins_balance bigint not null default 0;
alter table public.profiles add column if not exists lifetime_coins bigint not null default 0;
alter table public.profiles add column if not exists current_streak integer not null default 0;
alter table public.profiles add column if not exists longest_streak integer not null default 0;
alter table public.profiles add column if not exists last_daily_claim date;
alter table public.profiles add column if not exists last_seen_at timestamptz not null default now();
