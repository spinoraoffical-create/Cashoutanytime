-- ============================================================================
-- WinSweeps · 0014 · Public contact inbox + launch promotions/banners seed
-- ============================================================================

create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 80),
  email      text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  subject    text not null check (char_length(subject) between 3 and 140),
  message    text not null check (char_length(message) between 10 and 4000),
  status     text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now()
);

create index idx_contact_messages_status on public.contact_messages (status, created_at desc);

alter table public.contact_messages enable row level security;

-- anyone may write to the inbox; only support staff may read/manage it
create policy "contact public insert" on public.contact_messages
  for insert to anon, authenticated with check (true);
create policy "contact staff read" on public.contact_messages
  for select using (public.has_permission('support.manage'));
create policy "contact staff update" on public.contact_messages
  for update using (public.has_permission('support.manage'))
  with check (public.has_permission('support.manage'));

-- ── Launch promotions (visible in /promotions and the dashboard) ────────────

insert into public.promotions
  (slug, title, summary, description, badge_text, coins_bonus, xp_bonus,
   status, is_featured, priority, starts_at, max_claims_per_user) values
  ('welcome-boost',
   '200% Welcome Boost',
   'Triple your first vault: claim a one-time 750-coin booster pack.',
   'New to the arena? Activate the Welcome Boost within your first week to load your vault with 750 bonus Sweeps Coins and 300 XP. One claim per member.',
   'HOT DEAL', 750, 300, 'active', true, 10, now(), 1),
  ('arena-pass-bundle',
   'Arena Pass Bundle',
   'Limited bundle: 500 coins + 500 XP to fast-track your first tier.',
   'The Arena Pass stacks a balanced 500/500 coins-and-XP bundle so new contenders hit Gold tier faster. Limited quantity — first come, first served.',
   'LIMITED', 500, 500, 'active', true, 20, now(), 1),
  ('weekend-xp-surge',
   'Weekend XP Surge',
   'Weekend-only: a 400 XP surge to push your leaderboard run.',
   'Every weekend the arena heats up. Claim the XP Surge to add 400 XP to your weekend leaderboard campaign.',
   '2X XP', 0, 400, 'active', false, 30, now(), 1);

-- ── Launch banners ───────────────────────────────────────────────────────────

insert into public.banners
  (title, subtitle, link_url, placement, is_active, priority, starts_at) values
  ('Summer Drop ''26 is live',
   'Seasonal vault: 1,500 coins + 500 XP for active members.',
   '/promotions', 'home_strip', true, 10, now()),
  ('Refer your squad',
   'Earn 1,000 coins for every friend who qualifies.',
   '/dashboard/referrals', 'dashboard', true, 10, now());
