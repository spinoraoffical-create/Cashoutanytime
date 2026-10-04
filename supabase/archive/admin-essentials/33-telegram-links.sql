-- Telegram bot identity linking: one-time codes minted from an authenticated
-- web session, resolved to a durable telegram-identity -> WinSweeps-user map.
-- Service-role only (bot webhooks + settings actions) — same convention as
-- game_server_configs: RLS enabled, no policies.

create table public.telegram_link_codes (
  code        text primary key,
  purpose     text not null check (purpose in ('admin', 'customer')),
  user_id     uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_telegram_link_codes_expiry on public.telegram_link_codes (expires_at);

alter table public.telegram_link_codes enable row level security;
-- No RLS policies — all access is via service-role / admin client only

create table public.telegram_links (
  id                uuid primary key default gen_random_uuid(),
  purpose           text not null check (purpose in ('admin', 'customer')),
  telegram_user_id  bigint not null,
  chat_id           bigint not null,
  telegram_username text,
  user_id           uuid not null references auth.users(id) on delete cascade,
  linked_at         timestamptz not null default now(),
  unique (purpose, telegram_user_id)
);

create index idx_telegram_links_user on public.telegram_links (user_id, purpose);

alter table public.telegram_links enable row level security;
-- No RLS policies — all access is via service-role / admin client only
