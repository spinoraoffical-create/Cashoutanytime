-- Phone notification devices and push attempt history.
-- This file is not applied automatically. Review it before running it on production.
-- It does not change wallets, deposits, payouts, or game-provider tables.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz
);

create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions (user_id)
  where disabled_at is null;

create table if not exists public.push_attempts (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid references public.broadcasts (id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('accepted', 'failed', 'expired')),
  provider_status integer,
  created_at timestamptz not null default now(),
  unique (broadcast_id, subscription_id)
);

create index if not exists idx_push_attempts_broadcast
  on public.push_attempts (broadcast_id, created_at desc);

alter table public.notification_preferences
  add column if not exists push_promotions boolean not null default false;

alter table public.notification_preferences
  add column if not exists push_support boolean not null default false;

alter table public.notification_preferences
  add column if not exists push_account boolean not null default false;

alter table public.push_subscriptions enable row level security;
alter table public.push_attempts enable row level security;

drop policy if exists "push subscriptions own" on public.push_subscriptions;
create policy "push subscriptions own" on public.push_subscriptions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push attempts own read" on public.push_attempts;
create policy "push attempts own read" on public.push_attempts
  for select using (user_id = auth.uid());

revoke all on table public.push_subscriptions from public, anon;
revoke all on table public.push_attempts from public, anon;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
grant select on table public.push_attempts to authenticated;
grant all on table public.push_subscriptions to service_role;
grant all on table public.push_attempts to service_role;
