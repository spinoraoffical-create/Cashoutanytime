-- ============================================================================
-- WinSweeps · 0104 · Telegram promo message pool (hourly rotation)
-- ============================================================================
-- Pool of rotating Telegram promo broadcast messages. The hourly cron
-- (src/app/api/cron/telegram-promo/route.ts) picks the oldest-unsent active
-- row each run and stamps last_sent_at — pure round-robin, no fixed schedule.
-- Same convention as game_server_configs / telegram_links: RLS enabled, no
-- policies — service-role only (admin actions in settings.ts + the cron route).

create table public.telegram_promo_messages (
  id            uuid primary key default gen_random_uuid(),
  text          text not null,
  link          text,
  image_url     text,
  is_active     boolean not null default true,
  last_sent_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- Matches the rotation query: WHERE is_active ORDER BY last_sent_at ASC NULLS FIRST LIMIT 1.
create index idx_telegram_promo_messages_rotation
  on public.telegram_promo_messages (last_sent_at asc nulls first)
  where is_active = true;

alter table public.telegram_promo_messages enable row level security;
-- No policies — service-role only (admin actions + the cron route)
