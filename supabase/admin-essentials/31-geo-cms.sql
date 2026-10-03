-- ============================================================================
-- WinSweeps · 0093 · Geo state/city pages — DB-managed CMS
-- ============================================================================
-- Moves the state/city landing pages (/[state], /[state]/[city]) from a
-- hardcoded TS object (src/lib/geo-data.ts) onto the same DB-managed CMS
-- pattern as games/blog_posts, so new states/cities are an /admin/geo edit,
-- not a code change + redeploy. geo-data.ts's GEO_STATES is kept as the
-- static fallback (see src/lib/data/marketing.ts).

create table public.geo_states (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name             text not null,
  abbr             text not null check (char_length(abbr) = 2),
  hero_lede        text not null default '',
  meta_description text not null default '',
  sort_order       integer not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_geo_states_updated_at
  before update on public.geo_states
  for each row execute function public.set_updated_at();

create table public.geo_cities (
  id                   uuid primary key default gen_random_uuid(),
  state_id             uuid not null references public.geo_states (id) on delete cascade,
  slug                 text not null check (slug ~ '^[a-z0-9-]+$'),
  name                 text not null,
  description_snippet  text not null default '',
  sort_order           integer not null default 0,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (state_id, slug)
);

create trigger trg_geo_cities_updated_at
  before update on public.geo_cities
  for each row execute function public.set_updated_at();

create index idx_geo_cities_state on public.geo_cities (state_id, sort_order);

alter table public.geo_states enable row level security;
alter table public.geo_cities enable row level security;

create policy "geo_states public" on public.geo_states
  for select using (is_active or public.has_permission('cms.manage'));
create policy "geo_states managed" on public.geo_states
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy "geo_cities public" on public.geo_cities
  for select using (is_active or public.has_permission('cms.manage'));
create policy "geo_cities managed" on public.geo_cities
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

-- ── Seed: exact current content from src/lib/geo-data.ts ────────────────────
-- sort_order matches the original object/array order so footer/city-link
-- order is unchanged.

insert into public.geo_states (slug, name, abbr, hero_lede, meta_description, sort_order) values
('texas', 'Texas', 'TX',
 'WinSweeps is available to players across Texas — from Houston and Dallas to San Antonio and Austin. Play Fire Kirin, Juwa, Orion Stars, Game Vault and 8 more sweepstakes fish table games online. 50% welcome bonus on every title.',
 'Play Fire Kirin, Juwa, Orion Stars, Game Vault and 8 more sweepstakes fish table games online in Texas. 50% welcome bonus. CashApp, Zelle & Crypto deposits. Instant accounts for players in Houston, Dallas, San Antonio, Austin and across TX.',
 0),
('florida', 'Florida', 'FL',
 'WinSweeps serves players across Florida — Miami, Orlando, Jacksonville, Tampa and beyond. Access all 12 fish table & sweepstakes games with a 50% welcome bonus. Instant accounts and wallet-funded credits.',
 'Play Fire Kirin, Juwa, Orion Stars and 9 more sweepstakes fish table games online in Florida. 50% welcome bonus. CashApp, Zelle & Crypto. Instant accounts for players in Miami, Orlando, Jacksonville, Tampa and across FL.',
 1),
('georgia', 'Georgia', 'GA',
 'WinSweeps is available to players across Georgia including Atlanta, Augusta, Savannah and Columbus. Play 12 premium sweepstakes fish table and slot games online. 50% welcome bonus, instant account setup.',
 'Play Fire Kirin, Juwa, Orion Stars and more sweepstakes fish table games online in Georgia. 50% welcome bonus for players in Atlanta, Augusta, Savannah and across GA. Instant account setup.',
 2),
('california', 'California', 'CA',
 'WinSweeps serves players across California — Los Angeles, San Diego, Sacramento, Fresno and beyond. All 12 sweepstakes fish table games available online with a 50% first deposit welcome bonus.',
 'Play Fire Kirin, Juwa, Orion Stars and 9 more sweepstakes games online in California. 50% welcome bonus. CashApp, Zelle & Crypto deposits. Instant accounts for players in Los Angeles, San Diego, Sacramento and across CA.',
 3),
('north-carolina', 'North Carolina', 'NC',
 'WinSweeps is available to players across North Carolina including Charlotte, Raleigh and Greensboro. Play Fire Kirin, Juwa, Orion Stars and 9 more sweepstakes games online with a 50% welcome bonus.',
 'Play Fire Kirin, Juwa, Orion Stars and sweepstakes fish table games online in North Carolina. 50% welcome bonus for players in Charlotte, Raleigh, Greensboro and across NC. Instant account setup.',
 4),
('ohio', 'Ohio', 'OH',
 'WinSweeps serves players across Ohio — Columbus, Cleveland, Cincinnati and beyond. All 12 sweepstakes fish table and slot games available online. 50% welcome bonus and instant account setup.',
 'Play Fire Kirin, Juwa, Orion Stars and sweepstakes games online in Ohio. 50% welcome bonus for players in Columbus, Cleveland, Cincinnati and across OH. CashApp, Zelle & Crypto deposits.',
 5),
('michigan', 'Michigan', 'MI',
 'WinSweeps is available to players across Michigan — Detroit, Grand Rapids and beyond. Play all 12 sweepstakes fish table and slot games online. 50% welcome bonus applied automatically to every new account.',
 'Play Fire Kirin, Juwa, Orion Stars and 9 more sweepstakes games online in Michigan. 50% welcome bonus for players in Detroit, Grand Rapids and across MI. Instant account setup.',
 6);

insert into public.geo_cities (state_id, slug, name, description_snippet, sort_order)
select s.id, c.slug, c.name, c.snippet, c.ord
from public.geo_states s
join (values
  ('texas', 'houston', 'Houston', 'Houston''s most popular sweepstakes fish table platform', 0),
  ('texas', 'dallas', 'Dallas', 'Dallas players enjoy Fire Kirin, Juwa and 10 more games', 1),
  ('texas', 'san-antonio', 'San Antonio', 'San Antonio sweepstakes gaming — account ready instantly', 2),
  ('texas', 'austin', 'Austin', 'Austin players can access all 12 WinSweeps games', 3),
  ('texas', 'fort-worth', 'Fort Worth', 'Fort Worth online fish table games with 50% welcome bonus', 4),
  ('florida', 'miami', 'Miami', 'Miami players get 50% bonus on their first deposit', 0),
  ('florida', 'orlando', 'Orlando', 'Orlando sweepstakes games — Fire Kirin, Juwa and more', 1),
  ('florida', 'jacksonville', 'Jacksonville', 'Jacksonville fish table games available 7 days a week', 2),
  ('florida', 'tampa', 'Tampa', 'Tampa online fish tables with fast WhatsApp support', 3),
  ('georgia', 'atlanta', 'Atlanta', 'Atlanta''s #1 sweepstakes fish table gaming platform', 0),
  ('georgia', 'augusta', 'Augusta', 'Augusta players access Fire Kirin, Juwa and 10 more games', 1),
  ('georgia', 'savannah', 'Savannah', 'Savannah online sweepstakes gaming — 50% welcome bonus', 2),
  ('georgia', 'columbus-ga', 'Columbus', 'Columbus GA sweepstakes games with fast account setup', 3),
  ('california', 'los-angeles', 'Los Angeles', 'LA players get Fire Kirin, Juwa and 10 more games online', 0),
  ('california', 'san-diego', 'San Diego', 'San Diego sweepstakes gaming with 50% welcome bonus', 1),
  ('california', 'sacramento', 'Sacramento', 'Sacramento online fish table games — account ready instantly', 2),
  ('california', 'fresno', 'Fresno', 'Fresno players access all 12 WinSweeps sweepstakes games', 3),
  ('north-carolina', 'charlotte', 'Charlotte', 'Charlotte''s leading online sweepstakes fish table platform', 0),
  ('north-carolina', 'raleigh', 'Raleigh', 'Raleigh players enjoy Fire Kirin, Juwa and 10 more games', 1),
  ('north-carolina', 'greensboro', 'Greensboro', 'Greensboro online sweepstakes gaming — 50% welcome bonus', 2),
  ('ohio', 'columbus-oh', 'Columbus', 'Columbus OH sweepstakes gaming with 50% welcome bonus', 0),
  ('ohio', 'cleveland', 'Cleveland', 'Cleveland online fish table games — Fire Kirin, Juwa and more', 1),
  ('ohio', 'cincinnati', 'Cincinnati', 'Cincinnati players access all 12 WinSweeps games online', 2),
  ('michigan', 'detroit', 'Detroit', 'Detroit''s top online sweepstakes fish table gaming platform', 0),
  ('michigan', 'grand-rapids', 'Grand Rapids', 'Grand Rapids players enjoy Fire Kirin, Juwa and 10 more games', 1)
) as c(state_slug, slug, name, snippet, ord)
  on c.state_slug = s.slug;
