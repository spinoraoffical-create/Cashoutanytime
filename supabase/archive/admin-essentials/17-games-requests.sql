-- ============================================================================
-- WinSweeps · 0020 · Real 12-game catalog + deposit requests table
-- ============================================================================

-- Deactivate placeholder games from the 0013 seed — replacing with real catalog
update public.games set is_active = false
where slug in (
  '777-spin','dragon-hoard','neon-poker-xl','abyss-hunter',
  'golden-winter','retro-rush','pharaohs-gold','quantum-spin',
  'mystic-grove','cyber-strike','olympus-gates','oceans-fortune'
);

-- ── Real 12-game catalog ─────────────────────────────────────────────────────

insert into public.games (name, slug, description, badge_text, is_featured, is_active, popularity, category_id) values
  ('Fire Kirin',
   'fire-kirin',
   'The ultimate fish table game — massive schools, legendary catches and jackpots that scale with every shot. Fast action, real prizes.',
   'HOT',  true,  true, 100,
   (select id from public.game_categories where key = 'fishing')),

  ('Juwa',
   'juwa',
   'High-speed fish hunting with multi-level boss battles, explosive bonus rounds and one of the highest payout rates in the lineup.',
   'HOT',  true,  true, 98,
   (select id from public.game_categories where key = 'fishing')),

  ('Orion Stars',
   'orion-stars',
   'Constellation-themed fish table with stellar jackpots that light up the board. Smooth controls, deep multipliers.',
   null,   true,  true, 95,
   (select id from public.game_categories where key = 'fishing')),

  ('Game Vault',
   'game-vault',
   'An entire vault of premium sweepstakes games in one platform — slots, fish tables and arcade titles with massive in-game multipliers.',
   'HOT',  true,  true, 94,
   (select id from public.game_categories where key = 'slots')),

  ('Vegas Sweeps',
   'vegas-sweeps',
   'Authentic Vegas-style slots with real reels, classic bonus rounds and the neon-lit jackpots the Strip is famous for.',
   null,   true,  true, 91,
   (select id from public.game_categories where key = 'slots')),

  ('Milky Way',
   'milky-way',
   'Space-themed fish table where galactic multipliers rain down during bonus storms — the bigger the school, the bigger the payout.',
   null,   true,  true, 89,
   (select id from public.game_categories where key = 'fishing')),

  ('Panda Master',
   'panda-master',
   'Bamboo forest fish action with powerful Panda Boss encounters and sudden multiplier bursts that can flip the board in seconds.',
   null,   true,  true, 87,
   (select id from public.game_categories where key = 'fishing')),

  ('Cash Frenzy',
   'cash-frenzy',
   'Non-stop slot action built for speed — rapid spins, free-spin chain reactions and a cash meter that climbs every round.',
   null,   false, true, 85,
   (select id from public.game_categories where key = 'slots')),

  ('VBlink',
   'vblink',
   'Blink and you''ll miss a payout — VBlink runs at breakneck speed with instant-reload bonus rounds and lightning multipliers.',
   'NEW',  false, true, 82,
   (select id from public.game_categories where key = 'fishing')),

  ('Mafia',
   'mafia',
   'Run the underworld: arcade-style fish table with street boss showdowns, crime syndicate jackpot pools and cinematic bonus sequences.',
   null,   false, true, 80,
   (select id from public.game_categories where key = 'arcade')),

  ('Mr. All In One',
   'mr-all-in-one',
   'Fish tables, slots and more inside a single platform — the all-in-one destination for players who want variety without switching apps.',
   null,   false, true, 78,
   (select id from public.game_categories where key = 'slots')),

  ('Cash Machine',
   'cash-machine',
   'Steady, reliable paylines and a generous free-spin engine — the Cash Machine rewards disciplined play with consistent sweeps coin payouts.',
   null,   false, true, 75,
   (select id from public.game_categories where key = 'slots'));

-- ── Game-specific FAQs (lower sort_order → shown first on homepage) ──────────

insert into public.faqs (question, answer, category, sort_order) values
  ('How do I create a game account and start playing?',
   'Submit the "Get Started" form on our homepage or any game page. Enter your name, contact (WhatsApp, Telegram or Messenger), choose your game, deposit amount and upload a payment confirmation screenshot. We create your in-game account and load your credits — you get your login details back via your chosen contact within 30 minutes.',
   'general', 1),

  ('How long does it take to receive my game credits after depositing?',
   'Most deposits are processed within 30 minutes during business hours (9 AM – 10 PM EST). After submitting, you can message us directly on WhatsApp or Telegram with your reference code for the fastest update.',
   'deposits', 2),

  ('Do I need an existing game account on Fire Kirin, Juwa or other platforms?',
   'No — we create the in-game account for you as part of the process. Select "New Account" in the form and provide your preferred contact method. We will send your login credentials once credits are loaded.',
   'deposits', 3),

  ('Which payment methods do you accept for deposits?',
   'We accept CashApp, Zelle, Bitcoin, USDT and other crypto options. After submitting your request form, follow the payment instructions for your chosen method and upload the confirmation screenshot.',
   'deposits', 4),

  ('Is there a bonus on my first deposit?',
   'Yes — every new player receives a 50% first deposit bonus credited automatically to their game balance. Returning players earn reload bonuses based on their VIP tier. See the VIP & Bonuses section on the homepage for full tier details.',
   'rewards', 5);

-- ── Deposit requests table ───────────────────────────────────────────────────

create table public.requests (
  id                uuid primary key default gen_random_uuid(),
  reference_code    text generated always as ('WS-' || upper(substr(id::text, 1, 8))) stored,
  name              text not null check (char_length(name) between 1 and 120),
  contact_method    text not null check (contact_method in ('whatsapp','telegram','messenger','phone')),
  contact_value     text not null check (char_length(contact_value) between 1 and 100),
  game_id           uuid references public.games (id) on delete set null,
  request_type      text not null check (request_type in ('new_account','reload')),
  existing_username text,
  deposit_amount    numeric not null check (deposit_amount >= 10),
  payment_method    text not null check (payment_method in ('cashapp','zelle','crypto','other')),
  payment_proof_path text not null,
  notes             text check (notes is null or char_length(notes) <= 500),
  status            text not null default 'pending'
                      check (status in ('pending','contacted','fulfilled','rejected')),
  handled_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);

create index idx_requests_status   on public.requests (status, created_at desc);
create index idx_requests_game     on public.requests (game_id)  where game_id is not null;
create index idx_requests_created  on public.requests (created_at desc);

alter table public.requests enable row level security;

-- Anyone (including anonymous visitors) can submit a request
create policy "anyone can submit a request"
  on public.requests
  for insert
  with check (true);

-- Only staff can read requests
create policy "staff can read requests"
  on public.requests
  for select
  using (public.is_staff());

-- Only staff can update request status
create policy "staff can update requests"
  on public.requests
  for update
  using (public.is_staff());

-- ── requests.manage permission ────────────────────────────────────────────────

insert into public.permissions (key, name, module, description) values
  ('requests.manage', 'Manage deposit requests', 'requests',
   'View, update and fulfil player deposit/account requests');

-- Grant to super_admin (already has all; explicit grant for completeness)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'super_admin' and p.key = 'requests.manage'
on conflict do nothing;

-- Grant to admin
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'requests.manage'
where r.key = 'admin'
on conflict do nothing;

-- NOTE: Also create a private Supabase Storage bucket named "payment-proofs"
-- via the Supabase dashboard (Storage → New bucket → private, 8 MB limit).
-- The server action uses the service-role key to upload and generate signed URLs.
