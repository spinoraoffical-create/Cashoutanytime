-- Per-game webhook / future-API config (one row per game)
create table public.game_server_configs (
  id             uuid primary key default gen_random_uuid(),
  game_id        uuid references public.games(id) unique not null,
  webhook_secret text,
  api_base_url   text,
  api_key        text,
  notes          text,
  is_enabled     boolean not null default false,
  created_at     timestamptz not null default now()
);

alter table public.game_server_configs enable row level security;
-- No RLS policies — all access is via service-role / admin client only

-- Player ↔ game account mapping
create table public.game_accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  game_id          uuid references public.games(id) not null,
  game_username    text not null,
  game_user_id     text,
  credits_balance  numeric not null default 0,
  last_synced_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(user_id, game_id)
);

alter table public.game_accounts enable row level security;

create policy "users read own game accounts"
  on public.game_accounts for select
  using (user_id = auth.uid());

-- Extend requests table for fulfillment details
alter table public.requests
  add column if not exists game_username text,
  add column if not exists credits_added  numeric;
