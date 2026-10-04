-- SPINORA — ALL MIGRATIONS COMBINED (65 files)
-- Generated: 2026-07-21T19:55:36.178Z
-- For existing DBs use supabase/SPINORA-COMPLETE-SCHEMA.sql Section A instead.

-- ==========================================
-- MIGRATION: 20260613000001_extensions_types.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0001 · Extensions & Enum Types
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ── Enums ───────────────────────────────────────────────────────────────────

create type public.app_role as enum (
  'super_admin', 'admin', 'manager', 'support_agent', 'moderator', 'customer'
);

create type public.vip_tier_key as enum (
  'silver', 'gold', 'platinum', 'diamond', 'elite'
);

create type public.reward_type as enum (
  'daily', 'weekly', 'monthly', 'streak_milestone', 'level_milestone',
  'achievement', 'referral', 'seasonal', 'promotional', 'manual'
);

create type public.ledger_currency as enum ('coins', 'xp');

create type public.ledger_entry_type as enum (
  'reward_claim', 'achievement_unlock', 'referral_bonus', 'promotion_claim',
  'vip_bonus', 'admin_adjustment', 'signup_bonus'
);

create type public.achievement_category as enum (
  'gameplay', 'social', 'loyalty', 'milestone', 'seasonal', 'special'
);

create type public.achievement_rarity as enum ('common', 'rare', 'epic', 'legendary');

create type public.achievement_condition as enum (
  'xp_total', 'level_reached', 'streak_days', 'total_claims',
  'referrals_qualified', 'profile_completed', 'favorites_added',
  'leaderboard_top10', 'vip_tier_reached', 'manual'
);

create type public.referral_status as enum ('pending', 'qualified', 'rewarded', 'rejected');

create type public.leaderboard_period as enum ('daily', 'weekly', 'monthly', 'all_time');

create type public.promo_status as enum ('draft', 'scheduled', 'active', 'expired', 'archived');

create type public.banner_placement as enum (
  'home_hero', 'home_strip', 'dashboard', 'promotions_page'
);

create type public.notification_type as enum (
  'system', 'reward', 'achievement', 'vip', 'referral',
  'promotion', 'support', 'announcement'
);

create type public.broadcast_segment as enum (
  'all', 'vip_silver_up', 'vip_gold_up', 'vip_platinum_up', 'vip_diamond_up', 'vip_elite'
);

create type public.ticket_status as enum ('open', 'pending', 'in_progress', 'resolved', 'closed');

create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');

create type public.ticket_category as enum (
  'account', 'rewards', 'vip', 'referrals', 'technical', 'other'
);

create type public.announcement_level as enum ('info', 'success', 'warning', 'critical');

-- ── updated_at convenience trigger fn ───────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ==========================================
-- MIGRATION: 20260613000002_rbac.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0002 · RBAC — roles, permissions, user assignments
-- ============================================================================

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  key         public.app_role not null unique,
  name        text not null,
  description text not null default '',
  is_system   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,           -- e.g. 'users.manage'
  name        text not null,
  module      text not null,                  -- e.g. 'users', 'cms', 'promotions'
  description text not null default '',
  created_at  timestamptz not null default now()
);

create table public.role_permissions (
  role_id       uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role_id    uuid not null references public.roles (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index idx_user_roles_user on public.user_roles (user_id);
create index idx_user_roles_role on public.user_roles (role_id);
create index idx_role_permissions_role on public.role_permissions (role_id);

-- ── Authorization helper functions (used by RLS everywhere) ─────────────────
-- SECURITY DEFINER so they can read user_roles regardless of caller's RLS.

create or replace function public.has_role(required public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.key = required
  );
$$;

create or replace function public.has_any_role(required public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.key = any (required)
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(
    array['super_admin','admin','manager','support_agent','moderator']::public.app_role[]
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(array['super_admin','admin']::public.app_role[]);
$$;

create or replace function public.has_permission(perm_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and p.key = perm_key
  ) or public.has_role('super_admin');
$$;

-- ==========================================
-- MIGRATION: 20260613000003_profiles.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0003 · Profiles, level curve, signup pipeline
-- ============================================================================

-- ── Level curve ──────────────────────────────────────────────────────────────
-- XP required to *reach* level L: 100 * (L-1)^2  (L1=0, L2=100, L3=400, L4=900…)

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

-- ── Profiles ─────────────────────────────────────────────────────────────────

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  username          citext not null unique
                    check (char_length(username) between 3 and 20
                           and username ~ '^[A-Za-z0-9_]+$'),
  display_name      text check (char_length(display_name) <= 40),
  avatar_url        text,
  bio               text check (char_length(bio) <= 280),
  country           text check (country is null or char_length(country) = 2),

  -- progression (only mutable via SECURITY DEFINER functions)
  xp                bigint not null default 0 check (xp >= 0),
  level             integer not null default 1 check (level >= 1),
  coins_balance     bigint not null default 0 check (coins_balance >= 0),
  lifetime_coins    bigint not null default 0 check (lifetime_coins >= 0),
  current_streak    integer not null default 0 check (current_streak >= 0),
  longest_streak    integer not null default 0 check (longest_streak >= 0),
  last_daily_claim  date,

  -- referral identity
  referral_code     text not null unique,
  referred_by       uuid references public.profiles (id) on delete set null,

  -- account state
  profile_completed boolean not null default false,
  marketing_opt_in  boolean not null default false,
  is_banned         boolean not null default false,
  banned_reason     text,
  banned_at         timestamptz,
  banned_by         uuid references auth.users (id) on delete set null,

  last_seen_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_profiles_referred_by on public.profiles (referred_by);
create index idx_profiles_xp on public.profiles (xp desc);
create index idx_profiles_created_at on public.profiles (created_at);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Keep level consistent with xp on every write.
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

create trigger trg_profiles_sync_level
  before insert or update of xp, current_streak on public.profiles
  for each row execute function public.sync_profile_level();

-- Customers may update only cosmetic columns through PostgREST; progression
-- and moderation columns are locked unless the writer is service_role/staff.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or public.is_admin() then
    return new;
  end if;

  if new.xp              is distinct from old.xp
     or new.level           is distinct from old.level
     or new.coins_balance   is distinct from old.coins_balance
     or new.lifetime_coins  is distinct from old.lifetime_coins
     or new.current_streak  is distinct from old.current_streak
     or new.longest_streak  is distinct from old.longest_streak
     or new.last_daily_claim is distinct from old.last_daily_claim
     or new.referral_code   is distinct from old.referral_code
     or new.referred_by     is distinct from old.referred_by
     or new.is_banned       is distinct from old.is_banned
     or new.banned_reason   is distinct from old.banned_reason
     or new.banned_at       is distinct from old.banned_at
     or new.banned_by       is distinct from old.banned_by
  then
    raise exception 'column protected' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger trg_profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ── Referral code generator (unambiguous alphabet, retry on collision) ──────

create or replace function public.generate_referral_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := 'WS-';
    for i in 1..7 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where referral_code = code);
  end loop;
  return code;
end;
$$;

-- ── Signup pipeline: auth.users → profile + role + prefs + referral intake ──

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_username citext;
  suffix int := 0;
  final_username citext;
  ref_code text;
  referrer public.profiles%rowtype;
  customer_role_id uuid;
begin
  desired_username := coalesce(
    nullif(regexp_replace(new.raw_user_meta_data ->> 'username', '[^A-Za-z0-9_]', '', 'g'), ''),
    split_part(new.email, '@', 1)
  );
  desired_username := substr(desired_username, 1, 20);
  if char_length(desired_username) < 3 then
    desired_username := 'player' || substr(new.id::text, 1, 6);
  end if;

  final_username := desired_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := substr(desired_username, 1, 20 - char_length(suffix::text)) || suffix;
  end loop;

  insert into public.profiles (id, username, display_name, referral_code)
  values (
    new.id,
    final_username,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    public.generate_referral_code()
  );

  -- default role: customer
  select id into customer_role_id from public.roles where key = 'customer';
  if customer_role_id is not null then
    insert into public.user_roles (user_id, role_id) values (new.id, customer_role_id)
    on conflict do nothing;
  end if;

  -- referral intake (code captured at signup)
  ref_code := upper(nullif(new.raw_user_meta_data ->> 'referral_code', ''));
  if ref_code is not null then
    select * into referrer from public.profiles where referral_code = ref_code;
    if found and referrer.id <> new.id then
      update public.profiles set referred_by = referrer.id where id = new.id;
      insert into public.referrals (referrer_id, referred_id, code_used)
      values (referrer.id, new.id, ref_code);
    end if;
  end if;

  insert into public.notification_preferences (user_id) values (new.id)
  on conflict do nothing;

  return new;
end;
$$;

-- Trigger is attached in 0015 (after referrals & notification tables exist).

-- ── Public leaderboard-safe projection ───────────────────────────────────────

create or replace view public.public_profiles
with (security_invoker = off)
as
select
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.country,
  p.xp,
  p.level,
  p.current_streak,
  p.created_at
from public.profiles p
where p.is_banned = false;

-- ==========================================
-- MIGRATION: 20260613000004_vip.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0004 · VIP program — tiers, member status, history
-- ============================================================================

create table public.vip_tiers (
  id                uuid primary key default gen_random_uuid(),
  key               public.vip_tier_key not null unique,
  name              text not null,
  rank              integer not null unique check (rank >= 1),   -- 1 = silver … 5 = elite
  min_xp            bigint not null check (min_xp >= 0),
  reward_multiplier numeric(4,2) not null default 1.00 check (reward_multiplier >= 1.00),
  color             text not null default '#C7CCD6',
  benefits          jsonb not null default '[]'::jsonb,          -- [{title, description, icon}]
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_vip_tiers_updated_at
  before update on public.vip_tiers
  for each row execute function public.set_updated_at();

create table public.vip_status (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  tier_id         uuid not null references public.vip_tiers (id),
  is_override     boolean not null default false,
  override_reason text,
  override_by     uuid references auth.users (id) on delete set null,
  achieved_at     timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_vip_status_updated_at
  before update on public.vip_status
  for each row execute function public.set_updated_at();

create table public.vip_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  from_tier   uuid references public.vip_tiers (id),
  to_tier     uuid not null references public.vip_tiers (id),
  reason      text not null default 'xp_progression',
  created_at  timestamptz not null default now()
);

create index idx_vip_history_user on public.vip_history (user_id, created_at desc);

-- Resolve the tier a given XP total earns (highest tier whose min_xp <= xp).
create or replace function public.tier_for_xp(xp_total bigint)
returns uuid
language sql
stable
as $$
  select id
  from public.vip_tiers
  where is_active and min_xp <= xp_total
  order by rank desc
  limit 1;
$$;

-- Re-evaluate a member's tier after an XP change. Returns new tier id when changed.
create or replace function public.evaluate_vip_tier(target_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  member_xp bigint;
  earned_tier uuid;
  current_tier uuid;
  current_override boolean;
begin
  select xp into member_xp from public.profiles where id = target_user;
  if not found then return null; end if;

  earned_tier := public.tier_for_xp(member_xp);
  if earned_tier is null then return null; end if;

  select tier_id, is_override into current_tier, current_override
  from public.vip_status where user_id = target_user;

  if not found then
    insert into public.vip_status (user_id, tier_id) values (target_user, earned_tier);
    insert into public.vip_history (user_id, from_tier, to_tier)
    values (target_user, null, earned_tier);
    return earned_tier;
  end if;

  -- never auto-downgrade, never fight a manual override
  if current_override or current_tier = earned_tier then
    return null;
  end if;

  if (select rank from public.vip_tiers where id = earned_tier)
   > (select rank from public.vip_tiers where id = current_tier) then
    update public.vip_status
      set tier_id = earned_tier, achieved_at = now()
      where user_id = target_user;
    insert into public.vip_history (user_id, from_tier, to_tier)
    values (target_user, current_tier, earned_tier);
    return earned_tier;
  end if;

  return null;
end;
$$;

-- Active reward multiplier for a member (1.00 when tier unknown).
create or replace function public.member_multiplier(target_user uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select t.reward_multiplier
     from public.vip_status s
     join public.vip_tiers t on t.id = s.tier_id
     where s.user_id = target_user),
    1.00
  );
$$;

-- ==========================================
-- MIGRATION: 20260613000005_rewards_ledger.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0005 · Reward rules, claims, unified ledger
-- ============================================================================

-- ── Admin-controlled reward rules ────────────────────────────────────────────
-- One row per claimable reward stream. `config` carries stream-specific knobs:
--   daily:   {"streak_bonus_per_day": 5, "streak_bonus_cap": 50}
--   weekly:  {"required_daily_claims": 5}
--   monthly: {"required_daily_claims": 20}
--   streak_milestone: {"days": 7}
--   seasonal:{"label": "Summer Drop"}

create table public.reward_rules (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,                  -- 'daily_login', 'weekly_chest'…
  name        text not null,
  description text not null default '',
  reward_type public.reward_type not null,
  coins       bigint not null default 0 check (coins >= 0),
  xp          bigint not null default 0 check (xp >= 0),
  config      jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create trigger trg_reward_rules_updated_at
  before update on public.reward_rules
  for each row execute function public.set_updated_at();

create index idx_reward_rules_type on public.reward_rules (reward_type) where is_active;

-- ── Claims (idempotent per user/stream/period) ───────────────────────────────
-- period_key examples: daily '2026-06-13' · weekly '2026-W24' · monthly '2026-06'
-- streak_milestone 'streak-7' · achievement '<achievement_id>' · referral '<referral_id>'

create table public.reward_claims (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  rule_id            uuid references public.reward_rules (id) on delete set null,
  reward_type        public.reward_type not null,
  period_key         text not null,
  coins_awarded      bigint not null default 0 check (coins_awarded >= 0),
  xp_awarded         bigint not null default 0 check (xp_awarded >= 0),
  multiplier_applied numeric(4,2) not null default 1.00,
  streak_at_claim    integer,
  claimed_at         timestamptz not null default now(),
  unique (user_id, reward_type, period_key)
);

create index idx_reward_claims_user on public.reward_claims (user_id, claimed_at desc);
create index idx_reward_claims_rule on public.reward_claims (rule_id);
create index idx_reward_claims_type_period on public.reward_claims (reward_type, period_key);

-- ── Unified progression ledger (coins + xp, append-only) ─────────────────────

create table public.ledger_entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  currency       public.ledger_currency not null,
  amount         bigint not null,                    -- signed; xp never negative by policy
  balance_after  bigint not null check (balance_after >= 0),
  entry_type     public.ledger_entry_type not null,
  reference_type text,                               -- 'reward_claim' | 'achievement' | …
  reference_id   uuid,
  description    text not null default '',
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index idx_ledger_user_currency on public.ledger_entries (user_id, currency, created_at desc);
create index idx_ledger_created_at on public.ledger_entries (created_at desc);
create index idx_ledger_entry_type on public.ledger_entries (entry_type);

-- Ledger is append-only for everyone except service_role.
create or replace function public.forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' then
    return coalesce(new, old);
  end if;
  raise exception 'append-only table' using errcode = '42501';
end;
$$;

create trigger trg_ledger_no_update before update on public.ledger_entries
  for each row execute function public.forbid_mutation();
create trigger trg_ledger_no_delete before delete on public.ledger_entries
  for each row execute function public.forbid_mutation();

-- ── Core grant primitives (SECURITY DEFINER; called by claim/unlock flows) ──

create or replace function public.grant_coins(
  target_user uuid,
  amount bigint,
  entry_type public.ledger_entry_type,
  ref_type text default null,
  ref_id uuid default null,
  note text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance bigint;
begin
  if amount = 0 then
    select coins_balance into new_balance from public.profiles where id = target_user;
    return new_balance;
  end if;

  update public.profiles
     set coins_balance  = coins_balance + amount,
         lifetime_coins = lifetime_coins + greatest(amount, 0)
   where id = target_user
   returning coins_balance into new_balance;

  if not found then
    raise exception 'profile % not found', target_user;
  end if;

  insert into public.ledger_entries
    (user_id, currency, amount, balance_after, entry_type, reference_type, reference_id, description)
  values
    (target_user, 'coins', amount, new_balance, entry_type, ref_type, ref_id, note);

  return new_balance;
end;
$$;

create or replace function public.grant_xp(
  target_user uuid,
  amount bigint,
  entry_type public.ledger_entry_type,
  ref_type text default null,
  ref_id uuid default null,
  note text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total bigint;
  old_level int;
  new_level int;
begin
  if amount <= 0 then
    select xp into new_total from public.profiles where id = target_user;
    return new_total;
  end if;

  select level into old_level from public.profiles where id = target_user;

  update public.profiles
     set xp = xp + amount
   where id = target_user
   returning xp, level into new_total, new_level;

  if not found then
    raise exception 'profile % not found', target_user;
  end if;

  insert into public.ledger_entries
    (user_id, currency, amount, balance_after, entry_type, reference_type, reference_id, description)
  values
    (target_user, 'xp', amount, new_total, entry_type, ref_type, ref_id, note);

  -- side-effects of leveling: VIP tier re-check + notification
  if new_level > old_level then
    perform public.evaluate_vip_tier(target_user);
    insert into public.notifications (user_id, type, title, body, link_url)
    values (
      target_user, 'reward',
      'Level up!',
      format('You reached level %s. Keep the streak alive.', new_level),
      '/dashboard/rewards'
    );
  end if;

  return new_total;
end;
$$;

-- ==========================================
-- MIGRATION: 20260613000006_achievements.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0006 · Achievements & user progress
-- ============================================================================

create table public.achievements (
  id              uuid primary key default gen_random_uuid(),
  key             text not null unique,            -- 'first_claim', 'streak_7'…
  name            text not null,
  description     text not null,
  category        public.achievement_category not null default 'milestone',
  rarity          public.achievement_rarity not null default 'common',
  icon            text not null default 'trophy',  -- lucide icon name
  condition_type  public.achievement_condition not null,
  condition_value bigint not null default 1 check (condition_value >= 1),
  xp_reward       bigint not null default 0 check (xp_reward >= 0),
  coins_reward    bigint not null default 0 check (coins_reward >= 0),
  is_secret       boolean not null default false,
  is_active       boolean not null default true,
  sort_order      integer not null default 100,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_achievements_updated_at
  before update on public.achievements
  for each row execute function public.set_updated_at();

create index idx_achievements_active on public.achievements (sort_order) where is_active;

create table public.user_achievements (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  progress       bigint not null default 0 check (progress >= 0),
  unlocked_at    timestamptz,
  primary key (user_id, achievement_id)
);

create index idx_user_achievements_user on public.user_achievements (user_id, unlocked_at desc);

-- ── Metric source for condition evaluation ──────────────────────────────────

create or replace function public.achievement_metric(
  target_user uuid,
  cond public.achievement_condition
)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v bigint := 0;
begin
  case cond
    when 'xp_total' then
      select xp into v from public.profiles where id = target_user;
    when 'level_reached' then
      select level into v from public.profiles where id = target_user;
    when 'streak_days' then
      select longest_streak into v from public.profiles where id = target_user;
    when 'total_claims' then
      select count(*) into v from public.reward_claims where user_id = target_user;
    when 'referrals_qualified' then
      select count(*) into v from public.referrals
       where referrer_id = target_user and status in ('qualified', 'rewarded');
    when 'profile_completed' then
      select case when profile_completed then 1 else 0 end into v
        from public.profiles where id = target_user;
    when 'favorites_added' then
      select count(*) into v from public.user_favorites where user_id = target_user;
    when 'leaderboard_top10' then
      select count(*) into v from public.leaderboard_entries
       where user_id = target_user and rank <= 10 and finalized;
    when 'vip_tier_reached' then
      select coalesce(t.rank, 0) into v
        from public.vip_status s join public.vip_tiers t on t.id = s.tier_id
       where s.user_id = target_user;
    else
      v := 0;  -- 'manual' achievements are granted by staff
  end case;
  return coalesce(v, 0);
end;
$$;

-- ── Evaluate & unlock; pays rewards through grant primitives ────────────────

create or replace function public.evaluate_achievements(target_user uuid)
returns setof uuid     -- ids of achievements newly unlocked
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  metric bigint;
begin
  for a in
    select * from public.achievements
    where is_active and condition_type <> 'manual'
  loop
    metric := public.achievement_metric(target_user, a.condition_type);

    insert into public.user_achievements (user_id, achievement_id, progress)
    values (target_user, a.id, least(metric, a.condition_value))
    on conflict (user_id, achievement_id) do update
      set progress = least(greatest(excluded.progress, user_achievements.progress), a.condition_value)
      where user_achievements.unlocked_at is null;

    if metric >= a.condition_value then
      update public.user_achievements
         set unlocked_at = now(), progress = a.condition_value
       where user_id = target_user
         and achievement_id = a.id
         and unlocked_at is null;

      if found then
        if a.coins_reward > 0 then
          perform public.grant_coins(target_user, a.coins_reward, 'achievement_unlock',
                                     'achievement', a.id, a.name);
        end if;
        if a.xp_reward > 0 then
          perform public.grant_xp(target_user, a.xp_reward, 'achievement_unlock',
                                  'achievement', a.id, a.name);
        end if;

        insert into public.notifications (user_id, type, title, body, link_url, icon)
        values (
          target_user, 'achievement',
          'Achievement unlocked',
          format('%s — %s', a.name, a.description),
          '/dashboard/achievements', a.icon
        );

        insert into public.activity_log (user_id, action, description, metadata)
        values (
          target_user, 'achievement_unlocked', a.name,
          jsonb_build_object('achievement_id', a.id, 'rarity', a.rarity)
        );

        return next a.id;
      end if;
    end if;
  end loop;
end;
$$;

-- ==========================================
-- MIGRATION: 20260613000007_referrals_leaderboards.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0007 · Referrals (with fraud surface) + leaderboards
-- ============================================================================

create table public.referrals (
  id                 uuid primary key default gen_random_uuid(),
  referrer_id        uuid not null references public.profiles (id) on delete cascade,
  referred_id        uuid not null unique references public.profiles (id) on delete cascade,
  code_used          text not null,
  status             public.referral_status not null default 'pending',
  -- fraud surface
  signup_ip_hash     text,
  device_fingerprint text,
  fraud_score        integer not null default 0 check (fraud_score between 0 and 100),
  fraud_flags        jsonb not null default '[]'::jsonb,
  -- lifecycle
  qualified_at       timestamptz,
  rewarded_at        timestamptz,
  rejected_reason    text,
  created_at         timestamptz not null default now(),
  check (referrer_id <> referred_id)
);

create index idx_referrals_referrer on public.referrals (referrer_id, created_at desc);
create index idx_referrals_status on public.referrals (status);

-- Qualification: a referral converts when the referred member completes their
-- profile AND reaches level 2 — both checked here; called from those flows.
create or replace function public.qualify_referral(referred_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.referrals%rowtype;
  p public.profiles%rowtype;
  rule public.reward_rules%rowtype;
  same_ip_count int;
  payout_coins bigint;
  payout_xp bigint;
begin
  select * into r from public.referrals
   where referred_id = referred_user and status = 'pending'
   for update;
  if not found then return; end if;

  select * into p from public.profiles where id = referred_user;
  if not (p.profile_completed and p.level >= 2) then return; end if;

  -- fraud heuristics: shared signup IP across many referrals of same referrer
  if r.signup_ip_hash is not null then
    select count(*) into same_ip_count
      from public.referrals
     where referrer_id = r.referrer_id
       and signup_ip_hash = r.signup_ip_hash
       and id <> r.id;
    if same_ip_count >= 2 then
      update public.referrals
         set status = 'rejected',
             fraud_score = least(100, 40 + same_ip_count * 20),
             fraud_flags = fraud_flags || '["shared_ip_cluster"]'::jsonb,
             rejected_reason = 'Automated fraud check: shared signup network'
       where id = r.id;
      return;
    end if;
  end if;

  update public.referrals
     set status = 'qualified', qualified_at = now()
   where id = r.id;

  -- pay the referrer per the active referral rule
  select * into rule from public.reward_rules
   where reward_type = 'referral' and is_active
   order by created_at desc limit 1;

  if found then
    payout_coins := round(rule.coins * public.member_multiplier(r.referrer_id));
    payout_xp := rule.xp;

    insert into public.reward_claims
      (user_id, rule_id, reward_type, period_key, coins_awarded, xp_awarded, multiplier_applied)
    values
      (r.referrer_id, rule.id, 'referral', r.id::text, payout_coins, payout_xp,
       public.member_multiplier(r.referrer_id))
    on conflict (user_id, reward_type, period_key) do nothing;

    if found then
      perform public.grant_coins(r.referrer_id, payout_coins, 'referral_bonus', 'referral', r.id,
                                 'Referral qualified: ' || p.username);
      perform public.grant_xp(r.referrer_id, payout_xp, 'referral_bonus', 'referral', r.id,
                              'Referral qualified: ' || p.username);
    end if;

    update public.referrals set status = 'rewarded', rewarded_at = now() where id = r.id;

    insert into public.notifications (user_id, type, title, body, link_url)
    values (
      r.referrer_id, 'referral',
      'Referral qualified',
      format('%s joined through your code — bonus credited.', p.username),
      '/dashboard/referrals'
    );

    insert into public.activity_log (user_id, action, description, metadata)
    values (r.referrer_id, 'referral_rewarded', 'Referral bonus earned',
            jsonb_build_object('referral_id', r.id));
  end if;

  perform public.evaluate_achievements(r.referrer_id);
end;
$$;

-- ── Leaderboards ─────────────────────────────────────────────────────────────
-- Entries are upserted live from the XP ledger (per period) and finalized by a
-- scheduled snapshot at period end. score = XP earned within the period.

create table public.leaderboard_entries (
  id          uuid primary key default gen_random_uuid(),
  period      public.leaderboard_period not null,
  period_key  text not null,                      -- '2026-06-13' | '2026-W24' | '2026-06' | 'all'
  user_id     uuid not null references public.profiles (id) on delete cascade,
  score       bigint not null default 0 check (score >= 0),
  rank        integer,
  finalized   boolean not null default false,
  computed_at timestamptz not null default now(),
  unique (period, period_key, user_id)
);

create index idx_leaderboard_lookup
  on public.leaderboard_entries (period, period_key, rank);
create index idx_leaderboard_user
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

-- Rebuild (or refresh) a leaderboard period from the ledger.
create or replace function public.compute_leaderboard(
  p public.leaderboard_period,
  p_key text default null,
  finalize boolean default false
)
returns integer  -- rows written
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
    join public.profiles pr on pr.id = le.user_id and pr.is_banned = false
    where le.currency = 'xp'
      and le.amount > 0
      and le.created_at >= range_start
      and le.created_at < range_end
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

-- ==========================================
-- MIGRATION: 20260613000008_promotions_notifications.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0008 · Promotions, banners, notifications, broadcasts
-- ============================================================================

create table public.promotions (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title               text not null,
  summary             text not null default '',
  description         text not null default '',
  image_url           text,
  badge_text          text,                        -- 'LIMITED', 'NEW', '2X'
  coins_bonus         bigint not null default 0 check (coins_bonus >= 0),
  xp_bonus            bigint not null default 0 check (xp_bonus >= 0),
  code                text unique,                 -- optional redeem code
  status              public.promo_status not null default 'draft',
  is_featured         boolean not null default false,
  priority            integer not null default 100,
  starts_at           timestamptz,
  ends_at             timestamptz,
  max_claims          integer check (max_claims is null or max_claims > 0),
  max_claims_per_user integer not null default 1 check (max_claims_per_user > 0),
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create trigger trg_promotions_updated_at
  before update on public.promotions
  for each row execute function public.set_updated_at();

create index idx_promotions_live
  on public.promotions (priority, starts_at)
  where status = 'active';

create table public.promotion_claims (
  id           uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  claim_no     integer not null default 1,
  claimed_at   timestamptz not null default now(),
  unique (promotion_id, user_id, claim_no)
);

create index idx_promotion_claims_promo on public.promotion_claims (promotion_id);
create index idx_promotion_claims_user on public.promotion_claims (user_id, claimed_at desc);

create table public.banners (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  subtitle   text,
  image_url  text,
  link_url   text,
  placement  public.banner_placement not null default 'home_strip',
  is_active  boolean not null default false,
  priority   integer not null default 100,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_banners_updated_at
  before update on public.banners
  for each row execute function public.set_updated_at();

create index idx_banners_placement on public.banners (placement, priority) where is_active;

-- ── Notifications ────────────────────────────────────────────────────────────

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       public.notification_type not null default 'system',
  title      text not null,
  body       text not null default '',
  link_url   text,
  icon       text,
  is_read    boolean not null default false,
  read_at    timestamptz,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_notifications_user
  on public.notifications (user_id, created_at desc);
create index idx_notifications_unread
  on public.notifications (user_id) where is_read = false;

create table public.notification_preferences (
  user_id             uuid primary key references public.profiles (id) on delete cascade,
  email_rewards       boolean not null default true,
  email_promotions    boolean not null default true,
  email_vip           boolean not null default true,
  email_referrals     boolean not null default true,
  email_support       boolean not null default true,
  email_announcements boolean not null default true,
  inapp_rewards       boolean not null default true,
  inapp_promotions    boolean not null default true,
  inapp_vip           boolean not null default true,
  inapp_referrals     boolean not null default true,
  inapp_support       boolean not null default true,
  inapp_announcements boolean not null default true,
  updated_at          timestamptz not null default now()
);

create trigger trg_notification_prefs_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ── Broadcasts (staff → segment fan-out) ─────────────────────────────────────

create table public.broadcasts (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  body            text not null,
  link_url        text,
  segment         public.broadcast_segment not null default 'all',
  recipient_count integer not null default 0,
  sent_by         uuid references auth.users (id) on delete set null,
  sent_at         timestamptz not null default now()
);

create or replace function public.send_broadcast(
  p_title text,
  p_body text,
  p_link_url text default null,
  p_segment public.broadcast_segment default 'all'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  min_rank int := case p_segment
    when 'all' then 0
    when 'vip_silver_up' then 1
    when 'vip_gold_up' then 2
    when 'vip_platinum_up' then 3
    when 'vip_diamond_up' then 4
    when 'vip_elite' then 5
  end;
  b_id uuid;
  n int;
begin
  if not public.has_permission('notifications.broadcast') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.broadcasts (title, body, link_url, segment, sent_by)
  values (p_title, p_body, p_link_url, p_segment, auth.uid())
  returning id into b_id;

  insert into public.notifications (user_id, type, title, body, link_url, metadata)
  select p.id, 'announcement', p_title, p_body, p_link_url,
         jsonb_build_object('broadcast_id', b_id)
  from public.profiles p
  left join public.vip_status vs on vs.user_id = p.id
  left join public.vip_tiers vt on vt.id = vs.tier_id
  join public.notification_preferences np on np.user_id = p.id
  where p.is_banned = false
    and np.inapp_announcements
    and coalesce(vt.rank, 0) >= min_rank;

  get diagnostics n = row_count;
  update public.broadcasts set recipient_count = n where id = b_id;
  return b_id;
end;
$$;

-- ==========================================
-- MIGRATION: 20260613000009_support_cms_catalog.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0009 · Support desk, CMS, game catalog, activity & audit
-- ============================================================================

-- ── Support ──────────────────────────────────────────────────────────────────

create table public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  ticket_no       bigint generated always as identity unique,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  subject         text not null check (char_length(subject) between 3 and 140),
  category        public.ticket_category not null default 'other',
  status          public.ticket_status not null default 'open',
  priority        public.ticket_priority not null default 'normal',
  assigned_to     uuid references auth.users (id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  closed_at       timestamptz
);

create trigger trg_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

create index idx_tickets_user on public.support_tickets (user_id, created_at desc);
create index idx_tickets_queue on public.support_tickets (status, priority, last_message_at);
create index idx_tickets_assignee on public.support_tickets (assigned_to) where assigned_to is not null;

create table public.ticket_messages (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references public.support_tickets (id) on delete cascade,
  sender_id      uuid not null references auth.users (id) on delete cascade,
  is_staff       boolean not null default false,
  body           text not null check (char_length(body) between 1 and 5000),
  attachment_url text,
  created_at     timestamptz not null default now()
);

create index idx_ticket_messages_ticket on public.ticket_messages (ticket_id, created_at);

create or replace function public.touch_ticket_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_tickets
     set last_message_at = new.created_at,
         status = case
           when new.is_staff and status = 'open' then 'in_progress'::public.ticket_status
           when not new.is_staff and status in ('resolved') then 'open'::public.ticket_status
           else status
         end
   where id = new.ticket_id;
  return new;
end;
$$;

create trigger trg_ticket_messages_touch
  after insert on public.ticket_messages
  for each row execute function public.touch_ticket_on_message();

-- ── CMS ──────────────────────────────────────────────────────────────────────

create table public.cms_pages (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9/-]+$'),
  title           text not null,
  content         jsonb not null default '{}'::jsonb,   -- structured blocks per page
  seo_title       text,
  seo_description text,
  og_image_url    text,
  is_published    boolean not null default false,
  published_at    timestamptz,
  updated_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_cms_pages_updated_at
  before update on public.cms_pages
  for each row execute function public.set_updated_at();

create table public.faqs (
  id           uuid primary key default gen_random_uuid(),
  question     text not null,
  answer       text not null,
  category     text not null default 'general',
  sort_order   integer not null default 100,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_faqs_updated_at
  before update on public.faqs
  for each row execute function public.set_updated_at();

create index idx_faqs_published on public.faqs (category, sort_order) where is_published;

create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null default '',
  level      public.announcement_level not null default 'info',
  is_active  boolean not null default false,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

create table public.blog_posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title           text not null,
  excerpt         text not null default '',
  content         text not null default '',              -- markdown
  cover_image_url text,
  tags            text[] not null default '{}',
  author_id       uuid references auth.users (id) on delete set null,
  is_published    boolean not null default false,
  published_at    timestamptz,
  seo_title       text,
  seo_description text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

create index idx_blog_published on public.blog_posts (published_at desc) where is_published;

create table public.testimonials (
  id           uuid primary key default gen_random_uuid(),
  author_name  text not null,
  author_title text not null default '',
  avatar_url   text,
  quote        text not null,
  rating       integer not null default 5 check (rating between 1 and 5),
  is_featured  boolean not null default false,
  is_published boolean not null default true,
  sort_order   integer not null default 100,
  created_at   timestamptz not null default now()
);

-- ── Game catalog (content only — no wagering mechanics) ─────────────────────

create table public.game_categories (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  name       text not null,
  icon       text not null default 'gamepad-2',
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table public.games (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  category_id uuid not null references public.game_categories (id) on delete restrict,
  description text not null default '',
  image_url   text,
  badge_text  text,                                  -- 'HOT', 'NEW', 'EVENT'
  is_featured boolean not null default false,
  is_active   boolean not null default true,
  popularity  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_games_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

create index idx_games_category on public.games (category_id, popularity desc) where is_active;

create table public.user_favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game_id    uuid not null references public.games (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- ── Activity log (user-facing) & audit log (admin/security) ─────────────────

create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  action      text not null,                         -- 'reward_claimed', 'level_up'…
  description text not null default '',
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index idx_activity_user on public.activity_log (user_id, created_at desc);

create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,                         -- 'user.ban', 'promo.update'…
  entity_type text not null,
  entity_id   text,
  before_data jsonb,
  after_data  jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index idx_audit_actor on public.audit_logs (actor_id, created_at desc);
create index idx_audit_entity on public.audit_logs (entity_type, entity_id);
create index idx_audit_created on public.audit_logs (created_at desc);

create trigger trg_audit_no_update before update on public.audit_logs
  for each row execute function public.forbid_mutation();
create trigger trg_audit_no_delete before delete on public.audit_logs
  for each row execute function public.forbid_mutation();

-- ── Site settings (key/value, admin-managed) ─────────────────────────────────

create table public.site_settings (
  key         text primary key,
  value       jsonb not null,
  description text not null default '',
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);

create trigger trg_site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ==========================================
-- MIGRATION: 20260613000010_claim_engine.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0010 · Claim engine — daily/weekly/monthly/streak/promotions
-- ============================================================================

-- Single entry point the app calls: select * from claim_reward('daily_login');
-- Concurrency-safe via the unique (user_id, reward_type, period_key) constraint
-- + advisory lock per user.

create or replace function public.claim_reward(rule_key text)
returns table (
  claim_id uuid,
  coins_awarded bigint,
  xp_awarded bigint,
  multiplier numeric,
  streak integer,
  new_balance bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rule public.reward_rules%rowtype;
  p public.profiles%rowtype;
  pkey text;
  mult numeric(4,2);
  payout_coins bigint;
  payout_xp bigint;
  streak_now int := 0;
  daily_claims_in_period int;
  required_claims int;
  c_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtext('claim:' || uid::text));

  select * into rule from public.reward_rules
   where key = rule_key and is_active
     and (starts_at is null or starts_at <= now())
     and (ends_at is null or ends_at > now());
  if not found then
    raise exception 'reward unavailable' using errcode = 'P0001';
  end if;

  select * into p from public.profiles where id = uid for update;
  if p.is_banned then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  mult := public.member_multiplier(uid);
  pkey := public.period_key_for(
    case rule.reward_type
      when 'daily' then 'daily'::public.leaderboard_period
      when 'weekly' then 'weekly'::public.leaderboard_period
      when 'monthly' then 'monthly'::public.leaderboard_period
      else 'daily'::public.leaderboard_period
    end
  );

  -- ── stream-specific eligibility ────────────────────────────────────────
  if rule.reward_type = 'daily' then
    -- streak: consecutive-day logic anchored on last_daily_claim
    if p.last_daily_claim = current_date then
      raise exception 'already claimed today' using errcode = 'P0002';
    elsif p.last_daily_claim = current_date - 1 then
      streak_now := p.current_streak + 1;
    else
      streak_now := 1;
    end if;

    payout_coins := rule.coins
      + least(
          coalesce((rule.config ->> 'streak_bonus_per_day')::bigint, 0) * (streak_now - 1),
          coalesce((rule.config ->> 'streak_bonus_cap')::bigint, 0)
        );

  elsif rule.reward_type in ('weekly', 'monthly') then
    -- requires N daily claims inside the current period
    required_claims := coalesce((rule.config ->> 'required_daily_claims')::int, 0);
    select count(*) into daily_claims_in_period
      from public.reward_claims rc
     where rc.user_id = uid
       and rc.reward_type = 'daily'
       and (
         (rule.reward_type = 'weekly'
            and to_char(rc.claimed_at at time zone 'utc', 'IYYY"-W"IW') = pkey)
         or
         (rule.reward_type = 'monthly'
            and to_char(rc.claimed_at at time zone 'utc', 'YYYY-MM') = pkey)
       );
    if daily_claims_in_period < required_claims then
      raise exception 'requires % daily claims this period (you have %)',
        required_claims, daily_claims_in_period using errcode = 'P0003';
    end if;
    payout_coins := rule.coins;
    streak_now := p.current_streak;

  elsif rule.reward_type = 'streak_milestone' then
    required_claims := coalesce((rule.config ->> 'days')::int, 7);
    if p.current_streak < required_claims then
      raise exception 'streak of % required', required_claims using errcode = 'P0004';
    end if;
    pkey := 'streak-' || required_claims::text;   -- one-time per milestone
    payout_coins := rule.coins;
    streak_now := p.current_streak;

  elsif rule.reward_type = 'seasonal' then
    pkey := coalesce(rule.config ->> 'season_key', rule.key);
    payout_coins := rule.coins;
    streak_now := p.current_streak;

  else
    raise exception 'stream not claimable here' using errcode = 'P0005';
  end if;

  payout_coins := round(payout_coins * mult);
  payout_xp := rule.xp;

  -- ── idempotent claim write ─────────────────────────────────────────────
  insert into public.reward_claims
    (user_id, rule_id, reward_type, period_key, coins_awarded, xp_awarded,
     multiplier_applied, streak_at_claim)
  values
    (uid, rule.id, rule.reward_type, pkey, payout_coins, payout_xp, mult, streak_now)
  on conflict (user_id, reward_type, period_key) do nothing
  returning id into c_id;

  if c_id is null then
    raise exception 'already claimed' using errcode = 'P0002';
  end if;

  -- ── streak bookkeeping for daily stream ────────────────────────────────
  if rule.reward_type = 'daily' then
    update public.profiles
       set current_streak = streak_now,
           last_daily_claim = current_date
     where id = uid;
  end if;

  -- ── payout ─────────────────────────────────────────────────────────────
  perform public.grant_coins(uid, payout_coins, 'reward_claim', 'reward_claim', c_id, rule.name);
  perform public.grant_xp(uid, payout_xp, 'reward_claim', 'reward_claim', c_id, rule.name);

  insert into public.activity_log (user_id, action, description, metadata)
  values (uid, 'reward_claimed', rule.name,
          jsonb_build_object('rule', rule.key, 'coins', payout_coins, 'xp', payout_xp,
                             'streak', streak_now, 'multiplier', mult));

  -- refresh live leaderboards for the user's gain (cheap upsert per period)
  perform public.evaluate_achievements(uid);

  select coins_balance into new_balance from public.profiles where id = uid;
  claim_id := c_id;
  coins_awarded := payout_coins;
  xp_awarded := payout_xp;
  multiplier := mult;
  streak := streak_now;
  return next;
end;
$$;

-- ── Promotion claim (separate flow: promo bonuses + caps) ────────────────────

create or replace function public.claim_promotion(promo_slug text, redeem_code text default null)
returns table (claim_id uuid, coins_awarded bigint, xp_awarded bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  promo public.promotions%rowtype;
  prior_claims int;
  total_claims int;
  c_id uuid;
  payout_coins bigint;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtext('promo:' || uid::text));

  select * into promo from public.promotions
   where slug = promo_slug
     and status = 'active'
     and (starts_at is null or starts_at <= now())
     and (ends_at is null or ends_at > now())
   for update;
  if not found then
    raise exception 'promotion unavailable' using errcode = 'P0001';
  end if;

  if promo.code is not null and (redeem_code is null or upper(redeem_code) <> upper(promo.code)) then
    raise exception 'invalid promo code' using errcode = 'P0006';
  end if;

  if exists (select 1 from public.profiles where id = uid and is_banned) then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  select count(*) into prior_claims
    from public.promotion_claims
   where promotion_id = promo.id and user_id = uid;
  if prior_claims >= promo.max_claims_per_user then
    raise exception 'already claimed' using errcode = 'P0002';
  end if;

  if promo.max_claims is not null then
    select count(*) into total_claims from public.promotion_claims where promotion_id = promo.id;
    if total_claims >= promo.max_claims then
      raise exception 'promotion fully claimed' using errcode = 'P0007';
    end if;
  end if;

  insert into public.promotion_claims (promotion_id, user_id, claim_no)
  values (promo.id, uid, prior_claims + 1)
  returning id into c_id;

  payout_coins := round(promo.coins_bonus * public.member_multiplier(uid));

  perform public.grant_coins(uid, payout_coins, 'promotion_claim', 'promotion', promo.id, promo.title);
  perform public.grant_xp(uid, promo.xp_bonus, 'promotion_claim', 'promotion', promo.id, promo.title);

  insert into public.activity_log (user_id, action, description, metadata)
  values (uid, 'promotion_claimed', promo.title,
          jsonb_build_object('promotion_id', promo.id, 'coins', payout_coins, 'xp', promo.xp_bonus));

  insert into public.notifications (user_id, type, title, body, link_url)
  values (uid, 'promotion', 'Bonus claimed',
          format('%s credited to your vault.', promo.title), '/dashboard/rewards');

  perform public.evaluate_achievements(uid);

  claim_id := c_id;
  coins_awarded := payout_coins;
  xp_awarded := promo.xp_bonus;
  return next;
end;
$$;

-- ── Profile completion hook (referral qualification + achievement) ──────────

create or replace function public.complete_profile_side_effects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.profile_completed and not old.profile_completed then
    perform public.evaluate_achievements(new.id);
    perform public.qualify_referral(new.id);
  end if;
  return new;
end;
$$;

create trigger trg_profiles_completion
  after update of profile_completed on public.profiles
  for each row execute function public.complete_profile_side_effects();

-- ==========================================
-- MIGRATION: 20260613000011_rls.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0011 · Row Level Security — every table locked by default
-- ============================================================================

-- ── Enable RLS everywhere ────────────────────────────────────────────────────

alter table public.roles                    enable row level security;
alter table public.permissions              enable row level security;
alter table public.role_permissions         enable row level security;
alter table public.user_roles               enable row level security;
alter table public.profiles                 enable row level security;
alter table public.vip_tiers                enable row level security;
alter table public.vip_status               enable row level security;
alter table public.vip_history              enable row level security;
alter table public.reward_rules             enable row level security;
alter table public.reward_claims            enable row level security;
alter table public.ledger_entries           enable row level security;
alter table public.achievements             enable row level security;
alter table public.user_achievements        enable row level security;
alter table public.referrals                enable row level security;
alter table public.leaderboard_entries      enable row level security;
alter table public.promotions               enable row level security;
alter table public.promotion_claims         enable row level security;
alter table public.banners                  enable row level security;
alter table public.notifications            enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.broadcasts               enable row level security;
alter table public.support_tickets          enable row level security;
alter table public.ticket_messages          enable row level security;
alter table public.cms_pages                enable row level security;
alter table public.faqs                     enable row level security;
alter table public.announcements            enable row level security;
alter table public.blog_posts               enable row level security;
alter table public.testimonials             enable row level security;
alter table public.game_categories          enable row level security;
alter table public.games                    enable row level security;
alter table public.user_favorites           enable row level security;
alter table public.activity_log             enable row level security;
alter table public.audit_logs               enable row level security;
alter table public.site_settings            enable row level security;

-- ── RBAC tables ──────────────────────────────────────────────────────────────

create policy "roles readable by staff" on public.roles
  for select using (public.is_staff());
create policy "roles managed by super admin" on public.roles
  for all using (public.has_role('super_admin')) with check (public.has_role('super_admin'));

create policy "permissions readable by staff" on public.permissions
  for select using (public.is_staff());
create policy "permissions managed by super admin" on public.permissions
  for all using (public.has_role('super_admin')) with check (public.has_role('super_admin'));

create policy "role_permissions readable by staff" on public.role_permissions
  for select using (public.is_staff());
create policy "role_permissions managed by super admin" on public.role_permissions
  for all using (public.has_role('super_admin')) with check (public.has_role('super_admin'));

create policy "user_roles self readable" on public.user_roles
  for select using (user_id = auth.uid() or public.is_staff());
create policy "user_roles managed by admins" on public.user_roles
  for all using (public.has_permission('users.roles'))
  with check (public.has_permission('users.roles'));

-- ── Profiles ─────────────────────────────────────────────────────────────────
-- Public identity flows through the public_profiles view; the base table is
-- self + staff only.

create policy "profiles self readable" on public.profiles
  for select using (id = auth.uid() or public.is_staff());

create policy "profiles self updatable" on public.profiles
  for update using (id = auth.uid() and is_banned = false)
  with check (id = auth.uid());
  -- column-level protection enforced by trg_profiles_protect

create policy "profiles admin update" on public.profiles
  for update using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

-- ── VIP ──────────────────────────────────────────────────────────────────────

create policy "vip tiers public" on public.vip_tiers
  for select using (true);
create policy "vip tiers managed" on public.vip_tiers
  for all using (public.has_permission('vip.manage'))
  with check (public.has_permission('vip.manage'));

create policy "vip status self" on public.vip_status
  for select using (user_id = auth.uid() or public.is_staff());
create policy "vip status managed" on public.vip_status
  for all using (public.has_permission('vip.manage'))
  with check (public.has_permission('vip.manage'));

create policy "vip history self" on public.vip_history
  for select using (user_id = auth.uid() or public.is_staff());

-- ── Rewards ──────────────────────────────────────────────────────────────────

create policy "reward rules public read" on public.reward_rules
  for select using (is_active or public.is_staff());
create policy "reward rules managed" on public.reward_rules
  for all using (public.has_permission('rewards.manage'))
  with check (public.has_permission('rewards.manage'));

create policy "claims self readable" on public.reward_claims
  for select using (user_id = auth.uid() or public.is_staff());
-- inserts happen only inside SECURITY DEFINER claim functions

create policy "ledger self readable" on public.ledger_entries
  for select using (user_id = auth.uid() or public.is_staff());

-- ── Achievements ─────────────────────────────────────────────────────────────

create policy "achievements public read" on public.achievements
  for select using ((is_active and not is_secret) or public.is_staff());
create policy "achievements managed" on public.achievements
  for all using (public.has_permission('achievements.manage'))
  with check (public.has_permission('achievements.manage'));

create policy "user achievements self" on public.user_achievements
  for select using (user_id = auth.uid() or public.is_staff());

-- ── Referrals ────────────────────────────────────────────────────────────────

create policy "referrals visible to referrer" on public.referrals
  for select using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_staff());
create policy "referrals managed" on public.referrals
  for update using (public.has_permission('referrals.manage'))
  with check (public.has_permission('referrals.manage'));

-- ── Leaderboards (public) ────────────────────────────────────────────────────

create policy "leaderboards public read" on public.leaderboard_entries
  for select using (true);

-- ── Promotions & banners ─────────────────────────────────────────────────────

create policy "promotions public read" on public.promotions
  for select using (
    (status = 'active'
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now()))
    or public.is_staff()
  );
create policy "promotions managed" on public.promotions
  for all using (public.has_permission('promotions.manage'))
  with check (public.has_permission('promotions.manage'));

create policy "promotion claims self" on public.promotion_claims
  for select using (user_id = auth.uid() or public.is_staff());

create policy "banners public read" on public.banners
  for select using (is_active or public.is_staff());
create policy "banners managed" on public.banners
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

-- ── Notifications ────────────────────────────────────────────────────────────

create policy "notifications self read" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications self mark read" on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "notifications self delete" on public.notifications
  for delete using (user_id = auth.uid());

create policy "notification prefs self" on public.notification_preferences
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "broadcasts staff read" on public.broadcasts
  for select using (public.is_staff());

-- ── Support ──────────────────────────────────────────────────────────────────

create policy "tickets self or staff read" on public.support_tickets
  for select using (
    user_id = auth.uid()
    or public.has_permission('support.manage')
  );
create policy "tickets self create" on public.support_tickets
  for insert with check (user_id = auth.uid());
create policy "tickets staff update" on public.support_tickets
  for update using (public.has_permission('support.manage'))
  with check (public.has_permission('support.manage'));
create policy "tickets self close" on public.support_tickets
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "ticket messages participants read" on public.ticket_messages
  for select using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and (t.user_id = auth.uid() or public.has_permission('support.manage'))
    )
  );
create policy "ticket messages participants write" on public.ticket_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and t.status <> 'closed'
        and (t.user_id = auth.uid() or public.has_permission('support.manage'))
    )
    and (is_staff = public.has_permission('support.manage'))
  );

-- ── CMS & content ────────────────────────────────────────────────────────────

create policy "cms published public" on public.cms_pages
  for select using (is_published or public.has_permission('cms.manage'));
create policy "cms managed" on public.cms_pages
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy "faqs public" on public.faqs
  for select using (is_published or public.has_permission('cms.manage'));
create policy "faqs managed" on public.faqs
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy "announcements public" on public.announcements
  for select using (
    (is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now()))
    or public.has_permission('cms.manage')
  );
create policy "announcements managed" on public.announcements
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy "blog published public" on public.blog_posts
  for select using (is_published or public.has_permission('cms.manage'));
create policy "blog managed" on public.blog_posts
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy "testimonials public" on public.testimonials
  for select using (is_published or public.has_permission('cms.manage'));
create policy "testimonials managed" on public.testimonials
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy "game categories public" on public.game_categories
  for select using (true);
create policy "game categories managed" on public.game_categories
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy "games public" on public.games
  for select using (is_active or public.has_permission('cms.manage'));
create policy "games managed" on public.games
  for all using (public.has_permission('cms.manage'))
  with check (public.has_permission('cms.manage'));

create policy "favorites self" on public.user_favorites
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Activity & audit ─────────────────────────────────────────────────────────

create policy "activity self read" on public.activity_log
  for select using (user_id = auth.uid() or public.is_staff());

create policy "audit admin read" on public.audit_logs
  for select using (public.has_permission('audit.read'));
create policy "audit staff insert" on public.audit_logs
  for insert with check (public.is_staff() and actor_id = auth.uid());

-- ── Settings ─────────────────────────────────────────────────────────────────

create policy "settings public read" on public.site_settings
  for select using (true);
create policy "settings managed" on public.site_settings
  for all using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

-- ==========================================
-- MIGRATION: 20260613000012_storage_realtime_hooks.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0012 · Storage buckets, realtime, auth trigger attachment
-- ============================================================================

-- ── Storage buckets ──────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152,
   array['image/png','image/jpeg','image/webp','image/avif']),
  ('cms-media', 'cms-media', true, 8388608,
   array['image/png','image/jpeg','image/webp','image/avif','image/svg+xml']),
  ('ticket-attachments', 'ticket-attachments', false, 5242880,
   array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do nothing;

-- avatars: anyone can view; owners write inside their own folder (uid/...)
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars owner write" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars owner update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars owner delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- cms-media: public read, cms staff write
create policy "cms media public read" on storage.objects
  for select using (bucket_id = 'cms-media');

create policy "cms media staff write" on storage.objects
  for insert with check (bucket_id = 'cms-media' and public.has_permission('cms.manage'));

create policy "cms media staff update" on storage.objects
  for update using (bucket_id = 'cms-media' and public.has_permission('cms.manage'));

create policy "cms media staff delete" on storage.objects
  for delete using (bucket_id = 'cms-media' and public.has_permission('cms.manage'));

-- ticket-attachments: uploader-foldered; readable by owner + support staff
create policy "attachments participant read" on storage.objects
  for select using (
    bucket_id = 'ticket-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_permission('support.manage')
    )
  );

create policy "attachments owner write" on storage.objects
  for insert with check (
    bucket_id = 'ticket-attachments'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.notifications;

-- ── Attach the signup pipeline now that all referenced tables exist ──────────

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Grants: views & RPC surface for API roles ────────────────────────────────

grant select on public.public_profiles to anon, authenticated;

grant execute on function public.claim_reward(text) to authenticated;
grant execute on function public.claim_promotion(text, text) to authenticated;
grant execute on function public.send_broadcast(text, text, text, public.broadcast_segment) to authenticated;
grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.has_any_role(public.app_role[]) to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.calculate_level(bigint) to anon, authenticated;
grant execute on function public.xp_for_level(integer) to anon, authenticated;
grant execute on function public.period_key_for(public.leaderboard_period, timestamptz) to anon, authenticated;

-- lock down internal functions from direct API invocation
revoke execute on function public.grant_coins(uuid, bigint, public.ledger_entry_type, text, uuid, text) from anon, authenticated;
revoke execute on function public.grant_xp(uuid, bigint, public.ledger_entry_type, text, uuid, text) from anon, authenticated;
revoke execute on function public.evaluate_achievements(uuid) from anon, authenticated;
revoke execute on function public.evaluate_vip_tier(uuid) from anon, authenticated;
revoke execute on function public.qualify_referral(uuid) from anon, authenticated;
revoke execute on function public.compute_leaderboard(public.leaderboard_period, text, boolean) from anon, authenticated;
revoke execute on function public.generate_referral_code() from anon, authenticated;

-- ==========================================
-- MIGRATION: 20260613000013_seed.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0013 · Seed — RBAC matrix, VIP tiers, rules, achievements, content
-- ============================================================================

-- ── Roles ────────────────────────────────────────────────────────────────────

insert into public.roles (key, name, description) values
  ('super_admin',   'Super Admin',   'Full platform control, role management, settings'),
  ('admin',         'Admin',         'Operations: users, rewards, promotions, CMS, analytics'),
  ('manager',       'Manager',       'Promotions, rewards, VIP and content management'),
  ('support_agent', 'Support Agent', 'Support inbox and member assistance'),
  ('moderator',     'Moderator',     'Community moderation and member flags'),
  ('customer',      'Customer',      'Standard member account');

-- ── Permissions ──────────────────────────────────────────────────────────────

insert into public.permissions (key, name, module, description) values
  ('users.manage',            'Manage users',            'users',         'View and edit member accounts, ban/unban'),
  ('users.roles',             'Assign roles',            'users',         'Grant or revoke staff roles'),
  ('rewards.manage',          'Manage rewards',          'rewards',       'Create and edit reward rules'),
  ('achievements.manage',     'Manage achievements',     'achievements',  'Create and edit achievements'),
  ('vip.manage',              'Manage VIP',              'vip',           'Edit tiers, multipliers and member overrides'),
  ('referrals.manage',        'Manage referrals',        'referrals',     'Review, approve and reject referrals'),
  ('promotions.manage',       'Manage promotions',       'promotions',    'Create, schedule and expire promotions'),
  ('leaderboards.manage',     'Manage leaderboards',     'leaderboards',  'Recompute and finalize leaderboards'),
  ('notifications.broadcast', 'Send broadcasts',         'notifications', 'Send announcements to member segments'),
  ('support.manage',          'Work support inbox',      'support',       'View, reply, assign and close tickets'),
  ('cms.manage',              'Manage CMS',              'cms',           'Pages, FAQ, banners, blog, catalog, testimonials'),
  ('analytics.read',          'View analytics',          'analytics',     'Access analytics dashboards'),
  ('audit.read',              'View audit logs',         'audit',         'Read the audit trail'),
  ('settings.manage',         'Manage settings',         'settings',      'Edit site-wide settings');

-- ── Role → permission matrix ────────────────────────────────────────────────

-- super_admin gets everything implicitly via has_permission(); also grant explicitly.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'super_admin';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in (
  'users.manage','rewards.manage','achievements.manage','vip.manage','referrals.manage',
  'promotions.manage','leaderboards.manage','notifications.broadcast','support.manage',
  'cms.manage','analytics.read','audit.read'
) where r.key = 'admin';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in (
  'rewards.manage','achievements.manage','vip.manage','promotions.manage',
  'leaderboards.manage','cms.manage','analytics.read'
) where r.key = 'manager';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in (
  'support.manage'
) where r.key = 'support_agent';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in (
  'users.manage','support.manage'
) where r.key = 'moderator';

-- ── VIP tiers (multipliers per brief: Silver → Elite) ───────────────────────

insert into public.vip_tiers (key, name, rank, min_xp, reward_multiplier, color, benefits) values
  ('silver', 'Silver', 1, 0, 1.00, '#C7CCD6', '[
    {"title": "Member rewards", "description": "Daily, weekly and monthly reward streams", "icon": "gift"},
    {"title": "Community access", "description": "Leaderboards, achievements and referrals", "icon": "users"}
  ]'::jsonb),
  ('gold', 'Gold', 2, 5000, 1.10, '#F5C542', '[
    {"title": "1.1× reward multiplier", "description": "Boosted coins on every claim", "icon": "trending-up"},
    {"title": "Gold badge", "description": "Tier badge on profile and leaderboards", "icon": "badge-check"},
    {"title": "Priority queue", "description": "Faster support responses", "icon": "zap"}
  ]'::jsonb),
  ('platinum', 'Platinum', 3, 25000, 1.25, '#9AE6E0', '[
    {"title": "1.25× reward multiplier", "description": "Boosted coins on every claim", "icon": "trending-up"},
    {"title": "Exclusive promotions", "description": "Platinum-only bonus drops", "icon": "sparkles"},
    {"title": "Priority support", "description": "Front-of-line ticket handling", "icon": "headset"}
  ]'::jsonb),
  ('diamond', 'Diamond', 4, 100000, 1.50, '#22D3EE', '[
    {"title": "1.5× reward multiplier", "description": "Boosted coins on every claim", "icon": "trending-up"},
    {"title": "Personal host", "description": "Dedicated account manager", "icon": "user-star"},
    {"title": "Exclusive events", "description": "Diamond lounge tournaments and galas", "icon": "crown"},
    {"title": "Instant concierge", "description": "24/7 live chat under a minute", "icon": "message-circle"}
  ]'::jsonb),
  ('elite', 'Elite', 5, 500000, 2.00, '#8B5CF6', '[
    {"title": "2× reward multiplier", "description": "Double coins on every claim", "icon": "trending-up"},
    {"title": "Legendary status", "description": "Elite ring, custom flair, top billing", "icon": "gem"},
    {"title": "Concierge desk", "description": "White-glove service for everything", "icon": "concierge-bell"},
    {"title": "First access", "description": "New features and seasonal events first", "icon": "rocket"}
  ]'::jsonb);

-- ── Reward rules ─────────────────────────────────────────────────────────────

insert into public.reward_rules (key, name, description, reward_type, coins, xp, config) values
  ('daily_login', 'Daily Reward', 'Claim once per day. Streaks add +5 coins per consecutive day (cap +50).',
   'daily', 100, 50, '{"streak_bonus_per_day": 5, "streak_bonus_cap": 50}'),
  ('weekly_chest', 'Weekly Chest', 'Unlocks after 5 daily claims in the same week.',
   'weekly', 750, 300, '{"required_daily_claims": 5}'),
  ('monthly_vault', 'Monthly Vault', 'Unlocks after 20 daily claims in the same month.',
   'monthly', 3500, 1200, '{"required_daily_claims": 20}'),
  ('streak_7', '7-Day Streak Milestone', 'One-time bonus for a 7-day claim streak.',
   'streak_milestone', 500, 250, '{"days": 7}'),
  ('streak_30', '30-Day Streak Milestone', 'One-time bonus for a 30-day claim streak.',
   'streak_milestone', 3000, 1500, '{"days": 30}'),
  ('streak_100', '100-Day Streak Milestone', 'One-time bonus for a legendary 100-day streak.',
   'streak_milestone', 15000, 6000, '{"days": 100}'),
  ('referral_standard', 'Referral Bonus', 'Earned when a referred member completes their profile and reaches level 2.',
   'referral', 1000, 400, '{}'),
  ('season_summer_26', 'Summer Drop ''26', 'Limited seasonal bonus for active members.',
   'seasonal', 1500, 500, '{"season_key": "summer-2026"}');

-- ── Achievements ─────────────────────────────────────────────────────────────

insert into public.achievements
  (key, name, description, category, rarity, icon, condition_type, condition_value, xp_reward, coins_reward, sort_order) values
  ('first_claim',      'First Vault Open',   'Claim your first daily reward.',                'milestone', 'common',    'gift',         'total_claims',        1,    50,   100, 10),
  ('claims_25',        'Regular',            'Claim 25 rewards.',                             'loyalty',   'common',    'calendar-check','total_claims',       25,   200,   500, 20),
  ('claims_100',       'Devoted',            'Claim 100 rewards.',                            'loyalty',   'rare',      'calendar-heart','total_claims',      100,   750,  2000, 30),
  ('streak_7_badge',   'Week Warrior',       'Hold a 7-day claim streak.',                    'loyalty',   'common',    'flame',        'streak_days',         7,   150,   300, 40),
  ('streak_30_badge',  'Iron Streak',        'Hold a 30-day claim streak.',                   'loyalty',   'epic',      'flame',        'streak_days',        30,  1000,  2500, 50),
  ('streak_100_badge', 'Eternal Flame',      'Hold a 100-day claim streak.',                  'loyalty',   'legendary', 'flame',        'streak_days',       100,  5000, 10000, 60),
  ('level_5',          'Rising Star',        'Reach level 5.',                                'milestone', 'common',    'star',         'level_reached',       5,     0,   500, 70),
  ('level_10',         'Contender',          'Reach level 10.',                               'milestone', 'rare',      'star',         'level_reached',      10,     0,  1500, 80),
  ('level_25',         'Veteran',            'Reach level 25.',                               'milestone', 'epic',      'medal',        'level_reached',      25,     0,  5000, 90),
  ('level_50',         'Legend',             'Reach level 50.',                               'milestone', 'legendary', 'crown',        'level_reached',      50,     0, 20000, 100),
  ('profile_done',     'Identity Forged',    'Complete your profile.',                        'social',    'common',    'user-check',   'profile_completed',   1,   100,   200, 110),
  ('first_referral',   'Recruiter',          'Have a referral qualify.',                      'social',    'rare',      'user-plus',    'referrals_qualified', 1,   300,  1000, 120),
  ('referrals_5',      'Squad Builder',      'Have 5 referrals qualify.',                     'social',    'epic',      'users',        'referrals_qualified', 5,  1500,  5000, 130),
  ('referrals_25',     'Network Royalty',    'Have 25 referrals qualify.',                    'social',    'legendary', 'network',      'referrals_qualified',25, 10000, 25000, 140),
  ('favorites_5',      'Curator',            'Add 5 games to your favorites.',                'gameplay',  'common',    'heart',        'favorites_added',     5,    75,   150, 150),
  ('top10_finish',     'Podium Finish',      'Finish a leaderboard period in the top 10.',    'gameplay',  'epic',      'trophy',       'leaderboard_top10',   1,  2000,  5000, 160),
  ('vip_gold',         'Gilded',             'Reach Gold VIP tier.',                          'milestone', 'rare',      'badge-check',  'vip_tier_reached',    2,     0,  1000, 170),
  ('vip_diamond',      'Diamond Hands',      'Reach Diamond VIP tier.',                       'milestone', 'epic',      'gem',          'vip_tier_reached',    4,     0, 10000, 180),
  ('vip_elite',        'Apex',               'Reach Elite VIP tier.',                         'milestone', 'legendary', 'crown',        'vip_tier_reached',    5,     0, 50000, 190);

-- ── Game catalog (from design exports) ───────────────────────────────────────

insert into public.game_categories (key, name, icon, sort_order) values
  ('slots',        'Slots',           'cherry',      10),
  ('fishing',      'Fishing',         'fish',        20),
  ('table-games',  'Table Games',     'spade',       30),
  ('arcade',       'Arcade',          'gamepad-2',   40),
  ('seasonal',     'Seasonal Events', 'snowflake',   50);

insert into public.games (slug, name, category_id, description, badge_text, is_featured, popularity) values
  ('777-spin',         '777 Spin',          (select id from public.game_categories where key = 'slots'),       'High-volatility classic with elite rewards multipliers.', 'HOT',   true,  98),
  ('dragon-hoard',     'Dragon Hoard',      (select id from public.game_categories where key = 'slots'),       'Hunt the dragon''s vault across 50 paylines.',             'HOT',   true,  95),
  ('neon-poker-xl',    'Neon Poker XL',     (select id from public.game_categories where key = 'table-games'), 'Fast-deal poker under the neon lights.',                   null,    false, 88),
  ('abyss-hunter',     'Abyss Hunter',      (select id from public.game_categories where key = 'fishing'),     'Deep-sea trophy hunting with rising jackpots.',            null,    true,  92),
  ('golden-winter',    'Golden Winter',     (select id from public.game_categories where key = 'seasonal'),    'Limited seasonal event with frozen multipliers.',          'EVENT', false, 80),
  ('retro-rush',       'Retro Rush',        (select id from public.game_categories where key = 'arcade'),      'Arcade sprint through pixel-perfect bonus rounds.',        'NEW',   false, 76),
  ('pharaohs-gold',    'Pharaoh''s Gold',   (select id from public.game_categories where key = 'slots'),       'Tomb-deep spins with expanding golden reels.',             null,    false, 85),
  ('quantum-spin',     'Quantum Spin',      (select id from public.game_categories where key = 'slots'),       'Probability-bending reels and parallel-payline physics.',  null,    false, 71),
  ('mystic-grove',     'Mystic Grove',      (select id from public.game_categories where key = 'slots'),       'Enchanted forest free-spin chains.',                       null,    false, 69),
  ('cyber-strike',     'Cyber Strike',      (select id from public.game_categories where key = 'arcade'),      'Neon combat arcade with combo multipliers.',               null,    false, 74),
  ('olympus-gates',    'Olympus Gates',     (select id from public.game_categories where key = 'slots'),       'Climb the pantheon for god-tier multipliers.',             null,    true,  90),
  ('oceans-fortune',   'Ocean''s Fortune',  (select id from public.game_categories where key = 'fishing'),     'Deep-sea jackpot expedition with legendary loot.',         'HOT',   true,  94);

-- ── FAQ ──────────────────────────────────────────────────────────────────────

insert into public.faqs (question, answer, category, sort_order) values
  ('What is WinSweeps?',
   'WinSweeps is a premium social gaming rewards platform. You earn Sweeps Coins and XP through daily rewards, streaks, achievements, referrals and promotions — then climb VIP tiers for bigger multipliers.',
   'general', 10),
  ('Is WinSweeps free to play?',
   'Yes. Every reward stream on WinSweeps is free: daily, weekly and monthly claims, achievements, referrals and seasonal promotions. No purchase is ever required.',
   'general', 20),
  ('How do daily streaks work?',
   'Claim your daily reward on consecutive calendar days to build a streak. Each consecutive day adds a streak bonus to your claim, and milestone streaks (7, 30, 100 days) unlock one-time bonus vaults.',
   'rewards', 30),
  ('What are Sweeps Coins?',
   'Sweeps Coins are the WinSweeps virtual reward currency. They track your earnings across the platform and unlock achievements and leaderboard standing. They have no cash value.',
   'rewards', 40),
  ('How do VIP tiers work?',
   'XP you earn moves you through five tiers: Silver, Gold, Platinum, Diamond and Elite. Higher tiers multiply every coin reward you claim — up to 2× at Elite — and unlock exclusive perks.',
   'vip', 50),
  ('How does the referral program work?',
   'Share your unique referral code or link. When a friend joins, completes their profile and reaches level 2, the referral qualifies and your bonus is credited automatically.',
   'referrals', 60),
  ('When do leaderboards reset?',
   'Daily boards reset at midnight UTC, weekly boards on Monday, and monthly boards on the 1st. The all-time board never resets.',
   'leaderboards', 70),
  ('How do I contact support?',
   'Open a ticket from your dashboard''s Support section. Diamond and Elite members get priority handling with sub-minute live responses during peak hours.',
   'support', 80);

-- ── Testimonials ─────────────────────────────────────────────────────────────

insert into public.testimonials (author_name, author_title, quote, rating, is_featured, sort_order) values
  ('Marcus T.', 'Diamond Elite member', 'The streak system actually keeps me coming back. Hit my 100-day flame last month and the milestone vault was unreal.', 5, true, 10),
  ('Aria K.', 'Platinum member', 'Cleanest rewards platform I''ve used. The VIP multipliers make every claim feel like it matters.', 5, true, 20),
  ('DeVon R.', 'Gold member', 'Referred four friends, all qualified, all bonuses landed instantly. Zero friction.', 5, true, 30),
  ('Lena S.', 'Elite member', 'Concierge support answered in under a minute. This is what premium should feel like.', 5, false, 40);

-- ── CMS pages (structured homepage + static pages content) ──────────────────

insert into public.cms_pages (slug, title, is_published, published_at, content, seo_title, seo_description) values
  ('home', 'Homepage', true, now(), '{
    "hero": {
      "eyebrow": "A new era of immersive social gaming",
      "title_line1": "Play Bigger.",
      "title_line2": "Earn Smarter.",
      "subtitle": "Welcome to the world''s most immersive social sweepstakes platform — where gameplay meets uncompromising luxury.",
      "cta_primary": "Start Playing",
      "cta_secondary": "Explore VIP"
    },
    "stats": [
      {"label": "Coins awarded weekly", "value": "1.2M+"},
      {"label": "Active members", "value": "150K"},
      {"label": "Daily reward streams", "value": "8"},
      {"label": "Member satisfaction", "value": "4.9/5"}
    ],
    "cta_footer": {
      "title": "The Arena Awaits.",
      "subtitle": "Join the inner circle of global sweepstakes players. Registration is free — but the experience is priceless.",
      "button": "Create Free Account"
    }
  }'::jsonb,
  'WinSweeps — Play Bigger. Earn Smarter.',
  'Premium social gaming rewards: daily streaks, VIP multipliers, achievements, referrals and global leaderboards.'),
  ('about', 'About WinSweeps', true, now(), '{
    "mission": "WinSweeps exists to make loyalty feel luxurious. We built a rewards ecosystem where consistency is celebrated — daily streaks, milestone vaults, and a VIP ladder that treats every member like a high roller.",
    "values": [
      {"title": "Premium by default", "description": "Every surface, interaction and reward is designed to elite standard."},
      {"title": "Radically fair", "description": "Transparent rules, audited reward engines, zero pay-to-win."},
      {"title": "Community first", "description": "Leaderboards, referrals and events that bring players together."}
    ]
  }'::jsonb,
  'About — WinSweeps', 'The story and values behind the WinSweeps elite gaming ecosystem.');

-- ── Site settings ────────────────────────────────────────────────────────────

insert into public.site_settings (key, value, description) values
  ('maintenance_mode', '{"enabled": false, "message": ""}', 'Site-wide maintenance banner / lockout'),
  ('registration_open', '{"enabled": true}', 'Allow new member registration'),
  ('welcome_bonus', '{"coins": 250, "xp": 100, "title": "Welcome to Elite"}', 'Signup bonus granted on email verification'),
  ('social_links', '{"discord": "", "x": "", "instagram": "", "telegram": ""}', 'Community/footer social links');

-- ==========================================
-- MIGRATION: 20260613000014_contact_promo_seed.sql
-- ==========================================

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

-- ==========================================
-- MIGRATION: 20260613000016_rate_limiting.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0014 · DB-backed fixed-window rate limiting
-- Serverless-safe (no Redis): atomic upsert per (bucket, window).
-- ============================================================================

create table public.rate_limits (
  bucket       text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (bucket, window_start)
);

create index idx_rate_limits_window on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
-- no policies: only service_role (which bypasses RLS) touches this table

-- Returns true when the action is ALLOWED, false when the limit is exceeded.
-- bucket is typically "<action>:<user_or_ip>".
create or replace function public.check_rate_limit(
  p_bucket text,
  p_max_hits integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w_start timestamptz;
  current_hits integer;
begin
  -- align to the start of the current fixed window
  w_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (bucket, window_start, hits)
  values (p_bucket, w_start, 1)
  on conflict (bucket, window_start)
  do update set hits = public.rate_limits.hits + 1
  returning hits into current_hits;

  return current_hits <= p_max_hits;
end;
$$;

-- Housekeeping: drop windows older than a day. Called by the cron route.
create or replace function public.prune_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.rate_limits where window_start < now() - interval '1 day';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Only service_role may invoke (server-side enforcement).
revoke execute on function public.check_rate_limit(text, integer, integer) from public;
revoke execute on function public.prune_rate_limits() from public;

-- ==========================================
-- MIGRATION: 20260613000017_function_grants_hardening.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0015 · Function EXECUTE hardening
-- Postgres grants EXECUTE to PUBLIC by default; revoking from anon/authenticated
-- alone is insufficient because both inherit PUBLIC. Revoke from PUBLIC on every
-- privileged function, then re-grant only the client-callable surface.
-- ============================================================================

-- ── Internal-only: must never be callable by clients (currency minting etc.) ─
revoke execute on function public.grant_coins(uuid, bigint, public.ledger_entry_type, text, uuid, text) from public;
revoke execute on function public.grant_xp(uuid, bigint, public.ledger_entry_type, text, uuid, text) from public;
revoke execute on function public.evaluate_achievements(uuid) from public;
revoke execute on function public.evaluate_vip_tier(uuid) from public;
revoke execute on function public.qualify_referral(uuid) from public;
revoke execute on function public.compute_leaderboard(public.leaderboard_period, text, boolean) from public;
revoke execute on function public.generate_referral_code() from public;
revoke execute on function public.tier_for_xp(bigint) from public;
revoke execute on function public.achievement_metric(uuid, public.achievement_condition) from public;
revoke execute on function public.send_broadcast(text, text, text, public.broadcast_segment) from public;
revoke execute on function public.member_multiplier(uuid) from public;

-- send_broadcast is internally permission-checked but should still be limited to
-- signed-in callers (staff check happens inside).
grant execute on function public.send_broadcast(text, text, text, public.broadcast_segment) to authenticated;

-- ── Client-callable surface: revoke PUBLIC, grant explicitly ────────────────
revoke execute on function public.claim_reward(text) from public;
grant execute on function public.claim_reward(text) to authenticated;

revoke execute on function public.claim_promotion(text, text) from public;
grant execute on function public.claim_promotion(text, text) to authenticated;

-- Authorization helpers are consumed by RLS for signed-in users.
revoke execute on function public.has_role(public.app_role) from public;
revoke execute on function public.has_any_role(public.app_role[]) from public;
revoke execute on function public.has_permission(text) from public;
revoke execute on function public.is_staff() from public;
revoke execute on function public.is_admin() from public;
grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.has_any_role(public.app_role[]) to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Pure helpers are safe for everyone (used in UI math, public pages).
-- calculate_level / xp_for_level / period_key_for keep their PUBLIC grant.

-- ==========================================
-- MIGRATION: 20260613000018_public_profiles_functions.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0018 · Replace SECURITY DEFINER view with definer functions
-- Resolves the Supabase advisor "Security Definer View" (CRITICAL) on
-- public.public_profiles. The view exposed only a safe public projection, but
-- definer *views* are flagged generically. Definer *functions* with a fixed
-- search_path are the Supabase-recommended pattern for exposing a controlled
-- projection past RLS, and are not flagged.
-- ============================================================================

drop view if exists public.public_profiles;

-- Safe public projection by id list (leaderboards, referral usernames).
create or replace function public.public_profiles_by_ids(p_ids uuid[])
returns table (
  id uuid,
  username citext,
  display_name text,
  avatar_url text,
  country text,
  xp bigint,
  level integer,
  current_streak integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.country,
         p.xp, p.level, p.current_streak, p.created_at
  from public.profiles p
  where p.id = any (p_ids)
    and p.is_banned = false;
$$;

-- Safe public projection: top members by XP (leaderboard preview).
create or replace function public.public_profiles_top(p_limit integer default 10)
returns table (
  id uuid,
  username citext,
  display_name text,
  avatar_url text,
  country text,
  xp bigint,
  level integer,
  current_streak integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.country,
         p.xp, p.level, p.current_streak, p.created_at
  from public.profiles p
  where p.is_banned = false
  order by p.xp desc
  limit greatest(1, least(p_limit, 100));
$$;

revoke execute on function public.public_profiles_by_ids(uuid[]) from public;
revoke execute on function public.public_profiles_top(integer) from public;
grant execute on function public.public_profiles_by_ids(uuid[]) to anon, authenticated;
grant execute on function public.public_profiles_top(integer) to anon, authenticated;

-- ==========================================
-- MIGRATION: 20260613000019_spin_wheel.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0019 · Spin wheel — daily free spin, 0.1 % win probability
-- ============================================================================

-- Track when user last used their free spin
alter table public.profiles
  add column if not exists last_spin_at timestamptz;

-- Full history of every spin
create table public.spin_history (
  id           uuid      primary key default gen_random_uuid(),
  user_id      uuid      not null references public.profiles (id) on delete cascade,
  segment      smallint  not null check (segment between 0 and 7),
  prize_coins  int       not null default 0 check (prize_coins >= 0),
  is_win       boolean   not null default false,
  spun_at      timestamptz not null default now()
);

create index idx_spin_history_user on public.spin_history (user_id, spun_at desc);

-- RLS: users read only their own history; inserts come only from the function below
alter table public.spin_history enable row level security;

create policy "spin_history_owner_select"
  on public.spin_history for select
  using (user_id = auth.uid());

-- ── claim_spin ───────────────────────────────────────────────────────────────
-- Call via:  select claim_spin()
-- Returns a JSON object:
--   { ok: true,  won: bool, prize_coins: int, segment: 0-7 }
--   { ok: false, error: 'not_authenticated'|'profile_not_found'
--               |'account_suspended'|'cooldown', next_spin_at?: timestamptz }

create or replace function public.claim_spin()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid    := auth.uid();
  v_profile public.profiles%rowtype;
  v_rand    float8  := random();
  v_won     boolean;
  v_prize   int;
  v_segment smallint;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  -- Row-level lock on profile (prevent double-spins from concurrent requests)
  select * into v_profile from public.profiles where id = v_uid for update;

  if not found then
    return json_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  if v_profile.is_banned then
    return json_build_object('ok', false, 'error', 'account_suspended');
  end if;

  -- One free spin per 24 hours
  if v_profile.last_spin_at is not null
     and v_profile.last_spin_at > now() - interval '24 hours' then
    return json_build_object(
      'ok',          false,
      'error',       'cooldown',
      'next_spin_at', (v_profile.last_spin_at + interval '24 hours')
    );
  end if;

  -- ── Determine outcome (0.1 % overall win probability) ───────────────────
  --   Segment 7  — 500-coin jackpot  (0.03 %)
  --   Segment 6  — 25-coin win       (0.07 %)
  --   Segments 0-5 — "Try Again"    (99.9 %)
  if v_rand < 0.0003 then
    v_won     := true;
    v_prize   := 500;
    v_segment := 7;
  elsif v_rand < 0.001 then
    v_won     := true;
    v_prize   := 25;
    v_segment := 6;
  else
    v_won     := false;
    v_prize   := 0;
    v_segment := (floor(random() * 6))::smallint;
  end if;

  -- Stamp the spin time (not a protected column, so direct update is fine)
  update public.profiles set last_spin_at = now() where id = v_uid;

  -- Append-to-history (handled by RLS insert policy implicitly via definer)
  insert into public.spin_history (user_id, segment, prize_coins, is_win)
  values (v_uid, v_segment, v_prize, v_won);

  -- Award coins if won (grant_coins handles ledger + balance atomically)
  if v_won then
    perform public.grant_coins(
      v_uid, v_prize, 'reward_claim',
      'spin_history', null,
      'Spin wheel: ' || v_prize || ' coins'
    );
  end if;

  return json_build_object(
    'ok',          true,
    'won',         v_won,
    'prize_coins', v_prize,
    'segment',     v_segment
  );
end;
$$;

-- Lock to authenticated users only (mirrors other claim functions)
revoke execute on function public.claim_spin() from public;
grant  execute on function public.claim_spin() to authenticated;

-- ==========================================
-- MIGRATION: 20260614000020_games_requests.sql
-- ==========================================

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

-- ==========================================
-- MIGRATION: 20260614000021_blog_seed.sql
-- ==========================================

-- Blog posts seed: 18 published posts covering short-, medium-, and long-tail keywords
-- Run after 20_games_requests.sql

insert into public.blog_posts (slug, title, excerpt, content, tags, is_published, published_at, seo_title, seo_description) values

-- SHORT-TAIL: single game names / primary category
('fire-kirin-online',
 'Fire Kirin Online — The Complete Player Guide',
 'Everything you need to know about Fire Kirin: how the game works, how to create an account, and how to maximize your 50% first deposit bonus.',
 E'## What Is Fire Kirin?\n\nFire Kirin is the most popular fish table game online. Players choose a cannon power level, aim at fish swimming across the screen, and earn credits for every catch. Bigger fish = more credits. Boss fish unlock jackpot multipliers.\n\n## How to Create a Fire Kirin Account\n\n1. Go to the [Get Started form](/games/fire-kirin) at Win Sweeps\n2. Choose Fire Kirin from the game dropdown\n3. Enter your name and WhatsApp/Telegram contact\n4. Upload your CashApp, Zelle or crypto payment screenshot\n5. We create your Fire Kirin account and send your login details — usually within the hour\n\n## Your 50% First Deposit Bonus\n\nEvery new Fire Kirin player at Win Sweeps gets 50% extra on their first deposit. Deposit $100 → start with $150 in Fire Kirin credits.\n\n## Fire Kirin Tips for Beginners\n\n- Start at lower cannon power to understand fish movement patterns\n- Target the mid-size fish for consistent returns\n- Save high-power shots for Boss fish — they carry the biggest multipliers\n- Play during bonus storm windows (random timed events) for extra multipliers\n\n## Deposits & Withdrawals\n\nWin Sweeps accepts CashApp, Zelle, Bitcoin, USDT and other major crypto for Fire Kirin deposits. After winning, request your payout and we send it via your preferred method.\n\nReady to play? [Create your Fire Kirin account →](/games/fire-kirin)',
 array['fire kirin','fish table','beginner guide'],
 true, now() - interval '6 days',
 'Fire Kirin Online — Complete Beginner''s Guide | Win Sweeps',
 'Learn how to play Fire Kirin online at Win Sweeps. Create your account, claim your 50% first deposit bonus, and get tips to win big on the #1 fish table game.'),

('juwa-fish-table-game',
 'Juwa Game — How to Play & Win at Win Sweeps',
 'Juwa is one of the fastest fish table games online. Here''s everything you need to know: how to get started, how to win, and how to claim your bonus.',
 E'## What Makes Juwa Different?\n\nJuwa runs faster than most fish table games — the fish school moves quickly, boss encounters happen often, and multi-player rooms mean the bonus round chaos is constant. High risk, high reward.\n\n## How to Start Playing Juwa\n\n1. Submit your deposit request at [Win Sweeps](/games/juwa)\n2. We create your Juwa account and load your credits\n3. You receive login details via WhatsApp or Telegram\n4. Log in and start hunting\n\n## Juwa Bonus Rounds\n\nJuwa has three bonus states:\n- **Dragon Storm** — 2× multiplier on all catches for 30 seconds\n- **Boss Battle** — rare boss fish worth 50–200 credits\n- **Chain Reaction** — killing 5+ fish in 3 seconds triggers a multiplier chain\n\n## Juwa Strategy Tips\n\n- Use medium cannon power on the Dragon Storm — don''t waste ammo\n- Coordinate with other players in the room on Boss fish\n- Watch for Chain Reaction setups: fan shots across a dense school\n\n[Create your Juwa account →](/games/juwa)',
 array['juwa','juwa game','fish table'],
 true, now() - interval '5 days',
 'Juwa Fish Table Game — How to Play & Win | Win Sweeps',
 'Complete guide to playing Juwa online at Win Sweeps. Learn the rules, bonus rounds, winning strategies and how to claim your 50% first deposit bonus.'),

('orion-stars-online',
 'Orion Stars Online — Complete Game Guide',
 'Orion Stars brings constellation jackpots and stellar multipliers to the fish table genre. Here''s how to play and win.',
 E'## About Orion Stars\n\nOrion Stars is a space-themed fish table game where catching constellation fish unlocks star jackpots. The visual style is unique — dark space background, glowing fish — and the multipliers are some of the deepest in the lineup.\n\n## Getting Started\n\n[Create your Orion Stars account](/games/orion-stars) at Win Sweeps in minutes. Our team sets up your account and loads your credits — no waiting for app stores or download queues.\n\n## Orion Stars Features\n\n- **Star Jackpots** — triggered by catching 3 constellation fish in a row\n- **Nebula Bonus** — random 3× multiplier window\n- **Deep Space Boss** — a rare mega-boss worth 500–2000 credits\n\n## Tips\n\n- Prioritize constellation fish even if they''re small — they trigger jackpots\n- Save Super Torpedo shots for Deep Space Boss appearances\n- Stack deposits during bonus events for extra credits\n\n[Play Orion Stars at Win Sweeps →](/games/orion-stars)',
 array['orion stars','orion stars online','fish table'],
 true, now() - interval '4 days',
 'Orion Stars Online — Complete Guide to Playing | Win Sweeps',
 'Learn how to play Orion Stars online. Create an account at Win Sweeps, claim your 50% bonus and discover the stellar jackpots in this space fish table game.'),

-- MEDIUM-TAIL: comparison + category posts
('fire-kirin-vs-juwa-vs-orion-stars',
 'Fire Kirin vs Juwa vs Orion Stars — Which Fish Table Game Is Best?',
 'Comparing the top 3 fish table games at Win Sweeps: payout styles, game speed, bonus rounds and which one fits your play style.',
 E'## The Big Three at Win Sweeps\n\nFire Kirin, Juwa and Orion Stars are our three most played games. They share the same core mechanic — aim and fire — but each has a distinct personality.\n\n## Fire Kirin\n\n**Best for:** beginners and steady earners\n- Slower fish movement → easier aiming\n- Boss fish appear frequently\n- Most predictable payout rhythm\n- **Verdict:** best starting game for new players\n\n## Juwa\n\n**Best for:** high-action players\n- Fastest fish movement\n- Bonus rounds fire constantly\n- Chain Reaction mechanic rewards quick shooting\n- **Verdict:** highest variance, highest ceiling\n\n## Orion Stars\n\n**Best for:** jackpot hunters\n- Constellation jackpot mechanic is unique\n- Deep Space Boss has the biggest single payout\n- More strategic — you manage which fish you target\n- **Verdict:** best for players who prefer a strategic approach\n\n## Which Should You Start With?\n\nIf you''re brand new → **Fire Kirin** (forgiving, consistent).\nIf you want fast action → **Juwa** (volatile, exciting).\nIf you''re chasing big jackpots → **Orion Stars** (patient, high ceiling).\n\nAll three come with a 50% first deposit bonus. [Choose your game →](/games)',
 array['fire kirin vs juwa','best fish table game','orion stars comparison'],
 true, now() - interval '4 days',
 'Fire Kirin vs Juwa vs Orion Stars — Which Fish Table Game Is Best? | Win Sweeps',
 'Comparing Fire Kirin, Juwa and Orion Stars at Win Sweeps. Find out which fish table game fits your play style, budget and bonus strategy.'),

('best-fish-table-games-online',
 'Best Fish Table Games Online in 2025 — All 12 Ranked',
 'We rank all 12 Win Sweeps fish table and sweepstakes games by payout style, bonus frequency and beginner-friendliness.',
 E'## All 12 Win Sweeps Games, Ranked\n\nHere''s how our 12 games stack up across three criteria: consistency (how steady the payouts are), excitement (bonus frequency and multiplier ceiling), and ease for beginners.\n\n| Game | Consistency | Excitement | Beginner-Friendly |\n|------|------------|------------|-------------------|\n| Fire Kirin | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |\n| Juwa | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |\n| Orion Stars | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |\n| Game Vault | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |\n| Vegas Sweeps | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |\n| Milky Way | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |\n| Panda Master | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |\n| Cash Frenzy | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |\n| VBlink | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |\n| Mafia | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |\n| Mr. All In One | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |\n| Cash Machine | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |\n\n## Our Pick for New Players\n\n**Fire Kirin** → then graduate to **Juwa** once you understand fish movement.\n\n[Browse all games →](/games)',
 array['fish table games','best sweepstakes games','fish table online 2025'],
 true, now() - interval '3 days',
 'Best Fish Table Games Online in 2025 — All 12 Ranked | Win Sweeps',
 'We rank all 12 Win Sweeps fish table and sweepstakes games. Find the best game for your play style, bonus appetite and experience level.'),

('what-are-sweepstakes-games',
 'What Are Sweepstakes Games? How They Work & Why They''re Legal',
 'Sweepstakes gaming is one of the fastest-growing entertainment models in the US. Here''s how it works, why it''s legal, and what makes fish table sweepstakes so popular.',
 E'## Sweepstakes Gaming Explained\n\nSweepstakes games use a "free to play, optional purchase" model that has been legally recognized across the United States for decades — the same model used by soft-drink promotions and major consumer brands.\n\n## How It Works at Win Sweeps\n\n1. You deposit funds\n2. We credit your in-game balance\n3. You play fish table or slot games\n4. Winnings are credited to your balance\n5. You request a payout and we send it via CashApp, Zelle or crypto\n\n## Why Sweepstakes Games Are Legal\n\nThe sweepstakes model separates "purchasing" from "entering" — there is always a free alternate method of entry. This structure has been upheld in courts and is the same framework used by sweepstakes apps operating across all 50 states.\n\n## Fish Table Games in the Sweepstakes Model\n\nFish table games (Fire Kirin, Juwa, Orion Stars) are the most popular category in the sweepstakes space because the skill element — aiming — appeals to players who want more engagement than a slot reel.\n\n[Explore all 12 games at Win Sweeps →](/games)',
 array['sweepstakes games','are sweepstakes games legal','fish table sweepstakes'],
 true, now() - interval '3 days',
 'What Are Sweepstakes Games? How They Work & Why They''re Legal | Win Sweeps',
 'Understand how sweepstakes gaming works, why it''s legal in the US, and how fish table games like Fire Kirin fit into the sweepstakes model.'),

('how-to-deposit-cashapp-fish-table',
 'How to Deposit with CashApp for Fish Table Games — Step by Step',
 'The fastest way to fund your Win Sweeps account is CashApp. Here''s the exact process from first deposit to your game credits being loaded.',
 E'## Why CashApp Is the Most Popular Deposit Method\n\nCashApp is instant, widely used and available on every smartphone. For fish table game deposits at Win Sweeps, it''s the #1 choice because transfers post in seconds and you get a screenshot receipt to upload with your request.\n\n## Step-by-Step CashApp Deposit\n\n1. Open CashApp on your phone\n2. Send your deposit amount to our CashApp handle (shown on the deposit page)\n3. Take a screenshot of the completed transaction\n4. Go to the [Get Started form](/games) at Win Sweeps\n5. Choose your game (Fire Kirin, Juwa, Orion Stars, etc.)\n6. Upload your CashApp screenshot\n7. Submit — we create your account and load your credits\n\n## How Long Does It Take?\n\nMost accounts are set up and credits loaded within the hour during our operating hours (9 AM–10 PM EST, 7 days a week).\n\n## 50% Bonus on Your First CashApp Deposit\n\nAll first-time deposits — including via CashApp — receive a 50% bonus. Deposit $100 via CashApp → you start with $150 in game credits.\n\n[Start your CashApp deposit →](/games)',
 array['cashapp fish table','deposit cashapp sweepstakes','cashapp game account'],
 true, now() - interval '2 days',
 'How to Deposit with CashApp for Fish Table Games | Win Sweeps',
 'Step-by-step guide to depositing with CashApp at Win Sweeps. Create your fish table game account fast with a 50% first deposit bonus.'),

('how-to-deposit-zelle-fish-table',
 'How to Deposit with Zelle for Fish Table Games — Complete Guide',
 'Zelle is one of the most secure and instant ways to deposit at Win Sweeps. Here''s exactly how to do it.',
 E'## Zelle Deposits at Win Sweeps\n\nZelle transfers are bank-to-bank and settle in seconds. Because Zelle is linked directly to most US bank accounts, there are no fees and no waiting for funds to clear.\n\n## Step-by-Step Zelle Deposit\n\n1. Open your bank app or the Zelle app\n2. Send to our registered Zelle contact (shown on the deposit page)\n3. Take a screenshot of the completed Zelle transfer\n4. Fill out the [Get Started form](/games) — upload the screenshot\n5. Choose your game and deposit amount\n6. We set up your account and confirm via WhatsApp or Telegram\n\n## Zelle Limits\n\nMost banks allow $500–$2,500 per day via Zelle. If you want to deposit more, contact us via WhatsApp and we can arrange alternative methods.\n\n## Is Zelle Safe for Game Deposits?\n\nYes — Zelle transfers are bank-level secure. You''re sending directly from your bank account, no third-party wallet involved.\n\n[Deposit with Zelle now →](/games)',
 array['zelle fish table','deposit zelle sweepstakes','zelle game deposit'],
 true, now() - interval '2 days',
 'How to Deposit with Zelle for Fish Table Games | Win Sweeps',
 'Complete guide to Zelle deposits at Win Sweeps. Instant bank transfers, 50% first deposit bonus on all 12 fish table and sweepstakes games.'),

('crypto-deposits-fish-table',
 'CashApp, Zelle or Crypto — Best Deposit Method for Fish Table Games',
 'Not sure which payment method to use at Win Sweeps? We break down CashApp, Zelle, Bitcoin and USDT so you can choose the right one.',
 E'## Comparing Deposit Methods at Win Sweeps\n\n| Method | Speed | Minimum | Best For |\n|--------|-------|---------|----------|\n| CashApp | Instant | $20 | Everyone — easiest |\n| Zelle | Instant | $20 | Bank account holders |\n| Bitcoin (BTC) | 10–30 min | $50 | Privacy-focused players |\n| USDT (TRC20) | 1–5 min | $50 | Frequent depositors |\n\n## CashApp\n\nFastest for most players. No fees, instant confirmation, screenshot is accepted immediately.\n\n## Zelle\n\nBest if you prefer bank transfers. No wallet needed — links directly to your bank account.\n\n## Bitcoin\n\nSend BTC to our wallet address (shown at deposit). Confirmations take 10–30 minutes. Good for large deposits.\n\n## USDT (Tether)\n\nStablecoin — $1 = $1 always. TRC20 network has near-zero fees. Fastest crypto option.\n\n## Which Should You Choose?\n\n- **First deposit:** CashApp (fastest, easiest screenshot)\n- **Large deposit:** USDT or Bitcoin (no bank limits)\n- **Privacy:** Bitcoin or USDT\n\n[Make your first deposit →](/games)',
 array['crypto fish table','bitcoin sweepstakes','usdt deposit game'],
 true, now() - interval '1 day',
 'Best Deposit Methods for Fish Table Games: CashApp, Zelle & Crypto | Win Sweeps',
 'Compare CashApp, Zelle, Bitcoin and USDT for fish table game deposits at Win Sweeps. Find the fastest, cheapest way to fund your game account.'),

('50-percent-first-deposit-bonus-explained',
 '50% First Deposit Bonus at Win Sweeps — How to Claim It',
 'Win Sweeps gives every new player a 50% bonus on their first deposit. Here''s exactly how it works, what games it applies to, and how to maximize it.',
 E'## What Is the 50% First Deposit Bonus?\n\nEvery new player at Win Sweeps receives 50% extra on their very first deposit — applied automatically to your game balance, no code required.\n\n**Examples:**\n- Deposit $50 → start with $75 in credits\n- Deposit $100 → start with $150 in credits\n- Deposit $200 → start with $300 in credits\n\n## Which Games Does It Apply To?\n\nAll 12 games: Fire Kirin, Juwa, Orion Stars, Game Vault, Vegas Sweeps, Milky Way, Panda Master, Cash Frenzy, VBlink, Mafia, Mr. All In One and Cash Machine.\n\n## How to Claim It\n\n1. [Submit your deposit request](/games)\n2. Upload your payment screenshot\n3. Choose your game\n4. We apply the 50% bonus when loading your credits\n5. You see the bonus reflected in your game balance immediately\n\n## VIP Reload Bonuses\n\nAfter your first deposit, every subsequent deposit earns a reload bonus based on your VIP tier:\n- Gold: 10%\n- Platinum: 12%\n- Diamond: 14%\n- Elite: 15%\n\n[Claim your 50% bonus →](/games)',
 array['first deposit bonus','50% bonus sweepstakes','fish table bonus'],
 true, now() - interval '1 day',
 '50% First Deposit Bonus — How to Claim It at Win Sweeps',
 'Win Sweeps gives every new player a 50% first deposit bonus on all 12 fish table and sweepstakes games. Here''s how to claim it and maximize your starting balance.'),

-- LONG-TAIL: specific how-to / location / comparison queries
('how-to-create-fire-kirin-account-online',
 'How to Create a Fire Kirin Account Online in Under 10 Minutes',
 'You don''t need to download an app or visit a location. Here''s the exact process to create a Fire Kirin account online at Win Sweeps and start playing today.',
 E'## Do You Need to Download Fire Kirin?\n\nNo. At Win Sweeps, we create your Fire Kirin account and provide your login credentials. You play via the official Fire Kirin mobile app (available for iOS and Android) using the account we set up for you.\n\n## The 5-Step Process\n\n### Step 1: Choose Fire Kirin\nGo to [/games/fire-kirin](/games/fire-kirin) at Win Sweeps.\n\n### Step 2: Fill the Get Started Form\n- Your name\n- WhatsApp or Telegram contact\n- Deposit amount\n- Payment method (CashApp, Zelle, Crypto)\n\n### Step 3: Upload Payment Screenshot\nComplete your deposit via CashApp/Zelle/Crypto and upload the screenshot. This is your proof of payment.\n\n### Step 4: We Set Up Your Account\nOur team creates your Fire Kirin account, applies your 50% first deposit bonus, and loads your credits.\n\n### Step 5: Receive Login Details\nWe send your Fire Kirin username and password via WhatsApp or Telegram — usually within the hour.\n\n## Minimum Deposit\n\n$20 via CashApp or Zelle. $50 minimum for crypto.\n\n## Your Reference Code\n\nEvery request gets a unique reference code (e.g., WS-A3F9B2C1). Use it to check status or contact support.\n\n[Create your Fire Kirin account now →](/games/fire-kirin)',
 array['create fire kirin account online','fire kirin account setup','fire kirin login'],
 true, now() - interval '12 hours',
 'How to Create a Fire Kirin Account Online in Under 10 Minutes | Win Sweeps',
 'Step-by-step guide to creating a Fire Kirin account online at Win Sweeps. No download required — we set up your account and send login details via WhatsApp.'),

('fish-table-games-online-texas',
 'Fish Table Games Online in Texas — Play Fire Kirin, Juwa & More',
 'Texas players can access all 12 Win Sweeps fish table and sweepstakes games online. Here''s how to get started from Houston, Dallas, San Antonio or anywhere in Texas.',
 E'## Playing Fish Table Games Online in Texas\n\nTexas has one of the largest sweepstakes gaming communities in the United States. Players in Houston, Dallas, San Antonio, Austin and across Texas play Fire Kirin, Juwa and Orion Stars online daily at Win Sweeps.\n\n## How Texas Players Get Started\n\n1. Go to [Win Sweeps](/texas) from anywhere in Texas\n2. Fill the Get Started form — choose your game and deposit amount\n3. Deposit via CashApp, Zelle or crypto\n4. We set up your account and confirm via WhatsApp, usually within the hour\n5. Log in and play from your phone, tablet or desktop\n\n## Most Popular Games in Texas\n\n1. **Fire Kirin** — consistently the most played fish table game among Texas players\n2. **Juwa** — fast-paced, high-action favorite in Houston and Dallas\n3. **Game Vault** — slots + fish tables in one platform\n\n## Cities We Serve in Texas\n\n- [Houston, TX](/texas/houston) — largest Texas player base\n- [Dallas, TX](/texas/dallas)\n- [San Antonio, TX](/texas/san-antonio)\n- [Austin, TX](/texas/austin)\n- [Fort Worth, TX](/texas/fort-worth)\n\n[Start playing from Texas →](/texas)',
 array['fish table games texas','fire kirin texas','sweepstakes texas online'],
 true, now() - interval '8 hours',
 'Fish Table Games Online in Texas — Fire Kirin, Juwa & More | Win Sweeps',
 'Texas players: access all 12 Win Sweeps fish table games online. Play Fire Kirin, Juwa, Orion Stars from Houston, Dallas, San Antonio or anywhere in Texas.'),

('game-vault-online-guide',
 'Game Vault Online — Complete Guide to the All-in-One Platform',
 'Game Vault is the only Win Sweeps game that packs fish tables, slots and arcade games into one platform. Here''s everything you need to know.',
 E'## What Is Game Vault?\n\nGame Vault is an "all-in-one" sweepstakes gaming platform — inside one app you get fish table games, slot machine titles and arcade-style games. It''s the best choice if you want variety without switching between platforms.\n\n## Games Inside Game Vault\n\nGame Vault includes:\n- Classic and modern slot titles\n- Multiple fish table variants\n- Arcade games with bonus rounds\n- Progressive jackpot rooms\n\n## How to Get a Game Vault Account at Win Sweeps\n\n[Submit a Game Vault request](/games/game-vault) through our Get Started form. We create your account and load your credits — you get a single login for the entire Game Vault platform.\n\n## Why Players Love Game Vault\n\n- One account, dozens of games\n- Switch between fish tables and slots without reloading\n- HOT badge — consistently high payout activity\n- 50% first deposit bonus applies across all Game Vault games\n\n[Create your Game Vault account →](/games/game-vault)',
 array['game vault online','game vault sweepstakes','game vault fish table'],
 true, now() - interval '4 hours',
 'Game Vault Online — Complete Guide to All-in-One Sweepstakes Platform | Win Sweeps',
 'Learn how to play Game Vault online at Win Sweeps. One login gives you access to fish tables, slots and arcade games — plus a 50% first deposit bonus.'),

('panda-master-online-guide',
 'Panda Master Online — Tips, Strategies & How to Get Started',
 'Panda Master is a bamboo forest fish table game with powerful Boss encounters and sudden multiplier bursts. Here''s how to win.',
 E'## Panda Master: Bamboo Forest Fish Action\n\nPanda Master sets its fish table in a bamboo forest environment. The visual theme is distinct from the ocean/space games, and the gameplay emphasizes Boss encounters — the Panda Boss is the most powerful single target in any Win Sweeps game.\n\n## Panda Master Boss System\n\n- **Bamboo Panda** — appears every 90 seconds, worth 80–200 credits\n- **Giant Panda Boss** — rare event, worth 500–1500 credits\n- **Golden Panda** — ultra-rare, jackpot trigger (2000+ credits)\n\n## Strategy for Panda Master\n\n1. Save your highest cannon power for Boss fish — ordinary fish are worth very little by comparison\n2. Watch the Boss timer — Bamboo Panda appears on a pattern\n3. Coordinate in multiplayer rooms: split fire between small fish to maintain ammo while waiting for Boss\n\n## How to Create a Panda Master Account\n\n[Submit your request](/games/panda-master) at Win Sweeps. We set up your Panda Master account and load your 50% first deposit bonus within the hour.\n\n[Play Panda Master at Win Sweeps →](/games/panda-master)',
 array['panda master online','panda master fish table','panda master game guide'],
 true, now() - interval '2 hours',
 'Panda Master Online — Strategy Guide & How to Get Started | Win Sweeps',
 'Complete guide to Panda Master fish table game online. Learn Boss strategies, multiplier tips and how to create your Panda Master account at Win Sweeps.'),

('milky-way-fish-table-guide',
 'Milky Way Fish Table Game — Galactic Jackpots Explained',
 'Milky Way is a space fish table game where galactic multipliers rain down during bonus storms. Here''s everything you need to know.',
 E'## Milky Way: Space-Themed Fish Table\n\nMilky Way takes the fish table format to outer space — instead of ocean fish, you''re hunting alien creatures and cosmic entities. The bonus mechanic — Galactic Storm — is one of the most visually spectacular in the Win Sweeps lineup.\n\n## The Galactic Storm Bonus\n\nRandom timed events trigger a Galactic Storm: every catch is multiplied by 2×–5× for 45 seconds. During this window, even small creatures are worth major credits.\n\n## Milky Way Strategy\n\n- **Pre-storm:** play conservatively at low cannon power\n- **During storm:** max out cannon power and focus on the largest targets\n- **Post-storm:** scale back immediately — multipliers reset and high power burns credits\n\n## How to Get a Milky Way Account\n\n[Create your Milky Way account](/games/milky-way) at Win Sweeps. We set it up and load your credits — 50% first deposit bonus included.\n\n[Play Milky Way at Win Sweeps →](/games/milky-way)',
 array['milky way game','milky way fish table','milky way online'],
 true, now() - interval '1 hour',
 'Milky Way Fish Table Game — Galactic Jackpots Explained | Win Sweeps',
 'Play Milky Way fish table online at Win Sweeps. Learn the Galactic Storm bonus mechanic and get strategies to maximize your credits on this space-themed game.'),

('win-at-fish-table-games-strategies',
 'How to Win at Fish Table Games — Top Strategies That Actually Work',
 'Most fish table players waste ammo on the wrong targets. Here are the strategies that experienced Win Sweeps players use to stay profitable.',
 E'## The #1 Mistake New Players Make\n\nNew players use max cannon power on every fish. This burns through credits fast on low-value targets. The key is cannon power management.\n\n## Core Principles\n\n### 1. Match Cannon Power to Fish Value\nSmall fish are not worth high-power shots. Use 1–2 power for schools of small fish, save 5–10 for Boss fish.\n\n### 2. Focus on Boss Fish\nBoss fish in every game (Fire Kirin''s Dragon Boss, Juwa''s Chain Reaction Boss, Panda Master''s Giant Panda) carry 10–100× the credits of regular fish. Missing a Boss fish by burning your ammo on small targets is the most costly mistake.\n\n### 3. Play Bonus Events\nAll Win Sweeps games have timed bonus events (Dragon Storm, Galactic Storm, etc.). During these windows, increase cannon power and focus on mid-size fish — the multiplier makes them worth as much as a Boss outside of the event.\n\n### 4. Use Multi-Player Rooms Strategically\nIn multi-player rooms, coordinate on Boss fish. If 4 players each fire 3 shots at a Boss, it dies faster than 1 player firing 12 shots — same ammo cost, but the Boss is dead before it swims off screen.\n\n### 5. Take Breaks After Big Wins\nFish table games have variance cycles. If you''ve just hit a big Boss fish, expect a shorter-than-average quiet period before the next one.\n\n## Game-by-Game Tips\n\n- **Fire Kirin:** boss fish appear most often — patient play pays off\n- **Juwa:** use Chain Reaction — dense school + medium power = credits chain\n- **Orion Stars:** priority constellation fish even if small — jackpot trigger\n\n[Pick your game and start playing →](/games)',
 array['how to win fish table','fish table strategy','sweepstakes game tips'],
 true, now() - interval '30 minutes',
 'How to Win at Fish Table Games — Strategies That Actually Work | Win Sweeps',
 'Top fish table strategies from experienced Win Sweeps players. Learn cannon power management, Boss targeting and bonus event tactics to stay profitable.'),

('vblink-cash-frenzy-guide',
 'VBlink & Cash Frenzy — The Fastest Slots at Win Sweeps',
 'VBlink and Cash Frenzy are the two highest-speed slot titles in the Win Sweeps lineup. Here''s what makes them different from fish table games and how to play.',
 E'## Slots vs Fish Tables at Win Sweeps\n\nFish table games require active aiming. Slot games (VBlink, Cash Frenzy, Vegas Sweeps) are spin-based — you set your bet, spin, and the reels determine your payout. The decision is bet sizing, not aiming.\n\n## VBlink\n\nVBlink runs faster than any other slot at Win Sweeps. Spins resolve in under 1 second. Bonus rounds trigger frequently and stack — free spin chains can run 20+ rounds.\n\n**Best for:** players who want volume and rapid action.\n\n## Cash Frenzy\n\nCash Frenzy is a medium-speed slot with a "Cash Meter" mechanic — every spin adds to a cash meter that pays out when full. Even losing spins contribute to the meter.\n\n**Best for:** players who want a safety net mechanic and steadier variance.\n\n## Which Should You Choose?\n\n- Want the fastest possible gameplay? → **VBlink**\n- Want steadier returns with a bonus meter? → **Cash Frenzy**\n- Want a full slot variety platform? → **Game Vault** (includes both plus dozens more)\n\n[Create your account →](/games)',
 array['vblink game','cash frenzy online','fastest slots sweepstakes'],
 true, now(),
 'VBlink & Cash Frenzy — The Fastest Slots at Win Sweeps | Guide',
 'Compare VBlink and Cash Frenzy at Win Sweeps. Learn which high-speed slot game fits your play style and how to create your account with a 50% bonus.'),

('fish-table-games-florida',
 'Fish Table Games Online in Florida — Play From Miami, Orlando & Beyond',
 'Florida players access all 12 Win Sweeps fish table and sweepstakes games online. Play Fire Kirin, Juwa and more from Miami, Jacksonville, Orlando, Tampa and across FL.',
 E'## Fish Table Gaming in Florida\n\nFlorida has a massive sweepstakes gaming community. Win Sweeps serves players across the state — from Miami and Fort Lauderdale in the south to Jacksonville in the north.\n\n## How to Start Playing in Florida\n\n1. Go to [Win Sweeps Florida](/florida)\n2. Submit your deposit request — choose Fire Kirin, Juwa, Game Vault or any of 12 games\n3. Deposit via CashApp, Zelle or crypto\n4. We create your account and confirm via WhatsApp within the hour\n\n## Florida City Pages\n\n- [Miami, FL](/florida/miami)\n- [Jacksonville, FL](/florida/jacksonville)\n- [Orlando, FL](/florida/orlando)\n- [Tampa, FL](/florida/tampa)\n\n## 50% Bonus for Florida Players\n\nAll new players — including those signing up from Florida — receive a 50% first deposit bonus on all 12 games.\n\n[Play from Florida →](/florida)',
 array['fish table games florida','fire kirin florida','sweepstakes florida online'],
 true, now(),
 'Fish Table Games Online in Florida — Play Fire Kirin, Juwa & More | Win Sweeps',
 'Florida players: access all 12 Win Sweeps fish table and sweepstakes games online. 50% first deposit bonus. Account setup via WhatsApp within the hour.');

-- ==========================================
-- MIGRATION: 20260614000022_fix_promotions.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0022 · Fix promotions — replace 200% seed with real offers
-- ============================================================================

-- Remove the placeholder 200% seed promotion
delete from public.promotions where slug = 'welcome-boost';

-- Insert the correct promotions matching the actual business model
insert into public.promotions
  (slug, title, summary, description, badge_text, coins_bonus, xp_bonus,
   status, is_featured, priority, starts_at, max_claims_per_user)
values
  ('first-deposit-50',
   '50% First Deposit Bonus',
   'Get 50% extra credits on your first deposit — applies to all 12 games. No code needed.',
   'Every new Win Sweeps player receives a 50% bonus on their first deposit, applied automatically to their game balance. Deposit $100, get $150 in credits on Fire Kirin, Juwa, Orion Stars, Game Vault or any of our 12 games.',
   'NEW PLAYERS', 0, 0, 'active', true, 5, now(), 1)
on conflict (slug) do update set
  title       = excluded.title,
  summary     = excluded.summary,
  description = excluded.description,
  badge_text  = excluded.badge_text,
  is_featured = excluded.is_featured,
  priority    = excluded.priority,
  status      = 'active';

-- Update arena-pass-bundle to be more accurate
update public.promotions set
  title       = 'Refer a Friend — Earn Bonus Credits',
  summary     = 'Share your referral code. When your friend makes their first deposit, you both earn bonus game credits instantly.',
  description = 'Share your unique referral code via WhatsApp, text, or social media. When a referred friend creates an account and makes their first deposit, you both receive bonus game credits — instantly, with no cap on referrals.',
  badge_text  = 'REFERRAL',
  is_featured = true,
  priority    = 10
where slug = 'arena-pass-bundle';

-- Keep weekend-xp-surge but fix the copy
update public.promotions set
  title       = 'VIP Reload Bonuses — 10% to 15%',
  summary     = 'Returning players earn 10–15% reload bonuses on every deposit based on VIP tier.',
  description = 'Every deposit after your first earns a reload bonus: Gold 10%, Platinum 12%, Diamond 14%, Elite 15%. Your VIP tier rises automatically with every deposit — no action required.',
  badge_text  = 'VIP'
where slug = 'weekend-xp-surge';

-- ==========================================
-- MIGRATION: 20260614000023_requests_user_id.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0023 · Add user_id to requests — link anonymous deposits to auth users
-- ============================================================================

-- Add nullable user_id column so existing anonymous rows are preserved
alter table public.requests
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Index for fast per-user lookups
create index if not exists requests_user_id_idx on public.requests(user_id);

-- RLS: logged-in users can see their own requests
create policy "users read own requests"
  on public.requests for select
  using (user_id = auth.uid());

-- ==========================================
-- MIGRATION: 20260614000024_complete_profile_rpc.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0024 · complete_my_profile RPC
-- Lets an authenticated user save their own profile completion fields without
-- needing service_role. SECURITY DEFINER bypasses RLS; auth.uid() ensures the
-- caller can only write their own row.
-- ============================================================================

create or replace function public.complete_my_profile(
  p_display_name  text,
  p_country       text    default null,
  p_bio           text    default null,
  p_marketing_opt_in boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    display_name     = p_display_name,
    country          = p_country,
    bio              = p_bio,
    marketing_opt_in = p_marketing_opt_in,
    profile_completed = true
  where id = auth.uid()
    and not is_banned;

  if not found then
    raise exception 'profile_not_found';
  end if;
end;
$$;

-- Authenticated users only; public (anon) cannot call this
revoke execute on function public.complete_my_profile(text, text, text, boolean) from public;
grant  execute on function public.complete_my_profile(text, text, text, boolean) to authenticated;

-- ==========================================
-- MIGRATION: 20260614000025_games_play_download_urls.sql
-- ==========================================

-- Migration 0025: add play_url and download_url columns to games
-- These hold the external URLs for online play and app download links.
-- Both are nullable — admin fills them in via CMS; cards show placeholders until set.
alter table public.games
  add column if not exists play_url     text,
  add column if not exists download_url text;

-- ==========================================
-- MIGRATION: 20260616000050_blog_posts_extra.sql
-- ==========================================

-- 32 additional SEO blog posts (18 already exist -- total becomes 50)
-- Uses dollar quoting for content to avoid all string escaping issues.
-- Safe to re-run: each statement has ON CONFLICT (slug) DO UPDATE.

do $wrap$
declare
  upsert_cols text := '
    title           = excluded.title,
    excerpt         = excluded.excerpt,
    content         = excluded.content,
    tags            = excluded.tags,
    is_published    = excluded.is_published,
    seo_title       = excluded.seo_title,
    seo_description = excluded.seo_description';
begin

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'vegas-sweeps-online-guide',
'Vegas Sweeps Online -- Classic Casino Slots and Neon Jackpots',
'Vegas Sweeps delivers authentic casino-style slots inside a sweepstakes model. Here is what is inside the platform, how the reels pay, and how to start.',
$t$## What Is Vegas Sweeps?

Vegas Sweeps is a sweepstakes slot platform styled after a Las Vegas casino floor. Unlike fish table games that require aiming, Vegas Sweeps is reel-based -- you pick your bet size, spin, and the paylines decide your return.

## Game Library Inside Vegas Sweeps

Vegas Sweeps includes dozens of slot titles grouped into:
- Classic 3-reel -- low volatility, steady small wins
- Video slots -- 5-reel with bonus rounds, wilds and scatters
- Progressive jackpots -- shared jackpot pools that grow until one player hits

## How to Start Playing Vegas Sweeps

1. Submit your request at Win Sweeps
2. Upload your CashApp, Zelle or crypto payment screenshot
3. Our team creates your Vegas Sweeps account and loads your credits
4. Receive your login details via WhatsApp or Telegram -- usually within the hour

## Vegas Sweeps Strategy Tips

- Classic slots: lower bet per spin, higher spin volume -- good for stretching a session
- Video slots: higher variance, bigger bonus rounds -- better for jackpot hunting
- Progressive jackpots: require max-bet on qualifying lines to be eligible

Your first deposit at Win Sweeps earns 50% extra credits applied across any game -- including Vegas Sweeps.$t$,
array['vegas sweeps','vegas sweeps online','sweepstakes slots'],
true,'2026-05-18'::timestamptz,
'Vegas Sweeps Online -- Classic Casino Slots at Win Sweeps',
'Play Vegas Sweeps online at Win Sweeps. Classic and video slots, progressive jackpots, 50% first deposit bonus. Account setup via WhatsApp within the hour.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'mafia-fish-table-game-guide',
'Mafia Fish Table Game -- Boss Battles, Crime Pools and Big Multipliers',
'Mafia is the underground hit of the Win Sweeps lineup. Street boss battles, syndicate jackpot pools and explosive multipliers set it apart from every other game.',
$t$## What Is the Mafia Fish Table Game?

Mafia swaps the ocean for an organized crime underworld. Instead of fish, you hunt crime bosses, getaway cars and henchmen across a dark urban backdrop. The Boss encounter system is the deepest in the Win Sweeps lineup.

## The Mafia Boss System

- Street Boss -- appears every 60 seconds, worth 100-400 credits
- Capo -- rarer, triggers a Syndicate Jackpot pool worth 1000-3000 credits shared across the room
- Godfather -- ultra-rare single-target event. If you land the kill shot, the entire jackpot pool is yours

## Mafia Strategy

1. Never spend high cannon power on henchmen (small targets) -- they are not worth it
2. Watch the Boss timer and pre-charge your cannon to high power 10 seconds before a Street Boss appears
3. In multi-player rooms, coordinate on the Capo -- agree on fire rotation to avoid wasted ammo on the same target
4. The Godfather is unpredictable -- always keep 30% of your ammo budget in reserve for surprise appearances

Mafia rewards patience and coordination more than any other game at Win Sweeps.$t$,
array['mafia fish table','mafia sweepstakes game','mafia game online'],
true,'2026-05-19'::timestamptz,
'Mafia Fish Table Game -- Boss Battles and Syndicate Jackpots | Win Sweeps',
'Complete guide to the Mafia fish table game at Win Sweeps. Learn Boss timers, Syndicate Jackpot strategy and how to create your account with a 50% bonus.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'mr-all-in-one-game-guide',
'Mr. All In One -- Fish Tables, Slots and Arcade Under One Login',
'Mr. All In One is the most variety-packed platform at Win Sweeps. One login gives you fish tables, slot titles and arcade games without switching apps.',
$t$## What Makes Mr. All In One Different?

Most sweepstakes games specialize in one format. Mr. All In One is a multi-format platform -- fish tables, slot reels and arcade-style mini-games all live under a single account and balance.

## What Is Inside Mr. All In One?

- Fish table section: multiple fish table rooms at varying bet sizes
- Slot section: 20+ slot titles including 3-reel classics and 5-reel video slots
- Arcade section: fast-paced mini-games with bonus rounds

## Who Should Play Mr. All In One?

Mr. All In One is ideal for players who:
- Get bored playing the same game for hours
- Want to switch from fish tables to slots mid-session without a new account
- Are exploring which format they enjoy most before committing

Submit your request at Win Sweeps to get your Mr. All In One login. The 50% first deposit bonus applies across all formats inside the platform.$t$,
array['mr all in one game','mr all in one sweepstakes','all in one fish table'],
true,'2026-05-20'::timestamptz,
'Mr. All In One -- Fish Tables, Slots and Arcade Under One Login | Win Sweeps',
'Play Mr. All In One at Win Sweeps. Fish tables, slot games and arcade all under one account. Create your account with a 50% first deposit bonus today.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'cash-machine-fish-table-guide',
'Cash Machine Game -- Steady Paylines and Free-Spin Engine Explained',
'Cash Machine is the most consistent earner in the Win Sweeps catalog. Reliable paylines and a generous free-spin engine reward patient, measured play.',
$t$## Cash Machine: Consistency Over Volatility

In a lineup full of high-variance fish table games, Cash Machine stands out for one reason: consistency. Its payline structure produces steady small-to-medium wins far more often than the all-or-nothing swings of games like Juwa or VBlink.

## The Free-Spin Engine

Cash Machine's standout feature is its free-spin mechanic. Every 50 spins at any bet level charges the free-spin meter. When full:
- 10 free spins are awarded automatically
- All free spin wins are paid out with no deduction from your balance
- The meter resets and starts charging again immediately

## Who Should Play Cash Machine?

Cash Machine is best for:
- Players who want longer sessions without big swings
- Those who prefer predictable, measured returns over jackpot hunting
- Anyone who has had a bad run on high-variance games and wants to rebuild their balance steadily

Submit your request at Win Sweeps to get your Cash Machine account with the standard 50% first deposit bonus.$t$,
array['cash machine game','cash machine fish table','cash machine sweepstakes'],
true,'2026-05-21'::timestamptz,
'Cash Machine Game -- Steady Paylines and Free-Spin Engine | Win Sweeps',
'Play Cash Machine at Win Sweeps. Consistent paylines, a generous free-spin engine, and a 50% first deposit bonus. Best sweepstakes game for steady players.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'juwa-advanced-tips-strategies',
'Juwa Advanced Tips -- Chain Combos, Ammo Budget and Boss Timing',
'Juwa rewards players who understand its Chain Reaction system. Here are the advanced targeting and timing strategies that separate profitable sessions from losing ones.',
$t$## Why Juwa Is Different From Other Fish Table Games

Most fish table games reward accurate aiming at individual targets. Juwa adds a layer: the Chain Reaction system. Kill 5+ fish within 3 seconds and a multiplier chain fires -- every fish caught in the next 10 seconds is worth 2x-8x normal value.

## Triggering Chain Reactions Reliably

Set up: wait for a dense school of small-to-medium fish to cluster near the screen center.

Execute: use a fan shot (rotate your cannon 30 degrees while firing) across the school at medium power. The goal is 5+ hits in under 3 seconds.

Capitalize: immediately after the Chain fires, shift to larger fish. Large fish during Chain are worth enormous credits.

## Ammo Budget Management

Juwa sessions should follow a 70/30 split:
- 70% of ammo goes to Chain setup and mid-size fish
- 30% held in reserve for Boss fish and Dragon Storm events

## Dragon Storm Tactics

Dragon Storm doubles all catch values for 30 seconds. When it fires:
1. Immediately switch to max cannon power
2. Focus all shots on the largest fish visible
3. Ignore small fish entirely -- the time cost per small fish is not worth it during the Storm$t$,
array['juwa tips','juwa strategy','juwa chain reaction','juwa advanced guide'],
true,'2026-05-22'::timestamptz,
'Juwa Advanced Tips -- Chain Combos, Ammo Budget and Boss Timing | Win Sweeps',
'Master Juwa with advanced chain reaction tactics, ammo budget strategies, and Dragon Storm tips. Play Juwa at Win Sweeps with a 50% first deposit bonus.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'orion-stars-advanced-guide',
'Orion Stars Advanced Strategy -- Constellation Jackpots and Deep Space Boss',
'Unlocking the Orion Stars constellation jackpot requires a specific targeting pattern. Here is the strategy experienced players use to trigger it reliably.',
$t$## The Orion Stars Jackpot System

Orion Stars has the most layered jackpot trigger in the Win Sweeps lineup. Three tiers:

1. Star Jackpot -- triggered by catching 3 constellation fish in a row. Worth 200-500 credits.
2. Nebula Jackpot -- catch all 7 constellation types within a single play session. Worth 800-2000 credits.
3. Deep Space Boss Kill -- land the final hit on the Deep Space Boss. Jackpot pool split: 40% to the kill-shot player, 60% shared across the room.

## Constellation Fish Priority List

Not all constellation fish appear with equal frequency. Priority order (most to least common):
1. Aries Fish (ram-shaped)
2. Orion Belt (three bright stars in a line)
3. Cassiopeia (W-shaped)
4. Scorpius (curved tail)

## Deep Space Boss Strategy

- The Deep Space Boss appears roughly every 8-12 minutes
- It takes 40-80 hits to kill depending on room power
- Always use medium power when a Boss appears -- you want sustained fire, not burst
- If 3+ players coordinate, the Boss dies 2x-3x faster
- Save your highest power shots for the final 20% of Boss HP -- kill-shot gets 40% of the jackpot pool$t$,
array['orion stars strategy','orion stars jackpot','orion stars deep space boss'],
true,'2026-05-23'::timestamptz,
'Orion Stars Advanced Strategy -- Constellation Jackpots and Deep Space Boss | Win Sweeps',
'Master Orion Stars at Win Sweeps. Learn to trigger constellation jackpots, hunt the Deep Space Boss, and maximize your credits with proven strategies.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'fire-kirin-advanced-tips',
'Fire Kirin Pro Tips -- Dragon Boss Timing, Ammo Efficiency and Bonus Stacking',
'Beyond the basics, Fire Kirin rewards players who understand Dragon Boss timing patterns and bonus stacking. Here are the strategies that top Win Sweeps players use.',
$t$## Fire Kirin Boss Timing

Fire Kirin Dragon Boss appears on a semi-predictable cycle:
- Every 3-5 minutes on standard rooms
- Every 90-120 seconds on premium-tier rooms

Experienced players track the last Boss appearance time and begin saving high-power ammo about 60 seconds before the next expected window.

## Cannon Power Efficiency

- Small school fish: use power level 1-2 (low value -- conservation wins)
- Mid-size fish: use power level 3-5 (good return on investment)
- Large solo fish: use power level 6-8 (high value, occasional miss is acceptable)
- Dragon Boss: use max available power (every missed shot extends the fight)

## Bonus Stacking

Fire Kirin bonuses can stack in a single session:
1. Reload Bonus -- reloading during a session applies your tier bonus
2. Daily Bonus -- claim your Win Sweeps daily reward before playing
3. Fire Storm Event -- timed room-wide event where all catches are worth 3x

Stack a reload during a Fire Storm and every fish catch earns significantly more credits.

## Common Mistakes to Avoid

- Never use max power on small schools -- it is the single biggest drain on returns
- Do not quit immediately after a big Boss win -- the next Boss often appears sooner after a kill
- Play in higher-tier rooms when your balance allows -- payout ceilings are proportionally higher$t$,
array['fire kirin pro tips','fire kirin boss strategy','fire kirin ammo efficiency'],
true,'2026-05-24'::timestamptz,
'Fire Kirin Pro Tips -- Boss Timing, Ammo Efficiency and Bonus Stacking | Win Sweeps',
'Advanced Fire Kirin strategies for Win Sweeps players. Learn Dragon Boss timing, cannon power efficiency and bonus stacking to maximize your credits per session.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'how-to-create-juwa-account-online',
'How to Create a Juwa Account Online -- Fast Setup at Win Sweeps',
'No download needed, no store visit required. Here is the exact process to get a Juwa account online at Win Sweeps -- from payment to login in under an hour.',
$t$## Can You Create a Juwa Account Online?

Yes -- through Win Sweeps. You do not need to visit a physical location or find an unlisted APK file. We create your Juwa account, load your credits, and send your login details via WhatsApp or Telegram.

## Step-by-Step: Create a Juwa Account at Win Sweeps

Step 1: Go to the Juwa page at Win Sweeps.

Step 2: Fill the Get Started form with your name, contact method (WhatsApp, Telegram, Messenger or phone), deposit amount and payment method.

Step 3: Make your deposit via CashApp, Zelle or crypto. Take a screenshot of the completed transaction.

Step 4: Upload your payment screenshot. This is your proof of deposit.

Step 5: Submit and wait. You receive a reference code (e.g., WS-B7E2A3F1). Our team contacts you via your chosen channel, creates your Juwa account and sends your login details -- usually within the hour during 9 AM-10 PM EST.

## What Do You Receive?

- Juwa username and password
- Your starting credit balance (deposit plus 50% bonus on first deposit)
- Direct support contact for any questions$t$,
array['create juwa account online','juwa account setup','juwa login how to get'],
true,'2026-05-25'::timestamptz,
'How to Create a Juwa Account Online in Under an Hour | Win Sweeps',
'Step-by-step guide to creating a Juwa account online at Win Sweeps. No download, no store visit. Submit your deposit request and receive login details via WhatsApp.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'how-to-create-orion-stars-account',
'How to Create an Orion Stars Account Online -- Step-by-Step Guide',
'Creating an Orion Stars account through Win Sweeps takes under an hour. Here is the complete process: submitting your request, making your deposit and receiving your login.',
$t$## Orion Stars Account Setup -- How It Works

Orion Stars does not have a public sign-up page. Accounts are created by authorized operators -- Win Sweeps is one of them.

## The Process

1. Visit the Orion Stars page at Win Sweeps and complete the Get Started form.
2. Enter your full name, WhatsApp or Telegram number, deposit amount and payment method.
3. Send your deposit via CashApp or Zelle. Take a clear screenshot of the completed transaction.
4. Attach the screenshot to your request form to verify your payment before we create the account.
5. We create your Orion Stars account, apply your 50% first deposit bonus, and send your username and password via WhatsApp or Telegram.

## Important Notes

- Operating hours: 9 AM-10 PM EST, 7 days a week
- First deposit bonus: 50% applied automatically -- no code needed
- Support: message us on WhatsApp if your account is not set up within 2 hours of payment confirmation$t$,
array['create orion stars account','orion stars account setup','orion stars login online'],
true,'2026-05-26'::timestamptz,
'How to Create an Orion Stars Account Online | Win Sweeps',
'Create your Orion Stars account online at Win Sweeps. Submit a deposit request and receive your username and password via WhatsApp within the hour.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'how-to-create-game-vault-account',
'How to Create a Game Vault Account at Win Sweeps -- Complete Guide',
'Game Vault accounts give you access to fish tables, slots and arcade games under one login. Here is how to create yours at Win Sweeps in under an hour.',
$t$## Game Vault Account -- What You Get

A Game Vault account at Win Sweeps is not a single-game login. It is access to an entire gaming platform with:
- Multiple fish table rooms
- 20+ slot titles
- Arcade games
- A single wallet that works across all formats

## How to Create Your Game Vault Account

Step 1: Go to the Game Vault page at Win Sweeps.

Step 2: Fill the Get Started form with your name, contact info, deposit amount and payment method.

Step 3: Make your deposit via CashApp, Zelle or crypto. Screenshot the transaction.

Step 4: Upload your screenshot and submit the form.

Step 5: We create your Game Vault account, apply your 50% first deposit bonus, and send your login credentials via WhatsApp or Telegram.

## Game Vault Account Tips

- Your Game Vault balance is universal -- winnings from the fish table section can be spent in the slot section and vice versa
- Fish table rooms inside Game Vault run on the same engine as standalone fish table games
- The slot section includes progressive jackpots -- read each game rules to understand jackpot eligibility$t$,
array['create game vault account','game vault login','game vault sweepstakes account'],
true,'2026-05-27'::timestamptz,
'How to Create a Game Vault Account at Win Sweeps | Complete Guide',
'Create your Game Vault account at Win Sweeps. One login gives you fish tables, slots and arcade. 50% first deposit bonus. Account setup within the hour.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'how-to-deposit-bitcoin-fish-table',
'How to Deposit Bitcoin for Fish Table Games -- Instant and Secure',
'Bitcoin and USDT are the fastest deposit methods for large amounts at Win Sweeps. Here is the step-by-step: what wallet to use, how to send, and when credits appear.',
$t$## Why Deposit Crypto for Fish Table Games?

For deposits over $200, Bitcoin and USDT offer advantages over CashApp and Zelle:
- No bank sending limits
- No holds or flags from financial institutions
- Complete transaction privacy
- Available 24/7 with no processing delays

## Step-by-Step: Bitcoin Deposit

Step 1: Open your Bitcoin wallet (Coinbase, Cash App BTC, Trust Wallet, Exodus or any wallet that allows external sends).

Step 2: Request the Win Sweeps BTC deposit address from the Get Started form and select Bitcoin as your payment method.

Step 3: Send your Bitcoin. Confirm the address carefully -- Bitcoin transactions are irreversible.

Step 4: Screenshot your sent transaction (showing the amount, date and transaction ID).

Step 5: Upload the screenshot with your request form. Bitcoin confirmations take 10-30 minutes on average.

## USDT vs Bitcoin

- USDT (TRC20): settles in 1-5 minutes, near-zero fees, stable value ($1 always equals $1)
- Bitcoin: settles in 10-30 minutes, network fees vary, price fluctuates

Use USDT TRC20 for speed. Use Bitcoin for amounts over $500 where USDT limits apply.

Minimum for crypto deposits: $50. No maximum.$t$,
array['bitcoin fish table deposit','crypto deposit sweepstakes','bitcoin game account'],
true,'2026-05-28'::timestamptz,
'How to Deposit Bitcoin for Fish Table Games | Win Sweeps Guide',
'Complete guide to Bitcoin and USDT deposits at Win Sweeps. Instant setup, no bank limits, 50% first deposit bonus on all 12 fish table and sweepstakes games.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'beginner-guide-fish-table-games',
'Complete Beginner Guide to Fish Table Games -- Everything You Need to Know',
'Never played a fish table game before? This guide covers exactly what they are, how they work, which one to start with, and how to claim your first deposit bonus.',
$t$## What Are Fish Table Games?

Fish table games (also called fish games or fish arcades) are action-skill sweepstakes games where you control a cannon that fires at fish swimming across the screen. Each fish you catch earns credits -- bigger fish earn more. You manage how much firepower you use on each shot.

## How Fish Table Games Work

1. You are given a cannon at a fixed position on screen
2. You choose a power level for each shot (1 = cheap and weak, 10 = expensive but powerful)
3. You aim at fish and fire
4. If your shot hits a fish, you earn that fish credit value
5. Your cannon shot costs ammo (credits). Net profit = credits earned minus ammo spent

## The Skill Element

Fish table games are not purely random. There is a genuine skill element:
- Choosing which fish to target (big fish = more credits but fewer shots)
- Managing cannon power (overspending on small fish = net loss)
- Timing Boss encounters (Boss fish carry the highest payouts)

## Which Game Should a Beginner Start With?

1. Fire Kirin -- slowest fish movement, most forgiving, Boss fish appear frequently
2. Cash Machine -- steady paylines, free-spin mechanic cushions bad runs
3. Game Vault -- variety platform, good if you want to try fish tables and slots

## Your First Deposit at Win Sweeps

Every new player gets a 50% bonus on their first deposit. Deposit $50 and start with $75 in credits.$t$,
array['beginner fish table guide','fish table games explained','how fish table games work'],
true,'2026-05-29'::timestamptz,
'Complete Beginner Guide to Fish Table Games | Win Sweeps',
'New to fish table games? This complete beginner guide explains how they work, which game to start with, and how to claim a 50% first deposit bonus at Win Sweeps.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'vip-program-guide-winsweeps',
'Win Sweeps Rewards Program -- How to Climb From Silver to Elite',
'Win Sweeps has 5 reward tiers: Silver, Gold, Platinum, Diamond and Elite. Each level unlocks higher reload bonuses and reward multipliers. Here is exactly how to climb fast.',
$t$## The Win Sweeps Rewards System

Every player starts at Silver tier. As you play, you earn XP -- and XP accumulates into higher levels. Higher tiers unlock better reload bonuses, bigger daily reward multipliers, and priority support.

## The 5 Reward Tiers

- Silver -- base reload bonus, 1x daily reward multiplier
- Gold -- 10% reload bonus, 1.25x daily reward multiplier
- Platinum -- 12% reload bonus, 1.5x daily reward multiplier
- Diamond -- 14% reload bonus, 1.75x daily reward multiplier
- Elite -- 15% reload bonus, 2x daily reward multiplier

## How to Earn XP

XP is awarded for:
- Every deposit made
- Daily reward claims (streak bonuses multiply XP)
- Completing achievements (first deposit, first win, referral, etc.)
- Promotional events

## How to Climb Fast

1. Claim your daily reward every day. Missing days breaks your streak and costs XP multipliers.
2. Deposit consistently. Even smaller, more frequent deposits earn more XP than one large quarterly deposit.
3. Complete achievements. Check your achievement list in the dashboard -- many are one-time XP grants you may not have claimed.
4. Refer a friend. A qualified referral earns a large one-time XP bonus.

## Why Elite Tier Matters

At Elite tier, every reload deposit earns 15% bonus credits and your daily rewards are worth 2x compared to Silver. Over a month of regular play, the difference compounds significantly.$t$,
array['win sweeps rewards','rewards fish table','sweepstakes rewards program'],
true,'2026-05-30'::timestamptz,
'Win Sweeps Rewards Program -- How to Climb Silver to Elite | Guide',
'Learn how Win Sweeps reward tiers work. Silver, Gold, Platinum, Diamond and Elite levels unlock reload bonuses and reward multipliers. Here is how to climb fast.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'daily-rewards-free-coins-guide',
'How to Earn Free Coins Every Day at Win Sweeps -- Daily Rewards Explained',
'Win Sweeps gives every player free coins daily through the daily claim, streak bonuses and achievements. Here is how to maximize every source of free credits.',
$t$## Daily Reward Sources at Win Sweeps

Free coins at Win Sweeps come from four sources:

### Daily Claim
Log into your dashboard and click the daily claim button. The amount increases with your reward tier and resets every 24 hours.

### Streak Bonus
Claiming on consecutive days multiplies your daily reward:
- Day 1-6: base amount
- Day 7: 2x base (weekly bonus)
- Day 14: 3x base
- Day 30: 5x base (monthly jackpot)

Missing a single day resets your streak to Day 1.

### Achievements
One-time coin grants for milestones:
- First deposit
- First win
- Reaching level 5, 10, 25, 50
- Completing your profile
- First referral that qualifies

Check your Achievements page in the dashboard -- many players have unclaimed achievements.

### Spin Wheel
A daily free spin gives bonus coins. Spin is available every 24 hours in the dashboard.

## Maximizing Your Daily Coins

- Set a daily reminder to claim (streak is the biggest multiplier)
- Complete all pending achievements before your first deposit session
- Check the promotions page weekly -- limited-time events offer bonus claim windows
- Refer a friend -- each qualified referral earns a large one-time bonus$t$,
array['free coins sweepstakes','daily rewards fish table','win sweeps daily claim'],
true,'2026-05-31'::timestamptz,
'How to Earn Free Coins Every Day at Win Sweeps | Daily Rewards Guide',
'Complete guide to daily rewards, streak bonuses, achievements and spin wheel at Win Sweeps. Maximize your free coins every day across all 12 fish table games.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'referral-program-earn-coins',
'Earn Coins by Referring Friends at Win Sweeps -- Referral Program Guide',
'Every friend you refer to Win Sweeps earns you bonus coins when they qualify. Here is how the referral system works, when coins credit, and how to share your code.',
$t$## How the Win Sweeps Referral Program Works

When a friend you refer completes their profile and makes their first deposit, you earn a referral bonus -- a one-time coin grant deposited directly to your Win Sweeps balance.

## Step-by-Step

1. Go to Dashboard and then Referrals
2. Copy your unique referral code
3. Share it with friends via WhatsApp, Telegram or any chat
4. When a friend uses your code at registration and qualifies, you receive your bonus

## What Counts as Qualified?

A referral qualifies when:
1. Your friend registers using your referral code
2. They complete their profile (name, contact info, photo)
3. They make their first deposit

This usually takes under 30 minutes for motivated friends.

## How Much Do You Earn Per Referral?

Referral bonuses scale with your reward tier:
- Silver: base referral bonus
- Gold: 1.25x base
- Platinum: 1.5x base
- Diamond: 1.75x base
- Elite: 2x base

## Tips for Getting Referrals

- Share your code in active group chats where people already know about fish table games
- Tell friends about the 50% first deposit bonus -- it is a strong incentive for them to try Win Sweeps
- Follow up once after sharing -- referrals that qualify within 48 hours have the highest completion rate$t$,
array['win sweeps referral','earn coins referring friends','sweepstakes referral program'],
true,'2026-06-01'::timestamptz,
'Earn Coins Referring Friends at Win Sweeps | Referral Program Guide',
'Win Sweeps referral program explained. Share your code, earn coins when friends qualify, and scale bonuses with your reward tier. Complete guide here.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'fish-table-games-georgia',
'Fish Table Games Online in Georgia -- Play Fire Kirin and Juwa From Anywhere in GA',
'Georgia players can access all 12 Win Sweeps fish table and sweepstakes games online. Here is how to get started from Atlanta, Savannah, Augusta or anywhere in the state.',
$t$## Fish Table Games Available in Georgia

All 12 Win Sweeps games are available to Georgia players online -- no physical location required. Georgia has a large and active fish table community, particularly in Atlanta, Savannah and Augusta.

## How Georgia Players Start

1. Go to Win Sweeps from anywhere in Georgia
2. Fill the Get Started form -- choose your game and deposit amount
3. Deposit via CashApp, Zelle or crypto
4. We confirm your account via WhatsApp within the hour
5. Play from your phone, tablet or desktop

## Most Played Games in Georgia

1. Fire Kirin -- the most popular fish table game in Georgia
2. Juwa -- especially popular in the Atlanta metro area
3. Game Vault -- preferred by players who want game variety

## Georgia Cities We Serve

- Atlanta -- largest Georgia player base
- Savannah
- Augusta
- Columbus
- Macon
- Albany$t$,
array['fish table games georgia','fire kirin georgia','juwa georgia','sweepstakes georgia'],
true,'2026-06-02'::timestamptz,
'Fish Table Games Online in Georgia -- Fire Kirin, Juwa and More | Win Sweeps',
'Georgia players: access all 12 Win Sweeps fish table games online from Atlanta, Savannah, Augusta or anywhere in GA. 50% first deposit bonus. Account within the hour.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'fish-table-games-california',
'Fish Table Games Online in California -- Play From LA, San Diego and Beyond',
'California players have full access to Win Sweeps 12-game lineup online. Here is how to get started from Los Angeles, San Diego, San Francisco or anywhere in CA.',
$t$## Sweepstakes Fish Table Gaming in California

California is one of the largest markets for online sweepstakes gaming in the United States. Win Sweeps serves players across the entire state -- from Los Angeles and San Diego in the south to San Francisco and Sacramento in the north.

## How California Players Get Started

1. Visit Win Sweeps from any California city
2. Submit your deposit request and choose your game
3. Deposit via CashApp, Zelle or crypto
4. Receive account login via WhatsApp or Telegram within the hour

## Top Games for California Players

- Fire Kirin -- most requested game in Southern California
- Orion Stars -- popular in the Bay Area for its jackpot mechanics
- Game Vault -- all-in-one platform preferred by players who want variety

## California Cities We Serve

Los Angeles, San Diego, San Francisco, San Jose, Fresno, Sacramento, Long Beach, Oakland$t$,
array['fish table games california','fire kirin california','sweepstakes california'],
true,'2026-06-03'::timestamptz,
'Fish Table Games Online in California -- LA, San Diego and Statewide | Win Sweeps',
'California players: all 12 Win Sweeps fish table games available online. Play Fire Kirin, Juwa, Orion Stars from Los Angeles, San Diego, San Francisco or anywhere in CA.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'fish-table-games-north-carolina',
'Fish Table Games Online in North Carolina -- Charlotte, Raleigh and Statewide',
'North Carolina players can play all 12 Win Sweeps games online. Here is how to get started from Charlotte, Raleigh, Durham, Greensboro or anywhere in NC.',
$t$## Fish Table Gaming in North Carolina

North Carolina has seen rapid growth in online sweepstakes gaming. Win Sweeps serves players across the state -- from Charlotte in the west to Raleigh and the Research Triangle in the center, to coastal cities in the east.

## Getting Started in NC

1. Visit Win Sweeps from anywhere in North Carolina
2. Choose your game (Fire Kirin, Juwa, Orion Stars or any of 12 options)
3. Deposit via CashApp or Zelle -- both are instantly confirmed
4. Upload your payment screenshot with the Get Started form
5. Receive your account login via WhatsApp or Telegram within the hour

## Most Popular Games in North Carolina

- Fire Kirin -- top fish table game in Charlotte and Raleigh
- Juwa -- popular for its fast pace in Greensboro and Winston-Salem
- Panda Master -- strong following in eastern NC cities

## NC Cities We Serve

Charlotte, Raleigh, Durham, Greensboro, Winston-Salem, Fayetteville, Cary$t$,
array['fish table games north carolina','fire kirin north carolina','sweepstakes north carolina'],
true,'2026-06-04'::timestamptz,
'Fish Table Games Online in North Carolina -- Charlotte, Raleigh and More | Win Sweeps',
'North Carolina players: play all 12 Win Sweeps fish table games online from Charlotte, Raleigh, Durham or anywhere in NC. 50% first deposit bonus.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'fish-table-games-ohio',
'Fish Table Games Online in Ohio -- Columbus, Cleveland and Statewide',
'Ohio residents can play Fire Kirin, Juwa, Orion Stars and 9 other Win Sweeps games online from Columbus, Cleveland, Cincinnati or anywhere in the state.',
$t$## Fish Table Gaming in Ohio

Ohio has one of the most active sweepstakes gaming communities in the Midwest. Win Sweeps serves Ohio players from Columbus and Cleveland in the north to Cincinnati in the south.

## How Ohio Players Get Started

1. Visit Win Sweeps from any Ohio location
2. Fill out the Get Started form
3. Deposit via CashApp, Zelle or crypto
4. Receive your account credentials via WhatsApp within the hour

## Top Games in Ohio

- Fire Kirin -- most played fish table game in Ohio
- Game Vault -- popular for its slot variety
- Vegas Sweeps -- casino-style slots appeal to Ohio players familiar with nearby casinos

## Ohio Cities We Serve

Columbus, Cleveland, Cincinnati, Toledo, Akron, Dayton, Canton$t$,
array['fish table games ohio','fire kirin ohio','sweepstakes ohio online'],
true,'2026-06-05'::timestamptz,
'Fish Table Games Online in Ohio -- Columbus, Cleveland and Statewide | Win Sweeps',
'Ohio players: access all 12 Win Sweeps fish table games online from Columbus, Cleveland, Cincinnati or anywhere in OH. 50% bonus on first deposit.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'fish-table-games-michigan',
'Fish Table Games Online in Michigan -- Detroit, Grand Rapids and Statewide',
'Michigan players have full access to Win Sweeps 12 sweepstakes games. Play Fire Kirin, Juwa and Orion Stars online from Detroit, Grand Rapids, Lansing or anywhere in MI.',
$t$## Online Fish Table Gaming in Michigan

Michigan players can access all 12 Win Sweeps games online -- no physical fish table location required. The sweepstakes model means players across the entire state, from the Upper Peninsula to the metro Detroit area, can participate.

## Getting Started in Michigan

1. Visit Win Sweeps
2. Choose your game and deposit amount
3. Send via CashApp or Zelle, screenshot the transaction
4. Submit the Get Started form with your screenshot
5. Receive your login details via WhatsApp within the hour

## Popular Games in Michigan

- Fire Kirin -- top choice in metro Detroit
- Orion Stars -- popular in Grand Rapids and Lansing
- Game Vault -- preferred by players who want variety

## Michigan Cities We Serve

Detroit, Grand Rapids, Lansing, Ann Arbor, Flint, Dearborn, Sterling Heights$t$,
array['fish table games michigan','fire kirin michigan','sweepstakes michigan'],
true,'2026-06-06'::timestamptz,
'Fish Table Games Online in Michigan -- Detroit, Grand Rapids and Statewide | Win Sweeps',
'Michigan players: all 12 Win Sweeps fish table games available online from Detroit, Grand Rapids, Lansing or anywhere in MI. Create your account today.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'fish-table-games-new-york',
'Fish Table Games Online in New York -- NYC, Buffalo and Statewide',
'New York players can play all 12 Win Sweeps fish table and sweepstakes games online. Get started from New York City, Buffalo, Rochester or anywhere in NY.',
$t$## Sweepstakes Fish Table Games in New York

New York State has one of the largest online sweepstakes gaming populations in the US. Win Sweeps serves players from New York City in the south to Buffalo and Rochester in the west and north.

## How New York Players Start

1. Visit Win Sweeps from anywhere in New York
2. Submit your deposit request -- choose your game
3. Pay via CashApp, Zelle or crypto
4. Account confirmed via WhatsApp within the hour

## Top Games in New York

- Fire Kirin -- most popular fish table game in NYC
- Game Vault -- slots variety appeals to NYC metro players
- Vegas Sweeps -- casino-style slots for players familiar with Atlantic City

## NY Cities We Serve

New York City (all 5 boroughs), Buffalo, Rochester, Yonkers, Syracuse, Albany$t$,
array['fish table games new york','fish table games nyc','sweepstakes new york'],
true,'2026-06-07'::timestamptz,
'Fish Table Games Online in New York -- NYC, Buffalo and Statewide | Win Sweeps',
'New York players: access all 12 Win Sweeps fish table games from NYC, Buffalo, Rochester or anywhere in NY. 50% first deposit bonus. Setup within the hour.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'fish-table-games-illinois',
'Fish Table Games Online in Illinois -- Chicago, Aurora and Statewide',
'Illinois players can access all 12 Win Sweeps games online. Play Fire Kirin, Juwa, Orion Stars and more from Chicago, Aurora, Rockford or anywhere in IL.',
$t$## Online Fish Table Gaming in Illinois

Illinois, led by the Chicago metro area, has one of the most active fish table gaming communities in the Midwest. Win Sweeps serves players across the entire state.

## Getting Started in Illinois

1. Visit Win Sweeps
2. Fill out the Get Started form -- choose your game
3. Deposit via CashApp, Zelle or crypto
4. We set up your account and confirm via WhatsApp within the hour

## Most Popular Games in Illinois

- Fire Kirin -- top fish table game in Chicago and surrounding suburbs
- Juwa -- popular in Aurora, Joliet and Rockford
- Game Vault -- variety platform preferred by experienced Illinois players

## Illinois Cities We Serve

Chicago, Aurora, Joliet, Rockford, Springfield, Peoria, Elgin$t$,
array['fish table games illinois','fish table games chicago','sweepstakes illinois'],
true,'2026-06-08'::timestamptz,
'Fish Table Games Online in Illinois -- Chicago, Aurora and Statewide | Win Sweeps',
'Illinois players: all 12 Win Sweeps fish table games available online from Chicago, Aurora, Rockford or anywhere in IL. Create your account with a 50% bonus today.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'fish-table-games-pennsylvania',
'Fish Table Games Online in Pennsylvania -- Philadelphia, Pittsburgh and Statewide',
'Pennsylvania players can play all 12 Win Sweeps games online. Get started from Philadelphia, Pittsburgh, Allentown or anywhere in PA with a 50% first deposit bonus.',
$t$## Fish Table Gaming in Pennsylvania

Pennsylvania has one of the most engaged sweepstakes gaming communities on the East Coast. Win Sweeps serves players from Philadelphia in the east to Pittsburgh in the west and everywhere in between.

## How PA Players Get Started

1. Visit Win Sweeps
2. Choose your game and deposit amount
3. Send via CashApp or Zelle -- screenshot the confirmation
4. Submit the Get Started form
5. Receive login details via WhatsApp within the hour

## Top Games in Pennsylvania

- Fire Kirin -- most popular fish table game in Philadelphia and Pittsburgh
- Orion Stars -- strong following in Allentown and Reading
- Game Vault -- popular with Pennsylvania players familiar with casino gaming

## PA Cities We Serve

Philadelphia, Pittsburgh, Allentown, Erie, Reading, Scranton, Bethlehem$t$,
array['fish table games pennsylvania','fish table games philadelphia','sweepstakes pennsylvania'],
true,'2026-06-09'::timestamptz,
'Fish Table Games Online in Pennsylvania -- Philadelphia, Pittsburgh and More | Win Sweeps',
'Pennsylvania players: access all 12 Win Sweeps fish table games from Philadelphia, Pittsburgh or anywhere in PA. 50% first deposit bonus. Account setup within the hour.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'fish-table-games-atlanta-georgia',
'Fish Table Games Online in Atlanta, GA -- Play From Home',
'Atlanta is one of the largest fish table gaming markets in the country. Win Sweeps gives Atlanta players online access to 12 games without visiting a physical location.',
$t$## Fish Table Games in Atlanta, Georgia

Atlanta and the surrounding metro area (Marietta, Decatur, Sandy Springs, Smyrna) have one of the most active fish table gaming communities in the Southeast. Win Sweeps brings all 12 games online -- no physical location required.

## Most Popular Games Among Atlanta Players

1. Fire Kirin -- consistently the number one requested game in Atlanta
2. Juwa -- fast-paced game popular in the downtown Atlanta area
3. Game Vault -- preferred in suburban Atlanta communities
4. Panda Master -- strong following in East Atlanta and Decatur

## How Atlanta Players Get Started

1. Go to Win Sweeps
2. Fill the Get Started form -- enter your game choice and deposit amount
3. Deposit via CashApp (most common in Atlanta) or Zelle
4. Upload your payment screenshot
5. We set up your account and confirm via WhatsApp within the hour

Operating hours: 9 AM-10 PM EST, 7 days a week.$t$,
array['fish table games atlanta','fish table games atlanta georgia','atlanta sweepstakes gaming'],
true,'2026-06-10'::timestamptz,
'Fish Table Games Online in Atlanta, GA -- Play From Home | Win Sweeps',
'Atlanta players: access 12 fish table games online at Win Sweeps. Fire Kirin, Juwa, Game Vault and more. Account setup via WhatsApp within the hour.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'fish-table-games-houston-texas',
'Fish Table Games in Houston, TX -- 12 Games Available Online',
'Houston has one of the largest fish table gaming communities in the US. Here is how Win Sweeps brings Fire Kirin, Juwa and 10 other games to any Houston player online.',
$t$## Why Houston Is a Top Fish Table Market

Houston diverse population and strong entertainment culture have made it one of the largest fish table gaming markets in the United States. Win Sweeps serves players across Greater Houston -- from downtown to Katy, Sugar Land, Pasadena and Pearland.

## Most Popular Games in Houston

1. Fire Kirin -- the number one fish table game in Houston by request volume
2. Juwa -- popular in South Houston and Pasadena communities
3. Mafia -- strong following in the Greater Houston area
4. Game Vault -- all-in-one platform preferred by experienced Houston players

## How Houston Players Create an Account

1. Visit Win Sweeps
2. Submit your request form with game choice, deposit amount and payment screenshot
3. CashApp and Zelle work best for Houston players -- both confirm instantly
4. Receive account login via WhatsApp within the hour

## Houston Area Cities We Serve

Downtown Houston, Katy, Sugar Land, Pasadena, Pearland, Baytown, Missouri City$t$,
array['fish table games houston','fish table games houston texas','houston sweepstakes gaming'],
true,'2026-06-11'::timestamptz,
'Fish Table Games Online in Houston, TX -- Fire Kirin, Juwa and More | Win Sweeps',
'Houston players: 12 fish table games available online at Win Sweeps. Play Fire Kirin, Juwa, Mafia from anywhere in Greater Houston. 50% first deposit bonus.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'fish-table-games-chicago-illinois',
'Fish Table Games in Chicago, IL -- Play Online Citywide',
'Chicago has one of the busiest fish table gaming scenes in the Midwest. Win Sweeps gives Chicago-area players online access to 12 games from any device, any neighborhood.',
$t$## Chicago Fish Table Gaming Online

Chicago fish table community spans the entire metro area -- from the South Side to the North Shore, from the West Loop to the suburbs. Win Sweeps operates online, meaning players in Chicago can access 12 games without visiting a physical location.

## Top Games in Chicago

1. Fire Kirin -- most popular fish table game in Chicago
2. Juwa -- popular on the South and West sides
3. Game Vault -- slots and fish tables popular across Chicago suburbs
4. Orion Stars -- growing audience in the North Shore communities

## Chicago Area Coverage

Win Sweeps serves players in: Chicago (all neighborhoods), Evanston, Cicero, Skokie, Naperville, Aurora, Joliet

## Getting Started in Chicago

1. Visit Win Sweeps
2. Submit your request -- game choice plus payment method plus screenshot
3. CashApp is fastest for Chicago players -- confirms in seconds
4. Account login sent via WhatsApp within the hour$t$,
array['fish table games chicago','fish table games illinois chicago','chicago sweepstakes gaming'],
true,'2026-06-12'::timestamptz,
'Fish Table Games Online in Chicago, IL -- Play Citywide | Win Sweeps',
'Chicago players: access 12 fish table games online at Win Sweeps. Fire Kirin, Juwa and Game Vault available from any Chicago neighborhood or suburb.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'fish-table-games-los-angeles',
'Fish Table Games in Los Angeles, CA -- Play Online From Anywhere in LA',
'Los Angeles has one of the largest fish table gaming communities in California. Win Sweeps brings 12 games online for LA players -- no physical location required.',
$t$## Fish Table Gaming in Los Angeles

Los Angeles and the surrounding metro -- from the San Fernando Valley to Long Beach, from East LA to the Westside -- has a large and growing sweepstakes gaming community. Win Sweeps serves all LA players online.

## Most Requested Games in Los Angeles

1. Fire Kirin -- number one fish table game in LA by request volume
2. Orion Stars -- popular in communities throughout the San Gabriel Valley
3. Game Vault -- variety platform preferred by experienced LA players
4. Juwa -- fast-paced game with a strong following in South LA

## Los Angeles Area Coverage

Downtown LA, East LA, South LA, San Fernando Valley, Long Beach, Compton, Inglewood, Pomona, Pasadena

## Getting Started in Los Angeles

1. Visit Win Sweeps
2. Choose your game and deposit amount
3. Deposit via CashApp or Zelle (both work instantly for LA players)
4. Upload your payment screenshot and submit
5. Receive account details via WhatsApp within the hour$t$,
array['fish table games los angeles','fish table games LA','sweepstakes los angeles'],
true,'2026-06-13'::timestamptz,
'Fish Table Games Online in Los Angeles, CA -- Play From Anywhere in LA | Win Sweeps',
'Los Angeles players: 12 fish table games available online at Win Sweeps. Fire Kirin, Orion Stars, Game Vault from any LA neighborhood. 50% first deposit bonus.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'fish-table-vs-slots-which-is-better',
'Fish Table Games vs Slots -- Which Is Better for You?',
'Fish tables and slots both pay out well but deliver very different experiences. Here is how they compare on skill, speed, payout frequency and bonus rounds.',
$t$## The Core Difference

The fundamental split between fish table games and slots is agency:

- Fish table games: you aim, you fire, your decisions affect outcomes
- Slot games: you set a bet, you spin, the reels determine your return

Neither format is objectively better -- they appeal to different player types.

## Fish Table Games

- Skill element: yes -- aiming and power management matter
- Game speed: medium (you control the pace)
- Bonus rounds: Boss battles and storm events
- Social element: multiplayer rooms

## Slot Games

- Skill element: no -- purely random spin results
- Game speed: fast (instant spin resolution)
- Bonus rounds: free spins and scatter pays
- Jackpot ceiling: progressive jackpots

## Who Should Play Fish Table Games?

- Players who enjoy active participation
- Those who want to feel like skill contributes to outcomes
- Players who enjoy coordinating with others in multiplayer rooms

## Who Should Play Slots?

- Players who want to relax and spin without active engagement
- Those interested in very high jackpot ceilings via progressive slots
- Players who want to try many different game styles quickly

Want both? Game Vault and Mr. All In One both include fish tables and slot sections under one account.$t$,
array['fish table vs slots','fish table or slots','sweepstakes slots vs fish table'],
true,'2026-06-14'::timestamptz,
'Fish Table Games vs Slots -- Which Is Better for You? | Win Sweeps',
'Compare fish table games and slots at Win Sweeps. Learn the differences in skill, speed, variance and payout styles to find the right format for you.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'sweepstakes-games-available-all-states',
'Sweepstakes Fish Table Games Available Nationwide -- All 50 States',
'Win Sweeps operates under the sweepstakes model, which means players in all 50 US states can participate online. Here is what the sweepstakes model means and how it works.',
$t$## Why Sweepstakes Games Work in All 50 States

The sweepstakes model is a legally recognized promotional structure that has operated in the United States for over 50 years -- used by major consumer brands and now gaming platforms like Win Sweeps.

The key structure: there is always a free alternate method of entry alongside any paid option. This separates sweepstakes from gambling under US federal and state law.

## What This Means for Players

- Players in Texas, Florida, Georgia, California, New York and all other states can participate
- No location-based restrictions (unlike licensed casinos)
- No physical visit required -- everything is online
- Payouts via CashApp, Zelle and crypto work the same nationwide

## States With the Largest Win Sweeps Player Bases

1. Texas
2. Florida
3. Georgia
4. California
5. North Carolina
6. Ohio
7. Michigan
8. New York
9. Illinois
10. Pennsylvania

## How to Start From Any State

1. Visit Win Sweeps
2. Submit your deposit request
3. Deposit via CashApp, Zelle or crypto
4. Receive your game account within the hour$t$,
array['sweepstakes games all states','fish table games nationwide','sweepstakes games legal all 50 states'],
true,'2026-06-14 12:00:00'::timestamptz,
'Sweepstakes Fish Table Games Available Nationwide -- All 50 States | Win Sweeps',
'Win Sweeps fish table and sweepstakes games are available to players in all 50 US states. Learn how the sweepstakes model works and how to get started from your state.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'win-sweeps-vs-other-fish-table-platforms',
'Win Sweeps vs Other Fish Table Platforms -- What Makes Us Different',
'With dozens of fish table operators online, what sets Win Sweeps apart? Here is an honest comparison: game selection, support speed, bonus structure and payout reliability.',
$t$## Why Players Choose Win Sweeps

Fish table gaming is competitive. Multiple platforms offer Fire Kirin, Juwa and Orion Stars. Here is what differentiates Win Sweeps:

## 1. Speed of Setup

Most operators take 24-48 hours to create an account. Win Sweeps targets under 1 hour during operating hours (9 AM-10 PM EST). Faster setup = more time playing.

## 2. All 12 Games Under One Operator

Many platforms specialize in 1-3 games. Win Sweeps offers all 12 of the top fish table and sweepstakes titles. One trusted operator, one WhatsApp contact, 12 games.

## 3. Transparent Bonus Structure

At Win Sweeps:
- 50% first deposit bonus -- no hidden requirements
- Reload bonuses scale openly with your reward tier
- Daily rewards are claimed in your dashboard -- no calling to request

## 4. Rewards Program

Win Sweeps has 5 tiers (Silver to Elite) with increasing reload bonuses and daily reward multipliers.

## 5. Multi-Channel Support

Real-time support via WhatsApp, Telegram and Messenger -- the channels you already use.

## 6. Reliable Payouts

Payouts via CashApp, Zelle and crypto are sent promptly after request.$t$,
array['win sweeps review','best fish table platform','win sweeps vs other operators'],
true,'2026-06-15'::timestamptz,
'Win Sweeps vs Other Fish Table Platforms -- What Makes Us Different | Win Sweeps',
'Compare Win Sweeps to other fish table operators. All 12 games, under-1-hour account setup, transparent bonuses, rewards program and reliable payouts.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'fish-table-games-nevada',
'Fish Table Games Online in Nevada -- Play From Las Vegas, Reno and Beyond',
'Nevada players can access all 12 Win Sweeps sweepstakes games online. Get started from Las Vegas, Reno, Henderson or anywhere in NV with a 50% first deposit bonus.',
$t$## Online Fish Table Gaming in Nevada

Nevada is famous for its casino culture, and sweepstakes fish table games bring that entertainment home. Win Sweeps serves players across the entire state -- from Las Vegas and Henderson in the south to Reno and Sparks in the north.

## How Nevada Players Get Started

1. Visit Win Sweeps from anywhere in Nevada
2. Submit your deposit request and choose your game
3. Deposit via CashApp, Zelle or crypto
4. Receive account login via WhatsApp or Telegram within the hour

## Top Games for Nevada Players

- Vegas Sweeps -- casino-style slots that Nevada players love
- Fire Kirin -- most requested fish table game statewide
- Game Vault -- variety platform combining fish tables and slots

## Nevada Cities We Serve

Las Vegas, Henderson, Reno, North Las Vegas, Sparks, Carson City, Boulder City$t$,
array['fish table games nevada','sweepstakes nevada','fire kirin nevada'],
true,'2026-06-15 06:00:00'::timestamptz,
'Fish Table Games Online in Nevada -- Las Vegas, Reno and Statewide | Win Sweeps',
'Nevada players: access all 12 Win Sweeps fish table games online from Las Vegas, Reno or anywhere in NV. 50% first deposit bonus. Account setup within the hour.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

insert into public.blog_posts (slug,title,excerpt,content,tags,is_published,published_at,seo_title,seo_description) values (
'fish-table-games-arizona',
'Fish Table Games Online in Arizona -- Phoenix, Tucson and Statewide',
'Arizona players can play all 12 Win Sweeps games online. Get started from Phoenix, Tucson, Mesa, Scottsdale or anywhere in AZ with a 50% first deposit bonus.',
$t$## Online Fish Table Gaming in Arizona

Arizona has a fast-growing online sweepstakes gaming community. Win Sweeps serves players across the state -- from the greater Phoenix metro to Tucson in the south and Flagstaff in the north.

## How Arizona Players Get Started

1. Visit Win Sweeps from any Arizona city
2. Choose your game and deposit amount
3. Deposit via CashApp or Zelle -- both confirm instantly
4. Upload your payment screenshot and submit the Get Started form
5. Receive your account credentials via WhatsApp within the hour

## Top Games for Arizona Players

- Fire Kirin -- most popular fish table game in the Phoenix metro
- Orion Stars -- strong following in Tucson
- Vegas Sweeps -- popular with Arizona players who enjoy casino-style gaming

## Arizona Cities We Serve

Phoenix, Tucson, Mesa, Chandler, Scottsdale, Glendale, Gilbert, Tempe, Peoria, Surprise$t$,
array['fish table games arizona','sweepstakes arizona','fire kirin arizona'],
true,'2026-06-15 12:00:00'::timestamptz,
'Fish Table Games Online in Arizona -- Phoenix, Tucson and Statewide | Win Sweeps',
'Arizona players: all 12 Win Sweeps fish table games available online from Phoenix, Tucson, Mesa or anywhere in AZ. 50% first deposit bonus. Account setup within the hour.'
) on conflict (slug) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,tags=excluded.tags,is_published=excluded.is_published,seo_title=excluded.seo_title,seo_description=excluded.seo_description;

end;
$wrap$;

-- ==========================================
-- MIGRATION: 20260616000070_ticket_messages_realtime.sql
-- ==========================================

-- Enable Supabase Realtime for ticket_messages so the chat UI receives
-- live INSERT events without polling or page refresh.
alter publication supabase_realtime add table public.ticket_messages;

-- ==========================================
-- MIGRATION: 20260617000080_game_accounts.sql
-- ==========================================

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

-- ==========================================
-- MIGRATION: 20260617000081_game_server_api_creds.sql
-- ==========================================

-- Extend game_server_configs with outbound API credentials for automated provisioning.
-- api_username / api_password are the store owner's agent portal login.
-- api_session / api_session_expires_at cache the auth token to avoid re-login on every call.
alter table public.game_server_configs
  add column if not exists api_username          text,
  add column if not exists api_password          text,
  add column if not exists api_session           text,
  add column if not exists api_session_expires_at timestamptz;

-- ==========================================
-- MIGRATION: 20260617000082_payment_proofs_bucket.sql
-- ==========================================

-- Create the private "payment-proofs" storage bucket.
--
-- Migration 0020 only left a comment telling the operator to create this bucket
-- by hand in the Supabase dashboard, which was never done — so every deposit /
-- new-account request failed at the image-upload step and the request was never
-- saved (nothing reached /admin/requests). This creates the bucket properly.
--
-- It is PRIVATE: payment screenshots are sensitive. All uploads and reads go
-- through the service-role admin client (src/lib/actions/request.ts uploads;
-- /admin/requests generates short-lived signed URLs), which bypasses RLS, so no
-- storage.objects policies are required for this bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('payment-proofs', 'payment-proofs', false, 8388608,
   array['image/png','image/jpeg','image/webp','image/heic'])
on conflict (id) do nothing;

-- ==========================================
-- MIGRATION: 20260617000083_game_provision_jobs.sql
-- ==========================================

-- Job queue that connects WinSweeps fulfillment to the local Game Vault worker.
--
-- When an admin marks a request "fulfilled" for a game whose automation is
-- enabled, a row is enqueued here. The local Playwright worker (tools/
-- game-vault-worker) polls /api/worker/jobs/next, drives the game portal, and
-- reports back to /api/worker/jobs/result — which updates game_accounts and
-- notifies the player.
--
-- RLS is enabled with NO policies: all access is via the service-role admin
-- client (the worker API routes), never directly from the browser.

create table public.game_provision_jobs (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid references public.requests(id) on delete set null,
  user_id       uuid references auth.users(id)     on delete set null,
  game_id       uuid references public.games(id)   not null,
  kind          text not null check (kind in ('create', 'recharge')),
  game_username text not null,
  game_password text,                 -- only set for 'create' jobs
  amount        numeric not null default 0,
  status        text not null default 'queued'
                  check (status in ('queued', 'processing', 'done', 'failed')),
  attempts      integer not null default 0,
  result        jsonb,
  error         text,
  locked_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.game_provision_jobs enable row level security;

create index game_provision_jobs_status_idx
  on public.game_provision_jobs (status, created_at);

-- ==========================================
-- MIGRATION: 20260617000084_wallet.sql
-- ==========================================

-- Real-money WALLET: deposits credit it (admin-verified); players spend it to
-- load game credits via the bot. Kept separate from reward coins/XP, and moved
-- ONLY through SECURITY DEFINER functions — same lockdown pattern as grant_coins.

-- 1. Balance column on profiles
alter table public.profiles
  add column if not exists wallet_balance numeric not null default 0
    check (wallet_balance >= 0);

-- 2. Lock wallet_balance so clients can't write it directly. Re-create the
--    profile-protection trigger function with wallet_balance added to the list.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or public.is_admin() then
    return new;
  end if;

  if new.xp               is distinct from old.xp
     or new.level            is distinct from old.level
     or new.coins_balance    is distinct from old.coins_balance
     or new.lifetime_coins   is distinct from old.lifetime_coins
     or new.current_streak   is distinct from old.current_streak
     or new.longest_streak   is distinct from old.longest_streak
     or new.last_daily_claim is distinct from old.last_daily_claim
     or new.referral_code    is distinct from old.referral_code
     or new.referred_by      is distinct from old.referred_by
     or new.is_banned        is distinct from old.is_banned
     or new.banned_reason    is distinct from old.banned_reason
     or new.banned_at        is distinct from old.banned_at
     or new.banned_by        is distinct from old.banned_by
     or new.wallet_balance   is distinct from old.wallet_balance
  then
    raise exception 'column protected' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- 3. Append-only wallet ledger
create table public.wallet_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  amount        numeric not null,            -- + credit, - debit
  balance_after numeric not null,
  kind          text not null check (kind in ('deposit','game_load','refund','adjustment')),
  description   text,
  ref_id        uuid,
  created_at    timestamptz not null default now()
);

alter table public.wallet_ledger enable row level security;

create policy "users read own wallet ledger"
  on public.wallet_ledger for select
  using (user_id = auth.uid());

create index wallet_ledger_user_idx on public.wallet_ledger (user_id, created_at desc);

create or replace function public.block_wallet_ledger_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'wallet_ledger is append-only';
end;
$$;

create trigger trg_wallet_ledger_no_update before update on public.wallet_ledger
  for each row execute function public.block_wallet_ledger_mutation();
create trigger trg_wallet_ledger_no_delete before delete on public.wallet_ledger
  for each row execute function public.block_wallet_ledger_mutation();

-- 4. Money-movement functions (the only safe way to change wallet_balance)
create or replace function public.credit_wallet(
  p_user uuid, p_amount numeric, p_kind text,
  p_desc text default null, p_ref uuid default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare new_balance numeric;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  update public.profiles set wallet_balance = wallet_balance + p_amount
    where id = p_user
    returning wallet_balance into new_balance;
  if new_balance is null then raise exception 'user not found'; end if;
  insert into public.wallet_ledger (user_id, amount, balance_after, kind, description, ref_id)
    values (p_user, p_amount, new_balance, p_kind, p_desc, p_ref);
  return new_balance;
end;
$$;

-- Atomic debit: the WHERE clause prevents overspend / double-spend on races.
create or replace function public.debit_wallet(
  p_user uuid, p_amount numeric, p_kind text,
  p_desc text default null, p_ref uuid default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare new_balance numeric;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  update public.profiles set wallet_balance = wallet_balance - p_amount
    where id = p_user and wallet_balance >= p_amount
    returning wallet_balance into new_balance;
  if new_balance is null then
    raise exception 'insufficient funds' using errcode = 'P0001';
  end if;
  insert into public.wallet_ledger (user_id, amount, balance_after, kind, description, ref_id)
    values (p_user, -p_amount, new_balance, p_kind, p_desc, p_ref);
  return new_balance;
end;
$$;

revoke execute on function public.credit_wallet(uuid,numeric,text,text,uuid) from public, anon, authenticated;
revoke execute on function public.debit_wallet(uuid,numeric,text,text,uuid)  from public, anon, authenticated;
grant  execute on function public.credit_wallet(uuid,numeric,text,text,uuid) to service_role;
grant  execute on function public.debit_wallet(uuid,numeric,text,text,uuid)  to service_role;

-- 5. Allow a 'deposit' request type (wallet top-up — no game needed)
alter table public.requests drop constraint if exists requests_request_type_check;
alter table public.requests add constraint requests_request_type_check
  check (request_type in ('new_account','reload','deposit'));

-- ==========================================
-- MIGRATION: 20260617000085_game_load_requests.sql
-- ==========================================

-- Spinora-style unified game job queue + redeem/cashout, adapted to WinSweeps.
-- Replaces the create/recharge-only game_provision_jobs model with one
-- game_load_requests table covering new_account / reload / redeem / check_balance,
-- claimed by the local bots via RPC and finalized with wallet moves in SQL.

-- ── 1. Cashout wallet + ledger wallet_type ──────────────────────────────────
alter table public.profiles
  add column if not exists cashout_wallet numeric not null default 0 check (cashout_wallet >= 0);

alter table public.wallet_ledger
  add column if not exists wallet_type text not null default 'current'
    check (wallet_type in ('current', 'cashout'));

alter table public.wallet_ledger drop constraint if exists wallet_ledger_kind_check;
alter table public.wallet_ledger add constraint wallet_ledger_kind_check
  check (kind in ('deposit','game_load','game_redeem','refund','adjustment'));

-- ── 2. Allow wallet balance changes from our SECURITY DEFINER money functions ─
-- They set a transaction-local GUC the trigger trusts (in addition to
-- service_role / admin). Authenticated clients can't set this GUC via PostgREST,
-- so only our own functions open the gate.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or current_setting('app.wallet_update', true) = 'true'
     or public.is_admin() then
    return new;
  end if;

  if new.xp               is distinct from old.xp
     or new.level            is distinct from old.level
     or new.coins_balance    is distinct from old.coins_balance
     or new.lifetime_coins   is distinct from old.lifetime_coins
     or new.current_streak   is distinct from old.current_streak
     or new.longest_streak   is distinct from old.longest_streak
     or new.last_daily_claim is distinct from old.last_daily_claim
     or new.referral_code    is distinct from old.referral_code
     or new.referred_by      is distinct from old.referred_by
     or new.is_banned        is distinct from old.is_banned
     or new.banned_reason    is distinct from old.banned_reason
     or new.banned_at        is distinct from old.banned_at
     or new.banned_by        is distinct from old.banned_by
     or new.wallet_balance   is distinct from old.wallet_balance
     or new.cashout_wallet   is distinct from old.cashout_wallet
  then
    raise exception 'column protected' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ── 3. Job table ────────────────────────────────────────────────────────────
create table public.game_load_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  game_slug     text not null,
  game_name     text not null,
  amount        numeric not null default 0 check (amount >= 0),
  wallet_type   text not null default 'current' check (wallet_type in ('current','cashout')),
  load_type     text not null check (load_type in ('new_account','reload','redeem','check_balance')),
  game_username text,
  game_password text,
  redeem_all    boolean not null default false,
  status        text not null default 'pending'
                  check (status in ('pending','processing','completed','failed','cancelled')),
  error_message text,
  bot_attempts  integer not null default 0,
  wallet_refunded boolean not null default false,
  admin_notes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index game_load_requests_user_idx   on public.game_load_requests(user_id, created_at desc);
create index game_load_requests_status_idx on public.game_load_requests(game_slug, status, created_at);

alter table public.game_load_requests enable row level security;

create policy "users read own game load requests"
  on public.game_load_requests for select
  using (user_id = auth.uid() or public.is_staff());

-- inserts only via request_* RPCs; no direct client insert
create policy "no direct insert game load requests"
  on public.game_load_requests for insert with check (false);

create policy "staff update game load requests"
  on public.game_load_requests for update using (public.is_staff());

alter publication supabase_realtime add table public.game_load_requests;

-- ── 4. Helpers ──────────────────────────────────────────────────────────────
create or replace function public.game_id_for_slug(p_slug text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.games where slug = p_slug limit 1;
$$;

-- ── 5. User-initiated requests (atomic wallet debit for loads) ───────────────
create or replace function public.request_game_load(
  p_game_slug text,
  p_game_name text,
  p_amount    numeric,
  p_load_type text,
  p_game_username text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_balance numeric;
  v_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_load_type not in ('new_account','reload') then raise exception 'Invalid load type'; end if;
  if p_load_type = 'reload' then
    if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
    if p_game_username is null or trim(p_game_username) = '' then
      raise exception 'Game username required for reload';
    end if;
  end if;

  if exists (
    select 1 from public.game_load_requests
    where user_id = v_user and game_slug = p_game_slug and status in ('pending','processing')
  ) then
    raise exception 'A request is already in progress for this game';
  end if;

  if p_load_type = 'reload' then
    perform set_config('app.wallet_update', 'true', true);
    select wallet_balance into v_balance from public.profiles where id = v_user for update;
    if v_balance is null or v_balance < p_amount then
      raise exception 'Insufficient wallet balance';
    end if;
    update public.profiles set wallet_balance = wallet_balance - p_amount where id = v_user
      returning wallet_balance into v_balance;
    insert into public.wallet_ledger (user_id, amount, balance_after, kind, wallet_type, description)
      values (v_user, -p_amount, v_balance, 'game_load', 'current',
              format('Load $%s to %s', p_amount, p_game_name));
  end if;

  insert into public.game_load_requests (user_id, game_slug, game_name, amount, wallet_type, load_type, game_username, status)
    values (v_user, p_game_slug, p_game_name, coalesce(p_amount,0), 'current', p_load_type,
            nullif(trim(p_game_username), ''), 'pending')
    returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.request_game_load(text, text, numeric, text, text) to authenticated;

create or replace function public.request_game_redeem(
  p_game_slug text,
  p_game_name text,
  p_amount    numeric,
  p_game_username text,
  p_redeem_all boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_game_username is null or trim(p_game_username) = '' then
    raise exception 'Game username required for redeem';
  end if;
  if not p_redeem_all and (p_amount is null or p_amount <= 0) then
    raise exception 'Amount must be positive';
  end if;
  if exists (
    select 1 from public.game_load_requests
    where user_id = v_user and game_slug = p_game_slug and status in ('pending','processing')
  ) then
    raise exception 'A request is already in progress for this game';
  end if;

  insert into public.game_load_requests (user_id, game_slug, game_name, amount, wallet_type, load_type, game_username, redeem_all, status)
    values (v_user, p_game_slug, p_game_name, case when p_redeem_all then 0 else p_amount end,
            'current', 'redeem', nullif(trim(p_game_username), ''), p_redeem_all, 'pending')
    returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.request_game_redeem(text, text, numeric, text, boolean) to authenticated;

-- ── 6. Bot claim (service role) ─────────────────────────────────────────────
create or replace function public.claim_next_game_load(p_game_slug text)
returns setof public.game_load_requests
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.game_load_requests;
begin
  select * into v_row from public.game_load_requests
  where game_slug = p_game_slug and status = 'pending'
  order by created_at asc limit 1 for update skip locked;
  if v_row.id is null then return; end if;
  update public.game_load_requests
    set status = 'processing', bot_attempts = bot_attempts + 1, updated_at = now()
    where id = v_row.id returning * into v_row;
  return next v_row;
end;
$$;

grant execute on function public.claim_next_game_load(text) to service_role;

-- ── 7. Refund a failed load ─────────────────────────────────────────────────
create or replace function public.refund_game_load_wallet(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.game_load_requests; v_bal numeric;
begin
  select * into v_row from public.game_load_requests where id = p_request_id for update;
  if v_row.id is null or v_row.wallet_refunded then return; end if;
  if v_row.load_type <> 'reload' or coalesce(v_row.amount,0) <= 0 then return; end if;

  perform set_config('app.wallet_update', 'true', true);
  update public.profiles set wallet_balance = wallet_balance + v_row.amount where id = v_row.user_id
    returning wallet_balance into v_bal;
  insert into public.wallet_ledger (user_id, amount, balance_after, kind, wallet_type, description)
    values (v_row.user_id, v_row.amount, v_bal, 'refund', 'current',
            format('Refund failed load $%s to %s', v_row.amount, v_row.game_name));
  update public.game_load_requests set wallet_refunded = true, updated_at = now() where id = p_request_id;
end;
$$;

grant execute on function public.refund_game_load_wallet(uuid) to service_role;

-- ── 8. Bot completion (service role) — wallet + game_accounts updates ────────
create or replace function public.complete_game_load(
  p_request_id uuid,
  p_success boolean,
  p_game_username text default null,
  p_game_password text default null,
  p_error_message text default null,
  p_redeemed_amount numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.game_load_requests;
  v_game_id uuid;
  v_credit numeric;
  v_bal numeric;
  v_now timestamptz := now();
begin
  select * into v_row from public.game_load_requests
  where id = p_request_id and status in ('pending','processing') for update;
  if v_row.id is null then return; end if;

  v_game_id := public.game_id_for_slug(v_row.game_slug);

  if not p_success and v_row.load_type = 'reload' then
    perform public.refund_game_load_wallet(p_request_id);
  end if;

  if p_success then
    if v_row.load_type = 'new_account' and v_game_id is not null then
      insert into public.game_accounts (user_id, game_id, game_username, credits_balance, last_synced_at, updated_at)
        values (v_row.user_id, v_game_id, coalesce(p_game_username, v_row.game_username, 'player'), 0, v_now, v_now)
        on conflict (user_id, game_id) do update
          set game_username = excluded.game_username, updated_at = v_now;

    elsif v_row.load_type = 'reload' and v_game_id is not null then
      update public.game_accounts
        set credits_balance = credits_balance + v_row.amount, last_synced_at = v_now, updated_at = v_now
        where user_id = v_row.user_id and game_id = v_game_id;

    elsif v_row.load_type = 'redeem' then
      v_credit := coalesce(p_redeemed_amount, nullif(v_row.amount, 0));
      if v_credit is null or v_credit <= 0 then raise exception 'Redeem requires a positive amount'; end if;
      perform set_config('app.wallet_update', 'true', true);
      update public.profiles set cashout_wallet = cashout_wallet + v_credit where id = v_row.user_id
        returning cashout_wallet into v_bal;
      insert into public.wallet_ledger (user_id, amount, balance_after, kind, wallet_type, description)
        values (v_row.user_id, v_credit, v_bal, 'game_redeem', 'cashout',
                format('Redeem $%s from %s', v_credit, v_row.game_name));
      if v_game_id is not null then
        update public.game_accounts
          set credits_balance = greatest(0, credits_balance - v_credit), last_synced_at = v_now, updated_at = v_now
          where user_id = v_row.user_id and game_id = v_game_id;
      end if;

    elsif v_row.load_type = 'check_balance' and v_game_id is not null and p_redeemed_amount is not null then
      update public.game_accounts
        set credits_balance = p_redeemed_amount, last_synced_at = v_now, updated_at = v_now
        where user_id = v_row.user_id and game_id = v_game_id;
    end if;
  end if;

  update public.game_load_requests set
    status = case when p_success then 'completed' else 'failed' end,
    game_username = coalesce(p_game_username, game_username),
    game_password = coalesce(p_game_password, game_password),
    amount = case when p_success and v_row.load_type = 'redeem' then coalesce(p_redeemed_amount, amount) else amount end,
    error_message = p_error_message,
    completed_at = case when p_success then v_now else completed_at end,
    updated_at = v_now
  where id = p_request_id;
end;
$$;

grant execute on function public.complete_game_load(uuid, boolean, text, text, text, numeric) to service_role;

-- ── 9. Stale recovery + user cancel ─────────────────────────────────────────
create or replace function public.cancel_my_game_load(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.game_load_requests;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.game_load_requests
    where id = p_request_id and user_id = auth.uid() and status in ('pending','processing') for update;
  if v_row.id is null then raise exception 'Request not found or already finished'; end if;
  if v_row.load_type = 'reload' then perform public.refund_game_load_wallet(p_request_id); end if;
  update public.game_load_requests
    set status = 'cancelled',
        error_message = coalesce(nullif(trim(error_message), ''), 'Cancelled — you can start a new request.'),
        updated_at = now()
    where id = p_request_id;
end;
$$;

grant execute on function public.cancel_my_game_load(uuid) to authenticated;

-- ==========================================
-- MIGRATION: 20260617000086_game_check_balance_stale.sql
-- ==========================================

-- Stage 2 support: check-balance request + stale-job recovery for game pages.

-- Queue a balance-check job (no wallet movement).
create or replace function public.request_game_check_balance(
  p_game_slug text,
  p_game_name text,
  p_game_username text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_game_username is null or trim(p_game_username) = '' then
    raise exception 'Create your game account first';
  end if;
  if exists (
    select 1 from public.game_load_requests
    where user_id = v_user and game_slug = p_game_slug and status in ('pending','processing')
  ) then
    raise exception 'A request is already in progress for this game';
  end if;

  insert into public.game_load_requests (user_id, game_slug, game_name, amount, wallet_type, load_type, game_username, status)
    values (v_user, p_game_slug, p_game_name, 0, 'current', 'check_balance', nullif(trim(p_game_username), ''), 'pending')
    returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.request_game_check_balance(text, text, text) to authenticated;

-- Fail jobs stuck in pending/processing past the threshold (refunds loads).
create or replace function public.fail_stale_game_loads(
  p_stale_minutes integer default 15,
  p_user_id uuid default null,
  p_game_slug text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer := 0; v_row public.game_load_requests;
begin
  for v_row in
    select * from public.game_load_requests
    where status in ('pending','processing')
      and updated_at < now() - make_interval(mins => greatest(p_stale_minutes, 5))
      and (p_user_id is null or user_id = p_user_id)
      and (p_game_slug is null or game_slug = p_game_slug)
    for update
  loop
    if v_row.load_type = 'reload' then
      perform public.refund_game_load_wallet(v_row.id);
    end if;
    update public.game_load_requests
      set status = 'failed',
          error_message = coalesce(nullif(trim(error_message), ''),
            'Timed out waiting for the game bot. Restart the bot on your PC, then try again.'),
          updated_at = now()
      where id = v_row.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.fail_stale_game_loads(integer, uuid, text) to authenticated, service_role;

-- ==========================================
-- MIGRATION: 20260617000087_cashout_payout.sql
-- ==========================================

-- Cash-out payouts: admin records that a player's redeemed (cash-out) balance
-- has been paid out off-platform (CashApp/Zelle/crypto). Atomically debits
-- cashout_wallet and appends an append-only ledger row. Service-role only —
-- called from the admin client after an authorize("requests.manage") check.

-- Allow the 'payout' ledger kind.
alter table public.wallet_ledger drop constraint if exists wallet_ledger_kind_check;
alter table public.wallet_ledger add constraint wallet_ledger_kind_check
  check (kind in ('deposit','game_load','game_redeem','refund','adjustment','payout'));

create or replace function public.admin_payout_cashout(
  p_user uuid,
  p_amount numeric,
  p_note text default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare v_bal numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payout amount must be positive';
  end if;

  -- Permit the protected-column write for this transaction (see protect_profile_columns).
  perform set_config('app.wallet_update', 'true', true);

  update public.profiles
    set cashout_wallet = cashout_wallet - p_amount
    where id = p_user and cashout_wallet >= p_amount
    returning cashout_wallet into v_bal;

  if not found then
    raise exception 'Insufficient cash-out balance';
  end if;

  insert into public.wallet_ledger (user_id, amount, balance_after, kind, wallet_type, description)
    values (p_user, -p_amount, v_bal, 'payout', 'cashout',
            coalesce(nullif(trim(p_note), ''), 'Cash-out payout'));

  return v_bal;
end;
$$;

revoke all on function public.admin_payout_cashout(uuid, numeric, text) from public;
grant execute on function public.admin_payout_cashout(uuid, numeric, text) to service_role;

-- ==========================================
-- MIGRATION: 20260617000088_ticket_messages_write_fix.sql
-- ==========================================

-- Fix: members (and staff using the customer Messages flow) could not post.
-- The old insert policy required `is_staff = has_permission('support.manage')`,
-- so a staff/admin account posting a member message (is_staff=false) evaluated
-- `false = true` and was blocked. Relax to allow is_staff=false for anyone, and
-- is_staff=true only for users with support.manage (spoofing still blocked).

drop policy if exists "ticket messages participants write" on public.ticket_messages;

create policy "ticket messages participants write" on public.ticket_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and t.status <> 'closed'
        and (t.user_id = auth.uid() or public.has_permission('support.manage'))
    )
    and (is_staff = false or public.has_permission('support.manage'))
  );

-- ==========================================
-- MIGRATION: 20260617000089_wallet_fns_bypass_guard.sql
-- ==========================================

-- Fix: deposits/loads failed to move wallet_balance ("crediting the wallet
-- failed" / "column protected"). credit_wallet/debit_wallet relied on the
-- protect_profile_columns trigger recognizing service_role via
-- current_setting('request.jwt.claim.role') — which current PostgREST often
-- leaves empty inside a SECURITY DEFINER RPC, so the wallet_balance write was
-- blocked. complete_game_load / admin_payout_cashout already dodge this by
-- setting the app.wallet_update flag the trigger honors. Do the same here.

create or replace function public.credit_wallet(
  p_user uuid, p_amount numeric, p_kind text,
  p_desc text default null, p_ref uuid default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare new_balance numeric;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  perform set_config('app.wallet_update', 'true', true);
  update public.profiles set wallet_balance = wallet_balance + p_amount
    where id = p_user
    returning wallet_balance into new_balance;
  if new_balance is null then raise exception 'user not found'; end if;
  insert into public.wallet_ledger (user_id, amount, balance_after, kind, wallet_type, description, ref_id)
    values (p_user, p_amount, new_balance, p_kind, 'current', p_desc, p_ref);
  return new_balance;
end;
$$;

create or replace function public.debit_wallet(
  p_user uuid, p_amount numeric, p_kind text,
  p_desc text default null, p_ref uuid default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare new_balance numeric;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  perform set_config('app.wallet_update', 'true', true);
  update public.profiles set wallet_balance = wallet_balance - p_amount
    where id = p_user and wallet_balance >= p_amount
    returning wallet_balance into new_balance;
  if new_balance is null then
    raise exception 'insufficient funds' using errcode = 'P0001';
  end if;
  insert into public.wallet_ledger (user_id, amount, balance_after, kind, wallet_type, description, ref_id)
    values (p_user, -p_amount, new_balance, p_kind, 'current', p_desc, p_ref);
  return new_balance;
end;
$$;

revoke execute on function public.credit_wallet(uuid,numeric,text,text,uuid) from public, anon, authenticated;
revoke execute on function public.debit_wallet(uuid,numeric,text,text,uuid)  from public, anon, authenticated;
grant  execute on function public.credit_wallet(uuid,numeric,text,text,uuid) to service_role;
grant  execute on function public.debit_wallet(uuid,numeric,text,text,uuid)  to service_role;

-- ==========================================
-- MIGRATION: 20260624000090_fix_handle_new_user_referral.sql
-- ==========================================

-- Fix: signup with a referral code failed with "Database error saving new user".
--
-- Cause: handle_new_user() set the referrer via a separate
--   UPDATE public.profiles SET referred_by = ...
-- That UPDATE fires trg_profiles_protect (protect_profile_columns), which guards
-- `referred_by`. During GoTrue signup none of the bypass conditions
-- (service_role / app.wallet_update / is_admin) are true, so the trigger raised
-- 'column protected' and the whole signup transaction aborted. Signups WITHOUT a
-- referral code were unaffected (no UPDATE ran).
--
-- Fix: resolve the referrer BEFORE inserting the profile and set `referred_by`
-- in the INSERT itself. trg_profiles_protect is BEFORE UPDATE only, so the
-- INSERT is allowed. The referrals row is inserted after the profile exists.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_username citext;
  suffix int := 0;
  final_username citext;
  ref_code text;
  referrer public.profiles%rowtype;
  has_referrer boolean := false;
  customer_role_id uuid;
begin
  desired_username := coalesce(
    nullif(regexp_replace(new.raw_user_meta_data ->> 'username', '[^A-Za-z0-9_]', '', 'g'), ''),
    split_part(new.email, '@', 1)
  );
  desired_username := substr(desired_username, 1, 20);
  if char_length(desired_username) < 3 then
    desired_username := 'player' || substr(new.id::text, 1, 6);
  end if;

  final_username := desired_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := substr(desired_username, 1, 20 - char_length(suffix::text)) || suffix;
  end loop;

  -- Resolve referrer first so we can set referred_by in the INSERT (avoids a
  -- protected-column UPDATE that trg_profiles_protect would reject).
  ref_code := upper(nullif(new.raw_user_meta_data ->> 'referral_code', ''));
  if ref_code is not null then
    select * into referrer from public.profiles where referral_code = ref_code;
    if found and referrer.id <> new.id then
      has_referrer := true;
    end if;
  end if;

  insert into public.profiles (id, username, display_name, referral_code, referred_by)
  values (
    new.id,
    final_username,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    public.generate_referral_code(),
    case when has_referrer then referrer.id else null end
  );

  -- default role: customer
  select id into customer_role_id from public.roles where key = 'customer';
  if customer_role_id is not null then
    insert into public.user_roles (user_id, role_id) values (new.id, customer_role_id)
    on conflict do nothing;
  end if;

  -- referral intake row (profile now exists, satisfies the FK)
  if has_referrer then
    insert into public.referrals (referrer_id, referred_id, code_used)
    values (referrer.id, new.id, ref_code)
    on conflict do nothing;
  end if;

  insert into public.notification_preferences (user_id) values (new.id)
  on conflict do nothing;

  return new;
end;
$$;

-- ==========================================
-- MIGRATION: 20260624000091_grant_fns_bypass_guard.sql
-- ==========================================

-- Fix: "Could not save your profile" on complete-profile, and (more broadly)
-- any coin/XP grant made from inside an authenticated SECURITY DEFINER RPC.
--
-- Cause: grant_coins() / grant_xp() update the protected columns coins_balance,
-- lifetime_coins and xp. protect_profile_columns only bypasses when it sees
-- service_role via current_setting('request.jwt.claim.role') — which current
-- PostgREST leaves EMPTY inside a SECURITY DEFINER RPC. So when complete_my_profile
-- → trg_profiles_completion → evaluate_achievements / qualify_referral →
-- grant_coins/grant_xp ran, the protected write raised 'column protected' and the
-- whole transaction aborted. This is the same failure migration 0089 fixed for
-- credit_wallet/debit_wallet by setting the app.wallet_update flag the trigger
-- honors. Apply the same bypass to the coin/XP grant functions. This also
-- unblocks daily/weekly/streak/referral/achievement rewards on PostgREST builds
-- that drop the role GUC inside definer RPCs.

create or replace function public.grant_coins(
  target_user uuid,
  amount bigint,
  entry_type public.ledger_entry_type,
  ref_type text default null,
  ref_id uuid default null,
  note text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance bigint;
begin
  if amount = 0 then
    select coins_balance into new_balance from public.profiles where id = target_user;
    return new_balance;
  end if;

  -- Trusted system credit — allow the protected-column write (see 0089).
  perform set_config('app.wallet_update', 'true', true);

  update public.profiles
     set coins_balance  = coins_balance + amount,
         lifetime_coins = lifetime_coins + greatest(amount, 0)
   where id = target_user
   returning coins_balance into new_balance;

  if not found then
    raise exception 'profile % not found', target_user;
  end if;

  insert into public.ledger_entries
    (user_id, currency, amount, balance_after, entry_type, reference_type, reference_id, description)
  values
    (target_user, 'coins', amount, new_balance, entry_type, ref_type, ref_id, note);

  return new_balance;
end;
$$;

create or replace function public.grant_xp(
  target_user uuid,
  amount bigint,
  entry_type public.ledger_entry_type,
  ref_type text default null,
  ref_id uuid default null,
  note text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total bigint;
  old_level int;
  new_level int;
begin
  if amount <= 0 then
    select xp into new_total from public.profiles where id = target_user;
    return new_total;
  end if;

  select level into old_level from public.profiles where id = target_user;

  -- Trusted system credit — allow the protected-column write (see 0089).
  perform set_config('app.wallet_update', 'true', true);

  update public.profiles
     set xp = xp + amount
   where id = target_user
   returning xp, level into new_total, new_level;

  if not found then
    raise exception 'profile % not found', target_user;
  end if;

  insert into public.ledger_entries
    (user_id, currency, amount, balance_after, entry_type, reference_type, reference_id, description)
  values
    (target_user, 'xp', amount, new_total, entry_type, ref_type, ref_id, note);

  -- side-effects of leveling: VIP tier re-check + notification
  if new_level > old_level then
    perform public.evaluate_vip_tier(target_user);
    insert into public.notifications (user_id, type, title, body, link_url)
    values (
      target_user, 'reward',
      'Level up!',
      format('You reached level %s. Keep the streak alive.', new_level),
      '/dashboard/rewards'
    );
  end if;

  return new_total;
end;
$$;

-- ==========================================
-- MIGRATION: 20260624000092_payment_methods.sql
-- ==========================================

-- Admin-managed deposit payment methods (Spinora-style switcher): each method
-- has a label, an account handle/address (+ its label), an optional pay link,
-- and an optional QR image. The public deposit page renders active methods and
-- swaps the QR/handle/link when a method is selected. Deposits are still
-- submitted + approved in /admin and credited to the wallet (unchanged).

create table if not exists public.payment_methods (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,                       -- 'cashapp','usdt',…
  label        text not null,                              -- 'Cash App'
  kind         text not null default 'handle'
                 check (kind in ('handle', 'crypto', 'link')),
  handle       text,                                       -- $tag / address / email
  handle_label text,                                       -- 'Cashtag', 'USDT address (ERC-20)'
  pay_link     text,                                       -- https://cash.app/$tag
  qr_image_url text,                                       -- public URL (cms-media bucket)
  instructions text,                                       -- optional note under the method
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id) on delete set null
);

alter table public.payment_methods enable row level security;

-- Players (anon + authenticated) can read ACTIVE methods to make a deposit.
create policy "payment methods public read"
  on public.payment_methods for select
  using (is_active = true);
-- Writes are service-role only (admin actions use the service-role client).

create index payment_methods_order_idx on public.payment_methods (sort_order, label);

-- Seed sensible defaults (admin edits handles / links / QR images afterwards).
insert into public.payment_methods (key, label, kind, handle_label, handle, pay_link, sort_order) values
  ('cashapp', 'Cash App', 'handle', 'Cashtag',               '$YourCashtag',  'https://cash.app/$YourCashtag', 1),
  ('chime',   'Chime',    'handle', 'Chime $ChimeSign',       '$YourChimeSign', null,                          2),
  ('paypal',  'PayPal',   'handle', 'PayPal',                 'you@email.com', 'https://paypal.me/you',        3),
  ('venmo',   'Venmo',    'handle', 'Venmo',                  '@YourVenmo',    'https://venmo.com/u/YourVenmo', 4),
  ('bitcoin', 'Bitcoin',  'crypto', 'Bitcoin address',        'bc1youraddress', null,                         5),
  ('usdt',    'USDT',     'crypto', 'USDT address (ERC-20)',  '0xYourAddress', null,                          6)
on conflict (key) do nothing;

-- ==========================================
-- MIGRATION: 20260630000093_geo_cms.sql
-- ==========================================

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

-- ==========================================
-- MIGRATION: 20260630000094_blog_how_to_win_seed.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0094 · Blog seed: 3 flagship "how to win" guides
-- ============================================================================
-- Content-only seed, kept separate from the 0093 geo schema migration so a
-- schema rollback never also rolls back blog content (and vice versa).

insert into public.blog_posts (slug, title, excerpt, content, tags, is_published, published_at, seo_title, seo_description) values

('how-to-win-at-fire-kirin',
 'How to Win at Fire Kirin — Strategies That Actually Work',
 'Fire Kirin rewards cannon-power discipline and boss-fish timing over button-mashing.',
 E'Winning at Fire Kirin comes down to cannon-power discipline and boss-fish timing — not luck. Players who stay profitable match their cannon power to the fish on screen, save big shots for Boss Fish, and budget their session before they start firing.\n\n## Core Fire Kirin strategies\n1. **Match cannon power to fish value** — low power on small fish, high power saved for Boss Fish.\n2. **Time Boss Fish encounters** — concentrate fire the moment a boss appears; that''s where the largest multipliers drop.\n3. **Watch for bonus storm windows** — random timed events that multiply every catch; load extra ammo before they hit.\n4. **Set a session budget** before you start — load a fixed amount from your [wallet](/blog/how-to-load-credits-from-wallet) and stop when it''s spent.\n\n## Reading the board\nFire Kirin rewards patience over button-mashing. Track which fish are circling back into range and pre-aim rather than chasing — wasted shots on fast-moving small fish are the single biggest drain on a session''s ammo.\n\n> Players who save their highest cannon power exclusively for Boss Fish report the most consistent sessions.\n\n## Stack your bonuses\nNew players get a [50% first deposit bonus](/blog/50-percent-first-deposit-bonus-explained) — load it alongside your wallet balance and your effective ammo budget goes further from the first session.\n\n## FAQ\n**Is Fire Kirin beginner-friendly?** Yes — see our [beginner picks](/blog/best-fish-table-games-beginners). Fish move slower than in [Juwa](/games/juwa), making it easier to aim.\n\n**What''s the single biggest mistake?** Spraying high cannon power at small fish. Save it for bosses.\n\n**How do I cash out?** See [how cash-out works](/blog/how-cash-out-works-winsweeps).\n\nReady to put this into practice? [Create your Fire Kirin account](/games/fire-kirin) and load your first session.',
 array['how to win fire kirin','fire kirin strategy'],
 true, now() - interval '12 minutes',
 'How to Win at Fire Kirin — Strategies That Actually Work | WinSweeps',
 'How to win at Fire Kirin: cannon-power management, boss-fish timing and bonus-window strategy from experienced WinSweeps players.'),

('how-to-win-at-juwa',
 'How to Win at Juwa — Chain Combos and Boss Timing Explained',
 'Juwa''s fast pace rewards players who manage ammo and chain combos deliberately.',
 E'Juwa''s fast pace rewards players who manage ammo and chain combos deliberately — not players who fire constantly. The biggest sessions come from setting up Chain Reaction shots and timing Dragon Storm windows instead of spraying ammo at every fish on screen.\n\n## Core Juwa strategies\n1. **Set up Chain Reaction shots** — fan shots across a dense school instead of single-targeting; killing 5+ fish within 3 seconds triggers a multiplier chain.\n2. **Use Dragon Storm deliberately** — when the 2× multiplier window opens, switch to medium cannon power and fire fast; don''t waste it on stray shots.\n3. **Coordinate on Boss Battles** — Juwa rooms are multiplayer, and boss fish worth 50–200 credits go to whoever lands the final hit, so stay ready when a boss appears.\n4. **Budget per session** — load a fixed amount from your [wallet](/blog/how-to-load-credits-from-wallet) rather than reloading mid-session.\n\n## Why Juwa plays differently\nJuwa moves faster than [Fire Kirin](/games/fire-kirin) — bonus rounds fire constantly and boss encounters happen often, so reaction time matters more than in slower-paced games. That also means ammo discipline matters more: panic-firing burns through a budget in minutes.\n\n> Chain Reaction setups — fanning shots across a school rather than chasing single fish — are the highest-leverage move experienced Juwa players make.\n\n## Stack your bonuses\nNew accounts qualify for the [50% first deposit bonus](/blog/50-percent-first-deposit-bonus-explained), which stretches your ammo budget further from session one.\n\n## FAQ\n**Is Juwa harder than Fire Kirin?** It''s faster-paced — see our [Fire Kirin vs Juwa vs Orion Stars](/blog/fire-kirin-vs-juwa-vs-orion-stars) comparison.\n\n**What triggers Dragon Storm?** A random timed bonus window with a 2× multiplier on all catches.\n\n**How do I get my winnings out?** See [how cash-out works](/blog/how-cash-out-works-winsweeps).\n\n[Create your Juwa account](/games/juwa) and put these into practice.',
 array['how to win juwa','juwa strategy'],
 true, now() - interval '10 minutes',
 'How to Win at Juwa — Chain Combos and Boss Timing Explained | WinSweeps',
 'How to win at Juwa: Chain Reaction setups, Dragon Storm timing and ammo budgeting strategy from experienced WinSweeps players.'),

('how-to-win-at-orion-stars',
 'How to Win at Orion Stars — Constellation Jackpot Strategy',
 'Orion Stars rewards patient, targeted play over volume.',
 E'Orion Stars rewards patient, targeted play over volume — prioritizing constellation fish and timing Deep Space Boss appearances matters more than firing at everything in range. The deepest multiplier mechanics in the WinSweeps lineup live here, and they reward setup over speed.\n\n## Core Orion Stars strategies\n1. **Prioritize constellation fish** even when they''re small — catching 3 in a row triggers a Star Jackpot, which pays out far more than chasing larger non-constellation fish.\n2. **Save Super Torpedo shots for Deep Space Boss** — this rare mega-boss is worth 500–2,000 credits and only appears periodically.\n3. **Watch for the Nebula Bonus** — a random 3× multiplier window; switch your targeting the moment it triggers.\n4. **Play patiently** — Orion Stars'' constellation mechanic rewards setup, not button-mashing.\n\n## Why Orion Stars is more strategic\nCompared to [Fire Kirin](/games/fire-kirin)''s boss-catch rhythm or [Juwa](/games/juwa)''s speed, Orion Stars asks you to manage which fish you target across the whole board, not just react to what''s closest. See our full [Orion Stars vs Fire Kirin](/blog/orion-stars-vs-fire-kirin) comparison if you''re deciding between the two.\n\n> Catching 3 constellation fish in sequence — even small ones — triggers a Star Jackpot worth more than most single big-fish catches.\n\n## Stack your bonuses\nThe [50% first deposit bonus](/blog/50-percent-first-deposit-bonus-explained) applies to Orion Stars like every other game — load it alongside your wallet balance for a longer first session.\n\n## FAQ\n**Is Orion Stars good for beginners?** It rewards patience over speed — see [best games for beginners](/blog/best-fish-table-games-beginners) for where it ranks.\n\n**What''s a Deep Space Boss worth?** 500–2,000 credits, but it only appears periodically — save your strongest shots for it.\n\n**How do I cash out?** See [how cash-out works](/blog/how-cash-out-works-winsweeps).\n\n[Create your Orion Stars account](/games/orion-stars) and start targeting constellations.',
 array['how to win orion stars','orion stars strategy'],
 true, now() - interval '8 minutes',
 'How to Win at Orion Stars — Constellation Jackpot Strategy | WinSweeps',
 'How to win at Orion Stars: constellation-fish prioritization, Nebula Bonus timing and Deep Space Boss strategy explained.');

-- ==========================================
-- MIGRATION: 20260702000095_telegram_links.sql
-- ==========================================

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

-- ==========================================
-- MIGRATION: 20260703000096_widen_requests_payment_method.sql
-- ==========================================

-- The requests.payment_method CHECK constraint (migration 0020) still only
-- allows the original ('cashapp','zelle','crypto','other') values, but the
-- admin-managed payment_methods table (migration 0092) added chime, paypal,
-- venmo, bitcoin and usdt as selectable deposit methods on /deposit. Picking
-- any of those violated the stale constraint, causing every non-cashapp
-- deposit submission to fail with a generic error (and silently delete the
-- just-uploaded payment proof). Widen the constraint to match.

alter table public.requests drop constraint requests_payment_method_check;
alter table public.requests add constraint requests_payment_method_check
  check (payment_method in ('cashapp','zelle','crypto','other','chime','paypal','venmo','bitcoin','usdt'));

-- ==========================================
-- MIGRATION: 20260708000097_blog_posts_batch2.sql
-- ==========================================

-- 22 additional SEO blog posts (batch 2) — query-gap capture, missing game guides,
-- new comparisons, and real-feature explainers (XP/leveling, leaderboard, payment
-- methods, Telegram support, legality/trust). Run in Supabase SQL Editor after
-- applying all prior migrations.
--
-- ON CONFLICT (slug) DO UPDATE — safe to re-run.

insert into public.blog_posts (slug, title, excerpt, content, tags, is_published, published_at, seo_title, seo_description)
values
('fish-table-sweepstakes-explained',
 'Fish Table Sweepstakes Games — The Complete Guide',
 'What fish table sweepstakes games are, how the legal sweepstakes model works, and how to start playing any game in the WinSweeps lineup.',
 E'Fish table sweepstakes games are arcade-style shooter games — hunt schools of fish, trigger boss encounters, and win credits — run under the legal sweepstakes model instead of real-money gambling. You play with credits tied to a sweepstakes entry structure, and any credits you win can be redeemed for cash prizes.\n\n## What makes a game a "fish table sweepstakes" game?\nThree things distinguish it from a regular arcade cabinet or slot: a shooting-based catch mechanic (aim, fire, catch bigger fish for bigger payouts), a sweepstakes legal structure (see [what sweepstakes games are and why they''re legal](/blog/what-are-sweepstakes-games)), and a redeemable credit balance you can cash out.\n\n## How the sweepstakes model works at WinSweeps\n1. Fund your [wallet](/blog/wallet-deposit-guide-winsweeps) by CashApp, Zelle, or crypto.\n2. Create a free account for any fish table game and [load credits from your wallet](/blog/how-to-load-credits-from-wallet).\n3. Play — aim your cannon, catch fish, trigger boss encounters for bigger payouts.\n4. [Redeem winnings](/blog/how-cash-out-works-winsweeps) to your cash-out balance and request a payout.\n\n## The WinSweeps fish table lineup\n[Fire Kirin](/games/fire-kirin), [Juwa](/games/juwa), [Orion Stars](/games/orion-stars), [Panda Master](/games/panda-master) and [Ultrapanda](/games/ultrapanda) are all fish table games — each with its own boss mechanics and jackpot style. See our [full ranking of all games](/blog/best-fish-table-games-online) to compare.\n\n> Every fish table title at WinSweeps qualifies for the [50% first deposit bonus](/blog/50-percent-first-deposit-bonus-explained), applied automatically on your first wallet deposit.\n\n## FAQ\n**Is fish table sweepstakes gaming legal?** Yes — it runs on the same legal sweepstakes framework as promotional giveaways. See [what are sweepstakes games](/blog/what-are-sweepstakes-games) for the full explanation.\n\n**Do I need to download anything?** No — accounts and wallet funding happen entirely online through WinSweeps.\n\n**Which fish table game should I start with?** See [how to choose a fish table game](/blog/how-to-choose-a-fish-table-game) for a beginner-friendly breakdown.\n\n[Create your free account](/register) and load your first fish table game in minutes.',
 array['fish table sweepstakes','sweepstakes fish table games'],
 true, now() - interval '460 seconds',
 'Fish Table Sweepstakes Games — The Complete Guide | WinSweeps',
 'Fish table sweepstakes games explained: how the legal sweepstakes model works, the WinSweeps game lineup, and how to start playing in minutes.'),

('fish-em-up-online-alternatives',
 'Looking for Fish Em Up? Play These Fish Table Games at WinSweeps Instead',
 'Fish Em Up isn''t part of the WinSweeps catalog — here are the closest fish table games you can actually play, like Fire Kirin and Juwa.',
 E'"Fish Em Up" isn''t a game in the WinSweeps lineup — but if you''re searching for it, you''re almost certainly looking for a fish table shooter: aim, catch, and win credits. WinSweeps runs several fish table games built on that same catch-and-earn format, all playable online with no download.\n\n## The closest matches to a "fish em up" style game\n- **[Fire Kirin](/games/fire-kirin)** — the most popular fish table title at WinSweeps, known for Dragon Boss encounters and scaling jackpots.\n- **[Juwa](/games/juwa)** — faster-paced, with a Chain Reaction combo system for rapid multi-catch multipliers.\n- **[Orion Stars](/games/orion-stars)** — constellation-themed with layered jackpot tiers.\n- **[Panda Master](/games/panda-master)** and **[Ultrapanda](/games/ultrapanda)** — bamboo-forest and panda-themed variants with their own boss systems.\n\n## Why play at WinSweeps instead\nEvery fish table game here shares one wallet — fund it once by CashApp, Zelle or crypto, then [load credits](/blog/how-to-load-credits-from-wallet) into any game instantly, no re-depositing per title. Your first deposit also qualifies for a [50% bonus](/blog/50-percent-first-deposit-bonus-explained).\n\n## How to get started\n1. [Create a free account](/register) and fund your wallet.\n2. Pick a fish table game — see our [full fish table ranking](/blog/best-fish-table-games-online) if you''re not sure which fits your style.\n3. Load credits and start catching.\n\n## FAQ\n**Is there an actual game called Fish Em Up at WinSweeps?** No — it''s not part of the current lineup. The games above are the closest match in style and mechanics.\n\n**Which fish table game is easiest to learn?** See [best fish table games for beginners](/blog/best-fish-table-games-beginners).\n\n**Can I try more than one?** Yes — accounts are free, and your wallet balance loads into any of them.\n\n[Create your account](/register) and start with [Fire Kirin](/games/fire-kirin) or any fish table game above.',
 array['fish em up','play fish em up','fish table games online'],
 true, now() - interval '440 seconds',
 'Fish Em Up Online — Play These Fish Table Alternatives | WinSweeps',
 'Searching for Fish Em Up? It''s not in the WinSweeps lineup — play Fire Kirin, Juwa, Orion Stars and more fish table games instead, free account today.'),

('luckytap-slots-guide-winsweeps-alternative',
 'Twin Happiness, Smashing Sevens, Survivor & Family Feud — LuckyTap Slots Guide',
 'Twin Happiness, Smashing Sevens Win Ways, Survivor and Family Feud are LuckyTap slots not on WinSweeps — here''s what to play instead.',
 E'Twin Happiness, Smashing Sevens Win Ways, Survivor and Family Feud are LuckyTap-branded slot titles — they aren''t part of the WinSweeps game catalog. If you''re searching for any of them, here''s what WinSweeps actually offers in the same slot-reel style, plus how to get started.\n\n## What these LuckyTap titles have in common\nAll four are reel-based slot games (not fish table shooters) — spin-and-win format with paylines, bonus rounds and progressive-style jackpots. If that''s the style you''re after, WinSweeps'' reel-based lineup is the closest match.\n\n## WinSweeps slot alternatives\n- **[Vegas Sweeps](/games/vegas-sweeps)** — classic and video slots with progressive jackpot pools, the most direct match for casino-style reel play.\n- **[Cash Machine](/games/cash-machine)** — steady paylines and a free-spin engine that rewards patient play.\n- **[Cash Frenzy](/games/cash-frenzy)** — free-spin chains with a climbing cash meter.\n- **[Mafia](/games/mafia)** — reel-and-target hybrid with boss encounters and syndicate jackpot pools.\n\n## Why play these instead\nNone of the LuckyTap titles above are available through WinSweeps, so there''s no account-creation path for them here. The games listed instead run on the same WinSweeps wallet — fund it once, [load credits](/blog/how-to-load-credits-from-wallet) into any of them, and your first deposit qualifies for a [50% bonus](/blog/50-percent-first-deposit-bonus-explained).\n\n## FAQ\n**Can I play Twin Happiness or Family Feud slots at WinSweeps?** No — they''re not in the current catalog. The alternatives above are the closest match in style.\n\n**Which of these pays best for beginners?** [Cash Machine](/games/cash-machine) is built for steady, lower-variance sessions — a good starting point.\n\n**Do slot games qualify for the deposit bonus?** Yes — every game in the WinSweeps lineup, including all slots, qualifies.\n\n[Create your free account](/register) and try [Vegas Sweeps](/games/vegas-sweeps) or any slot game above.',
 array['twin happiness slot','smashing sevens win ways','survivor luckytap','family feud luckytap'],
 true, now() - interval '420 seconds',
 'LuckyTap Slots Guide — Twin Happiness, Smashing Sevens & More | WinSweeps',
 'Twin Happiness, Smashing Sevens Win Ways, Survivor and Family Feud aren''t on WinSweeps — see the closest slot games you can actually play here.'),

('how-sweepstakes-payouts-work',
 'How Sweepstakes Game Payouts Work — Volatility, Boss Fish & Jackpot Pools',
 'How payouts work across fish table and slot sweepstakes games — volatility, boss encounters, and shared jackpot pools explained.',
 E'Sweepstakes game payouts depend on the format: reel-based slots pay out through paylines and bonus rounds with built-in volatility, while fish table games pay through catch value, boss encounters and shared jackpot pools. Neither format guarantees a specific return — payout style is a matter of game design, not a fixed percentage promise.\n\n## Slots: paylines and volatility\nSlot-style games like [Vegas Sweeps](/games/vegas-sweeps) and [Cash Machine](/games/cash-machine) pay based on which symbols land on active paylines. Lower-volatility games pay smaller amounts more often; higher-volatility video slots pay less frequently but can hit bigger bonus rounds. See our [full strategy guide](/blog/win-at-fish-table-games-strategies) for matching volatility to your bankroll.\n\n## Fish tables: catch value and boss timing\nFish table games like [Fire Kirin](/games/fire-kirin) and [Juwa](/games/juwa) pay per catch — bigger, rarer fish are worth more, and boss-tier encounters pay the most. Timing your highest cannon power around boss appearances matters more than spraying at every small fish. See our [boss and jackpot timing guide](/blog/boss-fish-jackpot-timing-guide) for per-game patterns.\n\n## Shared jackpot pools\nSome games (Orion Stars'' Deep Space Boss, Mafia''s Syndicate Jackpot) split part of a jackpot pool across everyone in the room when the boss is defeated, with a larger share going to whoever lands the final hit.\n\n> Payout structure is set by each game''s design — no sweepstakes platform, including WinSweeps, controls or guarantees individual outcomes.\n\n## FAQ\n**Do bigger bets pay more?** Bet size affects your exposure, not the underlying odds — higher cannon power or bet levels typically unlock access to bigger-value targets or paylines, not better odds on the same target.\n\n**Are fish table payouts better than slots?** Neither format is universally better — it depends on whether you prefer steady, frequent smaller wins (slots, low variance) or occasional big boss catches (fish tables).\n\n**How do I actually receive my winnings?** See [how cash-out works at WinSweeps](/blog/how-cash-out-works-winsweeps).\n\n[Create your free account](/register) and try a fish table or slot game today.',
 array['sweepstakes game payouts','fish table payout','how sweepstakes games pay'],
 true, now() - interval '400 seconds',
 'How Sweepstakes Game Payouts Work | WinSweeps',
 'How fish table and slot sweepstakes payouts actually work — volatility, boss encounters and jackpot pools explained honestly, no fake odds.'),

('ultrapanda-game-guide',
 'Ultrapanda Online — Complete Game Guide',
 'Ultrapanda blends fish table shooting with slot-style bonus rounds. Here''s how it works and how to start playing at WinSweeps.',
 E'Ultrapanda blends fish table shooting with slot-style bonus rounds under one panda-mascot theme — catch schools of fish for standard payouts, then land on bonus triggers for slot-style multiplier spins. It''s one of the more hybrid titles in the WinSweeps lineup.\n\n## What makes Ultrapanda different\nMost WinSweeps fish table games are shooter-only. Ultrapanda mixes catch-based fish hunting with slot-style bonus triggers, so a session can swing between aim-and-fire play and spin-based bonus rounds without switching games.\n\n## How to get started\n1. [Create a free account](/register) and fund your [wallet](/blog/wallet-deposit-guide-winsweeps).\n2. Open [Ultrapanda](/games/ultrapanda) and [load credits](/blog/how-to-load-credits-from-wallet) from your wallet balance.\n3. Play — hunt fish for standard payouts, and watch for bonus triggers that switch into slot-style spins.\n\n## Ultrapanda strategy basics\n- Prioritize the panda-mascot bonus targets when they appear — they''re the trigger for the slot-style bonus round.\n- Save higher cannon power for larger fish rather than spraying at small schools — the same principle that applies across every WinSweeps fish table game (see our [general win strategies](/blog/win-at-fish-table-games-strategies)).\n\n## Bonuses\nUltrapanda qualifies for the [50% first deposit bonus](/blog/50-percent-first-deposit-bonus-explained) like every other game in the lineup.\n\n## FAQ\n**Is Ultrapanda a fish table game or a slot?** Both — it''s a hybrid: fish-catch gameplay with slot-style bonus rounds layered in.\n\n**How is Ultrapanda different from Panda Master?** Both share a panda theme, but Ultrapanda leans more into hybrid slot bonus rounds. See our [Panda Master vs Ultrapanda](/blog/panda-master-vs-ultrapanda) comparison.\n\n**Do I need to download an app?** No — WinSweeps handles account creation and credit loading entirely online.\n\n[Create your Ultrapanda account](/games/ultrapanda) and start playing.',
 array['ultrapanda','ultrapanda online','ultrapanda game'],
 true, now() - interval '380 seconds',
 'Ultrapanda Online — Complete Game Guide | WinSweeps',
 'Play Ultrapanda at WinSweeps — fish table shooting plus slot-style bonus rounds. How it works, strategy basics, and how to get started.'),

('gameroom-game-guide',
 'Gameroom Online — Slots, Fish Tables & Keno Guide',
 'Gameroom bundles slots, fish tables and keno in one account, with a $5 minimum deposit. Here''s the full breakdown.',
 E'Gameroom is a Vegas-style arcade platform bundling slots, fish table games and keno under one login — the most format-diverse title in the WinSweeps catalog after Game Vault and Mr. All In One. One account gives you access to all three formats.\n\n## What''s inside Gameroom\n- **Slots** — classic and video reel games\n- **Fish tables** — catch-based shooter games\n- **Keno** — number-pick draw games, a format unique to Gameroom in the WinSweeps lineup\n\n## Who should play Gameroom\nGameroom suits players who want variety without switching platforms — similar in spirit to [Game Vault](/games/game-vault) or [Mr. All In One](/games/mr-all-in-one), but with keno added to the mix. See our [Gameroom vs Orion Stars](/blog/gameroom-vs-orion-stars) comparison if you''re deciding between a multi-format platform and a focused fish table game.\n\n## How to get started\n1. [Create a free account](/register) and fund your [wallet](/blog/wallet-deposit-guide-winsweeps) — deposits start at $5.\n2. Open [Gameroom](/games/gameroom) and [load credits](/blog/how-to-load-credits-from-wallet).\n3. Pick a format — slots, fish tables or keno — and switch freely from the same balance.\n\n## Bonuses\nGameroom qualifies for the [50% first deposit bonus](/blog/50-percent-first-deposit-bonus-explained), applied automatically on your first wallet deposit.\n\n## FAQ\n**What''s the minimum deposit for Gameroom?** $5 — one of the lowest entry points in the WinSweeps lineup.\n\n**Does Gameroom include keno?** Yes — it''s the only game in the WinSweeps catalog with a dedicated keno section.\n\n**Can I switch between slots, fish tables and keno in one session?** Yes — all three formats share the same Gameroom balance.\n\n[Create your Gameroom account](/games/gameroom) and explore all three formats.',
 array['gameroom online','gameroom game','gameroom sweepstakes'],
 true, now() - interval '360 seconds',
 'Gameroom Online — Slots, Fish Tables & Keno Guide | WinSweeps',
 'Gameroom at WinSweeps: slots, fish tables and keno in one account, $5 minimum deposit, 50% first deposit bonus. Full game guide.'),

('mafia-vs-juwa',
 'Mafia vs Juwa — Which Fish Table Should You Play?',
 'Mafia''s Boss battles and jackpot pools vs Juwa''s fast Chain Reaction combos — full comparison to help you choose.',
 E'Mafia is a crime-themed fish table with syndicate jackpot pools and boss battles; Juwa is a fast, combo-driven fish table built around Chain Reaction multipliers. Both are catch-based shooters, but they reward different playstyles.\n\n## Quick comparison\n- **[Mafia](/games/mafia)** — Street Boss, Capo and Godfather encounters, shared Syndicate Jackpot pools. Rewards coordinated, patient play.\n- **[Juwa](/games/juwa)** — Chain Reaction combos and Dragon Storm multiplier windows. Rewards fast, precise targeting.\n\n## Playstyle\nMafia is slower and more strategic — reading boss timers and managing ammo reserves for rare encounters matters most. Juwa is high-speed — clustering shots to trigger Chain Reactions and capitalizing immediately is the core skill. See our [Juwa advanced tips](/blog/juwa-tips-and-strategies) and general [win strategies](/blog/win-at-fish-table-games-strategies) for both approaches.\n\n## Bonuses & wallet\nBoth qualify for the [50% first deposit bonus](/blog/50-percent-first-deposit-bonus-explained) and load instantly from your WinSweeps [wallet](/blog/how-to-load-credits-from-wallet).\n\n> Mafia''s Syndicate Jackpot splits across the room when a Capo or Godfather falls; Juwa''s Chain Reaction rewards go entirely to the player who triggers them.\n\n## FAQ\n**Which is better for beginners?** Juwa — its combo system is more forgiving to learn than Mafia''s boss-timing strategy.\n\n**Which pays bigger single hits?** Mafia''s Godfather encounter, when it appears, is the largest single payout event between the two.\n\n**Can I play both from one account?** Yes — create both free and load either from your wallet.\n\nCreate a [Mafia](/games/mafia) or [Juwa](/games/juwa) account and start playing.',
 array['mafia vs juwa','best fish table game'],
 true, now() - interval '340 seconds',
 'Mafia vs Juwa — Which Fish Table Wins? | WinSweeps',
 'Mafia vs Juwa compared: Boss battles and jackpot pools versus fast Chain Reaction combos. Which fish table game should you play?'),

('panda-master-vs-ultrapanda',
 'Panda Master vs Ultrapanda — Which Panda Game Should You Play?',
 'Panda Master''s Giant Panda Boss vs Ultrapanda''s hybrid slot bonus rounds — full comparison.',
 E'Panda Master and Ultrapanda share a panda theme but play differently: Panda Master is a straight fish table shooter built around a Giant Panda Boss encounter, while Ultrapanda blends fish-catch gameplay with slot-style bonus rounds.\n\n## Quick comparison\n- **[Panda Master](/games/panda-master)** — pure fish table shooter, Giant Panda Boss is the headline event.\n- **[Ultrapanda](/games/ultrapanda)** — hybrid: fish catching plus slot-style bonus round triggers.\n\n## Playstyle\nPanda Master rewards timing your biggest shots around Giant Panda Boss appearances — see our [Panda Master tips](/blog/panda-master-tips-strategies) for the exact pattern. Ultrapanda splits attention between catching fish and landing bonus-round triggers, so sessions feel more varied.\n\n## Bonuses & wallet\nBoth qualify for the [50% first deposit bonus](/blog/50-percent-first-deposit-bonus-explained) and share the same WinSweeps [wallet](/blog/how-to-load-credits-from-wallet) — no separate deposit needed per game.\n\n## FAQ\n**Which is more beginner-friendly?** Ultrapanda''s slot-style bonus rounds require less precision aiming than Panda Master''s boss-timing strategy.\n\n**Which has bigger single payouts?** Panda Master''s Giant Panda Boss is the bigger single-event payout of the two.\n\n**Do they share a wallet?** Yes — fund it once, load either game instantly.\n\nCreate a [Panda Master](/games/panda-master) or [Ultrapanda](/games/ultrapanda) account and try both.',
 array['panda master vs ultrapanda','best fish table game'],
 true, now() - interval '320 seconds',
 'Panda Master vs Ultrapanda Compared | WinSweeps',
 'Panda Master vs Ultrapanda: a pure fish table Boss shooter versus a hybrid slot-and-fish game. Which panda-themed game fits your style?'),

('cash-machine-vs-cash-frenzy',
 'Cash Machine vs Cash Frenzy — Which Slot Should You Play?',
 'Cash Machine''s steady paylines vs Cash Frenzy''s free-spin chains — full comparison of WinSweeps'' two consistency-focused slots.',
 E'Cash Machine and Cash Frenzy are both slot-style games in the WinSweeps lineup, but they''re built for different paces: Cash Machine rewards steady, patient play through consistent paylines, while Cash Frenzy is built around chained free spins and a climbing cash meter.\n\n## Quick comparison\n- **[Cash Machine](/games/cash-machine)** — consistent paylines, low-variance, a free-spin meter that charges every 50 spins.\n- **[Cash Frenzy](/games/cash-frenzy)** — free-spin chains and a climbing cash meter for faster bonus triggers.\n\n## Playstyle\nCash Machine favors longer sessions with smaller, more frequent wins — good for rebuilding a balance steadily. Cash Frenzy favors players chasing more frequent bonus-round action. See [VBlink & Cash Frenzy](/blog/vblink-cash-frenzy-guide) and [Cash Frenzy tips](/blog/cash-frenzy-guide-tips) for deeper strategy on the faster of the two.\n\n## Bonuses & wallet\nBoth qualify for the [50% first deposit bonus](/blog/50-percent-first-deposit-bonus-explained) and load from the same WinSweeps [wallet](/blog/how-to-load-credits-from-wallet).\n\n> Cash Machine''s free-spin meter is guaranteed to charge every 50 spins regardless of bet size — the only WinSweeps slot with a fixed-interval bonus trigger.\n\n## FAQ\n**Which is more predictable?** Cash Machine — its free-spin meter charges on a fixed 50-spin interval.\n\n**Which is faster-paced?** Cash Frenzy, by design.\n\n**Can I use one wallet for both?** Yes — no separate deposits needed.\n\nCreate a [Cash Machine](/games/cash-machine) or [Cash Frenzy](/games/cash-frenzy) account and compare them yourself.',
 array['cash machine vs cash frenzy','best sweepstakes slot'],
 true, now() - interval '300 seconds',
 'Cash Machine vs Cash Frenzy Compared | WinSweeps',
 'Cash Machine vs Cash Frenzy: steady low-variance paylines versus free-spin chains and a climbing cash meter. Which slot fits your style?'),

('vblink-vs-milky-way',
 'VBlink vs Milky Way — Which Game Should You Play?',
 'VBlink''s sub-second spins vs Milky Way''s Galactic Storm multiplier — full comparison.',
 E'VBlink and Milky Way are both fast-paced games at WinSweeps, but they differ in theme and bonus structure: VBlink is built around sub-second spins and stacked bonus rounds, while Milky Way is a space-themed fish table with a Galactic Storm multiplier event.\n\n## Quick comparison\n- **[VBlink](/games/vblink)** — sub-second spin mechanic, stacked bonus rounds, one of the fastest games in the lineup.\n- **[Milky Way](/games/milky-way)** — space-themed fish table, Galactic Storm event pays out 5× during its window.\n\n## Playstyle\nVBlink is spin-and-watch, best for players who want rapid-fire rounds with minimal downtime between spins. Milky Way is catch-based, rewarding players who time their biggest shots for the Galactic Storm. See our [Milky Way advanced strategies](/blog/milky-way-advanced-strategies) and [VBlink guide](/blog/vblink-game-guide) for the specifics of each.\n\n## Bonuses & wallet\nBoth qualify for the [50% first deposit bonus](/blog/50-percent-first-deposit-bonus-explained) and load from your WinSweeps [wallet](/blog/how-to-load-credits-from-wallet).\n\n## FAQ\n**Which is faster?** VBlink — its sub-second spin cycle is the fastest format in the WinSweeps lineup.\n\n**Which has bigger bonus multipliers?** Milky Way''s Galactic Storm event, at 5×, is the larger single-window multiplier.\n\n**Do both use the same wallet?** Yes.\n\nCreate a [VBlink](/games/vblink) or [Milky Way](/games/milky-way) account and try both formats.',
 array['vblink vs milky way','best sweepstakes game'],
 true, now() - interval '280 seconds',
 'VBlink vs Milky Way Compared | WinSweeps',
 'VBlink vs Milky Way: sub-second stacked-bonus spins versus a space-themed fish table with a 5x Galactic Storm event. Full comparison.'),

('mr-all-in-one-vs-game-vault',
 'Mr. All In One vs Game Vault — Which All-In-One Platform Wins?',
 'Both bundle fish tables, slots and arcade games — here''s how Mr. All In One and Game Vault actually compare.',
 E'Mr. All In One and Game Vault are the two multi-format platforms in the WinSweeps lineup — both bundle fish tables, slots and arcade games under one login, so the choice comes down to library size and layout rather than game type.\n\n## Quick comparison\n- **[Mr. All In One](/games/mr-all-in-one)** — fish tables, slots and arcade mini-games in one account.\n- **[Game Vault](/games/game-vault)** — the largest all-in-one platform in the lineup, with a universal balance across every format inside it. See the [full Game Vault game list](/blog/game-vault-all-games-breakdown).\n\n## Playstyle\nBoth exist for the same reason: players who don''t want to commit to one game type. Game Vault has historically carried the deeper catalog inside the platform; Mr. All In One is a leaner, simpler variety pack. Either lets you bounce between fish tables and slots without creating a new account per game.\n\n## Bonuses & wallet\nBoth qualify for the [50% first deposit bonus](/blog/50-percent-first-deposit-bonus-explained), and both load from the same WinSweeps [wallet](/blog/how-to-load-credits-from-wallet) — winnings in the fish table section can be spent in the slot section and vice versa.\n\n## FAQ\n**Which has more games?** Game Vault carries the larger in-platform catalog.\n\n**Which is better for beginners?** Either works — both include simple slot options alongside fish tables, so beginners aren''t forced into aim-based gameplay.\n\n**Can I create both?** Yes — accounts are free, and both draw from the same wallet.\n\nCreate a [Mr. All In One](/games/mr-all-in-one) or [Game Vault](/games/game-vault) account and explore both.',
 array['mr all in one vs game vault','best sweepstakes platform'],
 true, now() - interval '260 seconds',
 'Mr. All In One vs Game Vault Compared | WinSweeps',
 'Mr. All In One vs Game Vault: two all-in-one sweepstakes platforms compared on library size, variety and bonuses. Which should you create first?'),

('gameroom-vs-orion-stars',
 'Gameroom vs Orion Stars — Variety or Deep Jackpots?',
 'Gameroom''s slots-fish-keno variety vs Orion Stars'' layered constellation jackpots — full comparison.',
 E'Gameroom is a Vegas-style multi-format platform — slots, fish tables and keno in one account. Orion Stars is a focused fish table game with deep constellation-jackpot mechanics. The choice comes down to variety versus depth.\n\n## Quick comparison\n- **[Gameroom](/games/gameroom)** — slots, fish tables and keno under one login, $5 minimum deposit.\n- **[Orion Stars](/games/orion-stars)** — single fish table game with layered Star, Nebula and Deep Space Boss jackpots. See [Orion Stars strategy](/blog/how-to-win-at-orion-stars).\n\n## Playstyle\nGameroom suits players who want to switch formats mid-session — slots when you want to relax, fish tables or keno when you want more engagement. Orion Stars suits players who want to master one game''s layered jackpot system deeply, prioritizing constellation fish and timing boss encounters.\n\n## Bonuses & wallet\nBoth qualify for the [50% first deposit bonus](/blog/50-percent-first-deposit-bonus-explained) and load from your WinSweeps [wallet](/blog/how-to-load-credits-from-wallet).\n\n## FAQ\n**Which is more beginner-friendly?** Gameroom — its slot and keno sections need no aiming skill, unlike Orion Stars'' fish table mechanics.\n\n**Which has bigger single jackpots?** Orion Stars'' Deep Space Boss kill-shot jackpot is the bigger single-event payout.\n\n**Can I try both for free?** Account creation is free for both — only credit loading uses your wallet balance.\n\nCreate a [Gameroom](/games/gameroom) or [Orion Stars](/games/orion-stars) account and compare them.',
 array['gameroom vs orion stars','best sweepstakes game'],
 true, now() - interval '240 seconds',
 'Gameroom vs Orion Stars Compared | WinSweeps',
 'Gameroom vs Orion Stars: a multi-format slots/fish/keno platform versus a focused fish table with deep jackpot tiers. Which fits you?'),

('winsweeps-xp-leveling-explained',
 'WinSweeps XP & Leveling Explained — How to Climb Levels Fast',
 'The exact XP curve behind WinSweeps levels, where XP comes from, and how leveling connects to VIP tiers.',
 E'Your WinSweeps level is calculated directly from total XP earned: level L requires 100 × (L−1)² XP to reach. That means leveling up costs more each time — level 2 needs 100 XP, level 5 needs 1,600 XP, level 10 needs 8,100 XP — and every XP source (daily claims, streaks, referrals) counts toward it automatically.\n\n## The XP curve\n- **Level 2** — 100 XP\n- **Level 3** — 400 XP\n- **Level 5** — 1,600 XP\n- **Level 10** — 8,100 XP\n- **Level 25** — 57,600 XP\n- **Level 50** — 240,100 XP\n\n## Where XP comes from\n- **[Daily Reward](/blog/daily-rewards-coins-guide)** — 50 XP per claim, plus streak bonuses.\n- **7-day / 30-day / 100-day streak milestones** — one-time bonuses of 250 / 1,500 / 6,000 XP.\n- **[Referrals](/blog/refer-friends-earn-coins)** — 400 XP per qualified referral.\n- **Weekly Chest / Monthly Vault** — 300 XP and 1,200 XP, unlocked by claim streaks within the period.\n\n## Level milestones that pay extra\nHitting level 5, 10, 25 or 50 unlocks a one-time achievement bonus on top of your regular XP — up to 20,000 bonus coins at level 50.\n\n## How leveling connects to VIP\nXP doesn''t just raise your level — it also moves you through [VIP tiers](/blog/winsweeps-vip-tiers-explained), which apply a permanent multiplier to every coin reward you claim.\n\n## FAQ\n**Does XP ever expire or reset?** No — XP is cumulative and your level only moves up.\n\n**What''s the fastest way to gain XP?** Consistent daily claims plus streak milestones compound faster than any single source alone — see the [daily rewards guide](/blog/daily-rewards-coins-guide).\n\n**Does level affect my VIP tier directly?** VIP tiers are based on total XP thresholds, not level number directly, but since both are driven by the same XP total, they move together.\n\n[Create your free account](/register) and start earning XP with your first daily claim.',
 array['winsweeps xp','winsweeps leveling','how to level up fast'],
 true, now() - interval '220 seconds',
 'WinSweeps XP & Leveling Explained | WinSweeps',
 'How WinSweeps XP and leveling actually work: the exact XP curve, every XP source, and how leveling connects to VIP tier multipliers.'),

('winsweeps-leaderboard-guide',
 'WinSweeps Leaderboard Guide — How Rankings Are Calculated',
 'How WinSweeps leaderboards rank players, the daily/weekly/monthly/all-time reset schedule, and how to climb fast.',
 E'WinSweeps leaderboards rank players by XP earned within a time period, not total lifetime XP — so a new player can climb a daily or weekly board fast without competing against someone''s all-time total. There are four boards: daily, weekly, monthly and all-time.\n\n## How ranking is calculated\nYour leaderboard score is the XP you gain during that specific period — the platform tracks XP gained via the rewards ledger and ranks everyone from highest to lowest within the period.\n\n## Reset schedule\n- **Daily board** — resets at midnight UTC\n- **Weekly board** — resets every Monday\n- **Monthly board** — resets on the 1st\n- **All-time board** — never resets\n\n## Why the period boards matter more for new players\nBecause daily and weekly boards only count XP earned in that window, a player who''s active for a few days can realistically place — you''re not competing against someone''s months of accumulated XP the way you would be on the all-time board.\n\n## Finishing in the top 10 pays extra\nLanding a top-10 finish on any leaderboard period unlocks a one-time achievement bonus on top of whatever you earned getting there.\n\n## How to climb fast\nThe fastest way to move up a period board is the same as [earning XP generally](/blog/winsweeps-xp-leveling-explained): daily claims, streak milestones and qualified referrals all count toward your period score the moment they''re earned.\n\n## FAQ\n**Do I need to opt in to appear on leaderboards?** No — every active member is ranked automatically based on XP earned.\n\n**Which board is easiest to place on as a new player?** The daily or weekly board — your score only reflects that window, not lifetime XP.\n\n**Does VIP tier affect leaderboard rank?** No — ranking is based purely on XP earned in the period, though [VIP multipliers](/blog/winsweeps-vip-tiers-explained) can help you earn that XP faster.\n\n[Create your free account](/register) and check today''s leaderboard on your dashboard.',
 array['winsweeps leaderboard','leaderboard rewards'],
 true, now() - interval '200 seconds',
 'WinSweeps Leaderboard Guide — How Rankings Work | WinSweeps',
 'How WinSweeps leaderboard rankings are calculated, the reset schedule for daily/weekly/monthly/all-time boards, and how to climb fast.'),

('winsweeps-payment-methods-compared',
 'All WinSweeps Payment Methods Compared',
 'CashApp, Zelle, Chime, PayPal, Venmo, Bitcoin and USDT compared — which deposit method is fastest for you.',
 E'WinSweeps accepts several deposit methods: CashApp, Zelle, Chime, PayPal, Venmo, Bitcoin and USDT. Each funds the same wallet balance, so the method you pick doesn''t change what games you can play — it only changes how fast your deposit clears and how you prefer to send money.\n\n## Handle-based methods: CashApp, Chime, PayPal, Venmo, Zelle\nThese transfer to a handle or tag rather than a wallet address. Send the payment, screenshot the confirmation, and upload it with your deposit request — see the [CashApp](/blog/how-to-deposit-cashapp-fish-table) and [Zelle](/blog/how-to-deposit-zelle-fish-table) step-by-step guides for the exact flow.\n\n## Crypto methods: Bitcoin and USDT\nCrypto deposits go to a wallet address instead of a handle. They''re best for larger deposits and tend to confirm fast on-chain. See our [Bitcoin deposit guide](/blog/how-to-deposit-bitcoin-fish-table) for wallet-address specifics.\n\n## Which method should you pick?\n- **Fastest for small amounts:** CashApp or Venmo — instant sends, quick confirmation.\n- **No app required:** Zelle, if it''s already built into your bank''s app.\n- **Larger deposits:** Bitcoin or USDT.\n- **Already have the app:** Chime or PayPal work the same as CashApp/Venmo — pick whichever you already use.\n\n## What happens after you send payment\nEvery method follows the same next step: upload your payment screenshot with your deposit request. Our team verifies it and credits your [wallet](/blog/wallet-deposit-guide-winsweeps), typically within 30 minutes during support hours.\n\n## FAQ\n**Does the payment method affect my bonus?** No — the [50% first deposit bonus](/blog/50-percent-first-deposit-bonus-explained) applies regardless of which method you use.\n\n**Is one method faster than the others?** CashApp, Venmo and crypto tend to confirm fastest; bank-linked methods can occasionally take longer depending on your bank.\n\n**What if my payment screenshot doesn''t upload?** Contact [support via Telegram](/blog/winsweeps-telegram-support-guide) and our team will help manually.\n\n[Add funds to your wallet](/deposit) with whichever method you prefer.',
 array['winsweeps payment methods','how to deposit winsweeps'],
 true, now() - interval '180 seconds',
 'All WinSweeps Payment Methods Compared',
 'CashApp, Zelle, Chime, PayPal, Venmo, Bitcoin and USDT compared for WinSweeps deposits — which method is fastest and best for your amount.'),

('winsweeps-telegram-support-guide',
 'How to Get Fast Support at WinSweeps via Telegram',
 'How to reach WinSweeps support through Telegram, what it''s best for, and how VIP tiers affect response time.',
 E'WinSweeps support runs through Telegram — for account setup, deposit confirmations and general questions, it''s the fastest way to reach a real person, alongside the ticket system in your dashboard''s Support section.\n\n## How to reach support on Telegram\nTelegram links are visible across the WinSweeps dashboard and on every game page — look for the Telegram link in the site footer or your dashboard, and message the linked channel directly.\n\n## What Telegram is best for\n- Deposit and account-setup questions\n- Fast confirmation once you''ve uploaded a payment screenshot\n- General questions about games, bonuses or your balance\n\n## What the in-dashboard ticket system is best for\nAnything that needs a written record — cash-out issues, account disputes, or anything you want tracked with a reference number. Open a ticket from your [dashboard''s Support section](/dashboard).\n\n## Priority support for higher VIP tiers\nDiamond and Elite members get priority handling with sub-minute live response times during peak hours — see the full breakdown in our [VIP tiers guide](/blog/winsweeps-vip-tiers-explained).\n\n## FAQ\n**Is Telegram the only way to contact WinSweeps?** No — you can also open a support ticket from your dashboard. Telegram is generally faster for quick questions.\n\n**Do I need a Telegram account?** Yes, but it''s free and takes a minute to set up if you don''t already have one.\n\n**Does VIP tier affect Telegram response time?** Diamond and Elite members get priority handling; other tiers are still supported but without the sub-minute guarantee.\n\n[Create your free account](/register) and find the Telegram link on your dashboard.',
 array['winsweeps telegram support','winsweeps contact'],
 true, now() - interval '160 seconds',
 'WinSweeps Telegram Support Guide',
 'How to contact WinSweeps support via Telegram for deposits, account setup and general questions, plus VIP priority response times.'),

('sweepstakes-vs-real-money-gambling',
 'Sweepstakes vs Real-Money Gambling — Key Legal Differences Explained',
 'The legal difference between sweepstakes gaming and real-money gambling, and why it means WinSweeps is available nationwide.',
 E'Sweepstakes games and real-money gambling are legally distinct: in a sweepstakes model, you receive entries as part of a promotional structure tied to a credit purchase, while real-money gambling involves wagering money directly on an outcome. That structural difference is what makes sweepstakes gaming legal in states where traditional online gambling isn''t.\n\n## Quick comparison\n- **Real-money gambling** — you wager money directly on a game outcome; regulated (or prohibited) on a state-by-state licensing basis.\n- **Sweepstakes gaming** — you receive sweepstakes entries as part of a credit purchase; governed by sweepstakes law, not gambling law, and available more broadly. See [what are sweepstakes games](/blog/what-are-sweepstakes-games) for the full legal explanation.\n\n## Why the distinction matters\nTraditional online real-money gambling is only legal in a handful of licensed states. The sweepstakes model is what allows platforms like WinSweeps to operate [nationwide](/blog/sweepstakes-games-us-nationwide) — because legally, you''re not wagering money on an outcome, you''re receiving promotional entries.\n\n## What stays the same for players\nDespite the legal difference, the player experience is similar: you fund an account, play games, and redeem winnings. See [how cash-out works](/blog/how-cash-out-works-winsweeps) for how redemption works specifically at WinSweeps.\n\n## FAQ\n**Is sweepstakes gaming just a loophole?** No — it''s a distinct, long-established legal category (the same one behind fast-food and beverage sweepstakes promotions), not an attempt to bypass gambling law.\n\n**Can I play sweepstakes games in states where online gambling is illegal?** Generally yes, because the legal basis is different — see [our nationwide availability guide](/blog/sweepstakes-games-us-nationwide) for specifics.\n\n**Are winnings real?** Yes — credits won can be redeemed; see [how cash-out works](/blog/how-cash-out-works-winsweeps).\n\nRead our full [sweepstakes games explainer](/blog/what-are-sweepstakes-games) or [create your free account](/register) to get started.',
 array['sweepstakes vs gambling','are sweepstakes games legal'],
 true, now() - interval '140 seconds',
 'Sweepstakes vs Real-Money Gambling Explained | WinSweeps',
 'Sweepstakes games vs real-money gambling: the legal structure that makes sweepstakes gaming available nationwide, explained clearly.'),

('is-winsweeps-legit',
 'Is WinSweeps Legit? Trust, Verification & Support Explained',
 'How WinSweeps verifies deposits, keeps an append-only transaction ledger, and handles support — what to check on any platform.',
 E'WinSweeps is a legitimate sweepstakes platform — deposits are manually verified against uploaded payment proof before crediting, all wallet and reward transactions run through an append-only ledger, and support is available directly via Telegram and an in-dashboard ticket system. Here''s what that looks like in practice.\n\n## How deposits are verified\nEvery deposit request requires a payment screenshot as proof. Admin staff verify the payment before crediting your [wallet](/blog/wallet-deposit-guide-winsweeps) — nothing is auto-credited from an unverified claim.\n\n## Transaction transparency\nEvery coin, XP and wallet movement is recorded in an append-only ledger — records can''t be edited or deleted after the fact, so your transaction history is a permanent record, not something that can quietly change.\n\n## How cash-outs work\nWinnings are redeemed to a separate cash-out balance, then paid out by admin — the same manual-review model used on the deposit side. See [how cash-out works at WinSweeps](/blog/how-cash-out-works-winsweeps) for the full process.\n\n## Real support, not a bot-only queue\nSupport runs through [Telegram](/blog/winsweeps-telegram-support-guide) and an in-dashboard ticket system, with priority handling for Diamond and Elite VIP members.\n\n## What to check on any sweepstakes platform\n- Is there a manual verification step for deposits, or does it auto-credit anything?\n- Is the redemption/cash-out process clearly explained, not vague?\n- Is support reachable through a real channel, not just a contact form that goes nowhere?\n\n## FAQ\n**Does WinSweeps auto-credit deposits without verification?** No — every deposit requires a payment screenshot and manual verification before crediting.\n\n**Can transaction records be altered after the fact?** No — the ledger is append-only by design.\n\n**How do I reach support if something goes wrong?** [Telegram](/blog/winsweeps-telegram-support-guide) or an in-dashboard support ticket.\n\n[Create your free account](/register) and see the verification process for yourself on your first deposit.',
 array['is winsweeps legit','winsweeps trust and safety'],
 true, now() - interval '120 seconds',
 'Is WinSweeps Legit? Trust & Verification Explained',
 'Is WinSweeps legit? How deposits are manually verified, transactions are recorded on an append-only ledger, and support actually works.'),

('sweepstakes-no-deposit-bonus-explained',
 'Sweepstakes No Deposit Bonus — Does WinSweeps Offer One?',
 'WinSweeps doesn''t offer a true no-deposit bonus — here''s what''s actually free: the welcome bonus, daily rewards and referral coins.',
 E'WinSweeps doesn''t offer a true "no deposit" bonus — like nearly every sweepstakes platform, playing with real credits requires funding your wallet first. But there are genuinely free ways to earn coins and XP without depositing, and it''s worth knowing what those actually are before searching for a no-deposit promo that doesn''t exist here.\n\n## What''s actually free at WinSweeps\n- **Welcome bonus** — 250 coins and 100 XP, granted automatically when you verify your email at signup, no deposit required.\n- **[Daily Reward](/blog/daily-rewards-coins-guide)** — 100 coins and 50 XP every day you claim, with streak bonuses adding up to +50 more coins.\n- **[Referrals](/blog/refer-friends-earn-coins)** — 1,000 coins and 400 XP each time a friend you refer completes their profile and reaches level 2.\n- **Streak milestones** — one-time bonuses of 500, 3,000 and 15,000 coins at 7, 30 and 100-day claim streaks.\n\n## Why sweepstakes platforms rarely offer true no-deposit play\nReal-money-redeemable credits have to come from somewhere. Free coins (like the welcome bonus and daily claims) exist as goodwill and retention rewards, but the credits you load into games and can redeem for cash-outs are funded through deposits — see [how the wallet works](/blog/wallet-deposit-guide-winsweeps) for the full flow.\n\n## What you get when you do deposit\nYour first deposit also qualifies for a [50% bonus](/blog/50-percent-first-deposit-bonus-explained) on top of what you fund — stacking with the free coins above.\n\n## FAQ\n**Does WinSweeps have any no-deposit bonus at all?** No dedicated no-deposit promo, but the welcome bonus (250 coins + 100 XP) is granted free on email verification.\n\n**Can I redeem coins earned from daily claims?** Reward coins and cash-out eligibility work through the same wallet system — see [how cash-out works](/blog/how-cash-out-works-winsweeps) for specifics.\n\n**What''s the fastest way to build a free balance before depositing?** Claim daily rewards consistently and refer friends — both stack over time.\n\n[Create your free account](/register) and claim your welcome bonus.',
 array['sweepstakes no deposit bonus','free sweepstakes coins'],
 true, now() - interval '100 seconds',
 'Sweepstakes No Deposit Bonus Explained | WinSweeps',
 'Does WinSweeps have a no-deposit bonus? Here''s the honest answer, plus what''s genuinely free: welcome bonus, daily rewards and referrals.'),

('sweeps-coins-explained',
 'Sweeps Coins Explained — And How WinSweeps'' System Actually Works',
 'What sweeps coins usually mean on other platforms, and how WinSweeps'' wallet, game credits and coins/XP system actually works instead.',
 E'"Sweeps coins" usually refers to a dual-currency system some sweepstakes casinos use — free-play "gold coins" alongside redeemable "sweeps coins." WinSweeps doesn''t run that two-currency model. Instead, it uses a single real-money wallet plus a separate coins/XP rewards system — here''s exactly how that works.\n\n## The generic "sweeps coins" model (not what WinSweeps uses)\nOn some platforms, gold coins are play-money with no cash value, while sweeps coins are earned alongside them and can be redeemed for cash. If you''re searching for "sweeps coins," this is likely the system you''ve seen elsewhere.\n\n## How WinSweeps actually works\n- **Wallet balance** — real money you deposit, used to [load game credits](/blog/how-to-load-credits-from-wallet).\n- **Game credits** — what you actually play with inside each game, loaded from your wallet.\n- **Cash-out balance** — winnings redeemed from games, paid out by request. See [how cash-out works](/blog/how-cash-out-works-winsweeps).\n- **Coins and XP** — a separate rewards-and-progression currency, earned through [daily claims](/blog/daily-rewards-coins-guide), streaks and referrals. Coins/XP drive your [level and VIP tier](/blog/winsweeps-xp-leveling-explained) and reward multiplier — they aren''t a second redeemable-for-cash currency like "sweeps coins" are elsewhere.\n\n## Why this matters\nIf you were expecting a gold-coins/sweeps-coins split, WinSweeps'' model is simpler: one wallet funds play, winnings redeem to a cash-out balance, and a separate coins/XP system rewards engagement with multipliers rather than cash.\n\n## FAQ\n**Are WinSweeps "coins" the same as redeemable sweeps coins?** No — WinSweeps coins/XP power your level and VIP multiplier; your wallet and cash-out balance are what actually fund play and redemption.\n\n**Can I redeem coins earned from daily rewards for cash?** Coins/XP feed your VIP multiplier rather than being directly cashed out — redemption happens through the wallet/cash-out system instead.\n\n**Is this the same as other sweepstakes sites?** No — models vary by platform; always check how a specific site''s currencies work rather than assuming.\n\n[Create your free account](/register) and see how the wallet and rewards system work together.',
 array['sweeps coins explained','gold coins vs sweeps coins'],
 true, now() - interval '80 seconds',
 'Sweeps Coins Explained | WinSweeps',
 'What are sweeps coins? How the common gold-coins/sweeps-coins model works elsewhere, and how WinSweeps'' wallet and rewards system differs.'),

('boss-fish-jackpot-timing-guide',
 'Boss Fish & Jackpot Timing Guide — Every WinSweeps Game Compared',
 'When to expect Boss encounters and jackpot windows across Fire Kirin, Juwa, Orion Stars, Mafia, Panda Master and Milky Way.',
 E'Boss encounters and jackpot windows follow different timing patterns across the WinSweeps fish table lineup — knowing roughly when to expect one lets you save your strongest shots instead of spending them on small fish. Here''s the timing pattern for each game''s headline event.\n\n## Boss and jackpot timing by game\n- **[Fire Kirin](/games/fire-kirin)** — Dragon Boss appears roughly every 3–5 minutes on standard rooms, 90–120 seconds on premium-tier rooms. See [Fire Kirin pro tips](/blog/fire-kirin-advanced-tips).\n- **[Juwa](/games/juwa)** — Dragon Storm is a timed event (not a fixed interval) that doubles catch values for 30 seconds when it fires. See [Juwa advanced tips](/blog/juwa-tips-and-strategies).\n- **[Orion Stars](/games/orion-stars)** — Deep Space Boss appears roughly every 8–12 minutes and takes 40–80 hits to kill depending on room power. See [Orion Stars strategy](/blog/how-to-win-at-orion-stars).\n- **[Mafia](/games/mafia)** — Street Boss every ~60 seconds; Capo (Syndicate Jackpot) is rarer; Godfather is an ultra-rare single-target event. See [Mafia guide](/blog/mafia-fish-table-game-guide).\n- **[Panda Master](/games/panda-master)** — the Giant Panda Boss is the game''s headline high-value encounter. See [Panda Master tips](/blog/panda-master-tips-strategies).\n- **[Milky Way](/games/milky-way)** — Galactic Storm pays 5× during its active window. See [Milky Way strategies](/blog/milky-way-advanced-strategies).\n\n## General timing principle\nAcross every game above, the pattern is the same: hold your highest cannon power in reserve rather than spending it on small fish, so you''re ready the moment a boss or storm event triggers.\n\n> None of these timers are exact to the second — they''re patterns experienced players track, not guarantees.\n\n## FAQ\n**Which game has the most frequent boss appearances?** Mafia''s Street Boss, roughly every 60 seconds — though it''s the smallest of Mafia''s three boss tiers.\n\n**Which boss event pays the most in one hit?** Orion Stars'' Deep Space Boss kill-shot and Mafia''s Godfather are the largest single-event payouts in the lineup.\n\n**Do these timers apply to every room, or vary by room tier?** They vary — premium-tier rooms tend to trigger boss events more frequently than standard rooms.\n\n[Create your free account](/register) and put these timing patterns to use in your next session.',
 array['boss fish timing','jackpot timing sweepstakes'],
 true, now() - interval '60 seconds',
 'Boss Fish & Jackpot Timing Guide | WinSweeps',
 'Boss encounter and jackpot timing patterns across every major WinSweeps fish table game — Fire Kirin, Juwa, Orion Stars, Mafia and more.'),

('winsweeps-vs-online-casinos',
 'WinSweeps vs Online Casinos — What''s the Difference?',
 'How WinSweeps'' sweepstakes model differs from a licensed online casino, and what that means for where you can play.',
 E'WinSweeps and traditional online casinos both offer slot and fish-table-style games, but they run on different legal models: WinSweeps operates as a sweepstakes platform available broadly across the US, while online casinos require state-by-state gambling licenses and are only legal in a handful of states.\n\n## Quick comparison\n- **WinSweeps (sweepstakes model)** — credits purchased alongside sweepstakes entries, no state gambling license required, available [nationwide](/blog/sweepstakes-games-us-nationwide). See [sweepstakes vs real-money gambling](/blog/sweepstakes-vs-real-money-gambling) for the legal breakdown.\n- **Traditional online casino** — wagers real money directly, requires a state gambling license, legal in only a limited set of states.\n\n## Game style\nBoth formats include fish table and slot-style games with similar mechanics — catch-based shooters, reel-based paylines, bonus rounds and jackpot pools. The gameplay experience is comparable; the legal structure underneath it is what differs.\n\n## Account and deposit process\nWinSweeps funds a single [wallet](/blog/wallet-deposit-guide-winsweeps) via CashApp, Zelle, Chime, PayPal, Venmo, Bitcoin or USDT, then [loads credits](/blog/how-to-load-credits-from-wallet) into any game from that balance — no per-game re-deposit, and no state-license geofencing to navigate.\n\n## FAQ\n**Is WinSweeps a real online casino?** No — it operates under the sweepstakes model, a distinct legal category. See [what are sweepstakes games](/blog/what-are-sweepstakes-games).\n\n**Can I access WinSweeps from any state?** Yes — the sweepstakes model is what allows [nationwide availability](/blog/sweepstakes-games-us-nationwide), unlike licensed online casinos.\n\n**Are winnings redeemable the same way?** Yes — [cash-out works](/blog/how-cash-out-works-winsweeps) similarly to how casino winnings are withdrawn, just governed by sweepstakes rules instead of gambling licensing.\n\n[Create your free account](/register) and see how the WinSweeps model works.',
 array['sweepstakes vs online casino','winsweeps vs casino'],
 true, now() - interval '40 seconds',
 'WinSweeps vs Online Casinos Explained',
 'WinSweeps vs online casinos: how the sweepstakes model differs from licensed real-money gambling, and what it means for player access.')

on conflict (slug) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  content = excluded.content,
  tags = excluded.tags,
  is_published = excluded.is_published,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description;

-- ==========================================
-- MIGRATION: 20260708000098_faq_wallet_flow_update.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0098 · Refresh FAQ copy seeded in 0020 to match the current
-- self-serve wallet flow (it still described the old manual request-form
-- process: upfront deposit amount, 30-minute/business-hours turnaround).
-- ============================================================================

update public.faqs
set answer = 'Create a free WinSweeps account — no deposit required. Then open any game and create your in-game account in one click; your username and password are generated instantly, with no download and no waiting. Add funds to your wallet whenever you are ready, load credits into the game, and start playing.'
where question = 'How do I create a game account and start playing?';

update public.faqs
set answer = 'Deposits are usually confirmed and credited to your wallet in under 2 minutes. Once your wallet balance updates, loading credits into any game is instant.'
where question = 'How long does it take to receive my game credits after depositing?';

update public.faqs
set answer = 'No — WinSweeps creates the in-game account for you instantly when you pick a game from your dashboard. One WinSweeps wallet works across all 12 games, so you never juggle separate logins or balances.'
where question = 'Do I need an existing game account on Fire Kirin, Juwa or other platforms?';

update public.faqs
set answer = 'We accept CashApp, Zelle, Bitcoin, USDT and other crypto options. Choose a method on the deposit page, send your payment, and upload the confirmation — your wallet is credited once it clears, usually within 2 minutes.'
where question = 'Which payment methods do you accept for deposits?';

-- ==========================================
-- MIGRATION: 20260708000099_grant_xp_qualify_referral.sql
-- ==========================================

-- Fix: referral rewards never paid out.
--
-- qualify_referral() requires profile_completed AND level >= 2, but it was
-- only ever invoked once, from trg_profiles_completion (on the
-- profile_completed false->true flip). Every profile starts at level 1 with
-- 0 xp, so that check always failed at completion time, and nothing called
-- qualify_referral again afterward — the referral row stayed 'pending'
-- forever. Re-check on the level-up path in grant_xp, where it belongs.

create or replace function public.grant_xp(
  target_user uuid,
  amount bigint,
  entry_type public.ledger_entry_type,
  ref_type text default null,
  ref_id uuid default null,
  note text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total bigint;
  old_level int;
  new_level int;
begin
  if amount <= 0 then
    select xp into new_total from public.profiles where id = target_user;
    return new_total;
  end if;

  select level into old_level from public.profiles where id = target_user;

  -- Trusted system credit — allow the protected-column write (see 0089).
  perform set_config('app.wallet_update', 'true', true);

  update public.profiles
     set xp = xp + amount
   where id = target_user
   returning xp, level into new_total, new_level;

  if not found then
    raise exception 'profile % not found', target_user;
  end if;

  insert into public.ledger_entries
    (user_id, currency, amount, balance_after, entry_type, reference_type, reference_id, description)
  values
    (target_user, 'xp', amount, new_total, entry_type, ref_type, ref_id, note);

  -- side-effects of leveling: VIP tier re-check + notification + referral re-check
  if new_level > old_level then
    perform public.evaluate_vip_tier(target_user);
    perform public.qualify_referral(target_user);
    insert into public.notifications (user_id, type, title, body, link_url)
    values (
      target_user, 'reward',
      'Level up!',
      format('You reached level %s. Keep the streak alive.', new_level),
      '/dashboard/rewards'
    );
  end if;

  return new_total;
end;
$$;

-- ==========================================
-- MIGRATION: 20260708000100_blog_payment_methods_2min.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0100 · Fix stale "30 minutes during support hours" deposit
-- claim in the seeded payment-methods blog post (0097) — wallet deposits now
-- clear in ~2 minutes, not gated to support hours.
-- ============================================================================

update public.blog_posts
set content = replace(
  content,
  'typically within 30 minutes during support hours.',
  'typically within 2 minutes.'
)
where slug = 'winsweeps-payment-methods-compared';

-- ==========================================
-- MIGRATION: 20260708000101_geo_tampa_telegram.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0101 · Tampa geo listing said "WhatsApp support" — only
-- Telegram (support bot + community group) is a real support channel.
-- ============================================================================

update public.geo_cities
set description_snippet = 'Tampa online fish tables with fast Telegram support'
where slug = 'tampa' and description_snippet = 'Tampa online fish tables with fast WhatsApp support';

-- ==========================================
-- MIGRATION: 20260708000102_blog_post_status.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0102 · Blog post status (draft/scheduled/published/archived)
-- ============================================================================

create type public.blog_post_status as enum ('draft', 'scheduled', 'published', 'archived');

alter table public.blog_posts
  add column status public.blog_post_status not null default 'draft';

update public.blog_posts set status = 'published' where is_published;

-- keep is_published (read directly by RLS policies, marketing.ts and the
-- Telegram admin bot) in sync so none of those call sites need to change.
create or replace function public.sync_blog_post_is_published()
returns trigger
language plpgsql
as $$
begin
  new.is_published := (new.status = 'published');
  return new;
end;
$$;

create trigger trg_blog_posts_sync_is_published
  before insert or update on public.blog_posts
  for each row execute function public.sync_blog_post_is_published();

create index idx_blog_posts_scheduled
  on public.blog_posts (published_at)
  where status = 'scheduled';

-- ==========================================
-- MIGRATION: 20260708000103_geo_hero_image.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0103 · Geo state hero background photo
-- ============================================================================
-- Adds hero_image_url to geo_states (mirrors StateData.heroImageUrl in
-- src/lib/geo-data.ts) and backfills the 7 existing states with a Pexels
-- photo, matched by keyword via scripts/backfill-content-images.mjs.

alter table public.geo_states
  add column hero_image_url text;

update public.geo_states set hero_image_url = v.hero_image_url
from (values
  ('texas', 'https://images.pexels.com/photos/20185085/pexels-photo-20185085.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'),
  ('florida', 'https://images.pexels.com/photos/30147234/pexels-photo-30147234.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'),
  ('georgia', 'https://images.pexels.com/photos/33133726/pexels-photo-33133726.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'),
  ('california', 'https://images.pexels.com/photos/29536601/pexels-photo-29536601.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'),
  ('north-carolina', 'https://images.pexels.com/photos/18931263/pexels-photo-18931263.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'),
  ('ohio', 'https://images.pexels.com/photos/18353982/pexels-photo-18353982.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'),
  ('michigan', 'https://images.pexels.com/photos/12950494/pexels-photo-12950494.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940')
) as v(slug, hero_image_url)
where geo_states.slug = v.slug;

-- ==========================================
-- MIGRATION: 20260712000104_telegram_promo_messages.sql
-- ==========================================

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

-- ==========================================
-- MIGRATION: 20260712000105_player_reviews.sql
-- ==========================================

-- Player-authored reviews shown on the homepage, tied to profiles.
-- One review per player (unique user_id); public reads published rows,
-- players can edit their own review, staff moderate via /admin/reviews.

create table public.player_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 10 and 1000),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.player_reviews enable row level security;

create policy "player reviews public read" on public.player_reviews
  for select using (is_published or user_id = auth.uid() or public.has_permission('cms.manage'));
create policy "player reviews self insert" on public.player_reviews
  for insert with check (user_id = auth.uid());
create policy "player reviews self update" on public.player_reviews
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "player reviews staff update" on public.player_reviews
  for update using (public.has_permission('cms.manage')) with check (public.has_permission('cms.manage'));
create policy "player reviews staff delete" on public.player_reviews
  for delete using (public.has_permission('cms.manage'));

-- Players can edit their own rating/body, but can't self-unhide a review
-- staff hid for spam — same defense-in-depth idea as protect_profile_columns.
create or replace function public.protect_review_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or public.has_permission('cms.manage') then
    return new;
  end if;
  new.is_published := old.is_published;
  return new;
end;
$$;

create trigger trg_player_reviews_protect
  before update on public.player_reviews
  for each row execute function public.protect_review_publish();

-- ==========================================
-- MIGRATION: 20260713000106_banner_popup_placement.sql
-- ==========================================

-- Add a "home_popup" placement so the banners table can drive a dismissible
-- image popup on the homepage, reusing the existing banner schema
-- (image_url, link_url, is_active, priority, starts_at/ends_at).
alter type public.banner_placement add value 'home_popup';

-- ==========================================
-- MIGRATION: 20260713000107_newsletter_campaigns.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0107 · Newsletter campaigns — author, schedule, bulk-send
-- ============================================================================

create table public.newsletter_campaigns (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  subject           text not null,
  eyebrow           text not null default '',
  heading           text not null,
  subhead           text not null default '',
  body              text not null default '',
  cta_label         text not null default 'Play Now',
  cta_href          text not null,
  stat1_value       text,
  stat1_label       text,
  stat2_value       text,
  stat2_label       text,
  stat3_value       text,
  stat3_label       text,
  segment           text not null default 'all' check (segment in ('all', 'test')),
  status            text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_at      timestamptz,
  sent_at           timestamptz,
  sent_count        integer not null default 0,
  failed_count      integer not null default 0,
  total_recipients  integer not null default 0,
  created_by        uuid references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_newsletter_campaigns_due
  on public.newsletter_campaigns (scheduled_at asc)
  where status = 'scheduled';

create trigger trg_newsletter_campaigns_updated_at
  before update on public.newsletter_campaigns
  for each row execute function public.set_updated_at();

alter table public.newsletter_campaigns enable row level security;
-- No policies — service-role only (admin actions + the cron route),
-- matching telegram_promo_messages.

create table public.newsletter_campaign_recipients (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.newsletter_campaigns (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  email         text not null,
  status        text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at       timestamptz,
  error         text,
  created_at    timestamptz not null default now()
);

-- Lets a send tick cheaply claim "next N pending rows for this campaign".
create index idx_newsletter_campaign_recipients_pending
  on public.newsletter_campaign_recipients (campaign_id, status);

alter table public.newsletter_campaign_recipients enable row level security;
-- No policies — service-role only.

-- ── Permission ───────────────────────────────────────────────────────────────

insert into public.permissions (key, name, module, description) values
  ('newsletters.manage', 'Manage newsletters', 'newsletters', 'Author, schedule and send email newsletter campaigns');

-- super_admin's original blanket grant (migration 0013) only covered
-- permissions that existed at seed time — grant explicitly here too.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'newsletters.manage'
where r.key in ('super_admin', 'admin', 'manager');

-- ==========================================
-- MIGRATION: 20260713000108_admin_hard_delete_user.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0108 · Admin hard-delete — bypass flag for append-only guards
-- ============================================================================
-- Hard-deleting a user cascades auth.users -> profiles -> ledger_entries /
-- wallet_ledger, both append-only tables. auth.admin.deleteUser() runs
-- outside PostgREST so it never carries request.jwt.claim.role = service_role,
-- and block_wallet_ledger_mutation() previously had no bypass at all. Add a
-- session-local flag (same shape as the app.wallet_update pattern used for
-- protect_profile_columns) so a dedicated definer function can purge a user
-- for real.

create or replace function public.forbid_mutation()
returns trigger language plpgsql as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or current_setting('app.allow_account_purge', true) = 'true' then
    return coalesce(new, old);
  end if;
  raise exception 'append-only table' using errcode = '42501';
end;
$$;

create or replace function public.block_wallet_ledger_mutation()
returns trigger language plpgsql as $$
begin
  if current_setting('app.allow_account_purge', true) = 'true' then
    return coalesce(new, old);
  end if;
  raise exception 'wallet_ledger is append-only';
end;
$$;

create or replace function public.admin_delete_user_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.allow_account_purge', 'true', true);
  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.admin_delete_user_account(uuid) from public;
grant execute on function public.admin_delete_user_account(uuid) to service_role;

insert into public.permissions (key, name, module, description) values
  ('users.delete', 'Delete user accounts', 'users',
   'Permanently delete a member account and all associated data')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'users.delete'
where r.key = 'super_admin'
on conflict do nothing;

-- ==========================================
-- MIGRATION: 20260713000109_blog_next_gen_gaming_platform.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0109 · Blog post — WinSweeps as a next-gen gaming platform
-- ============================================================================

insert into public.blog_posts (
  slug, title, excerpt, content, cover_image_url, tags, status, is_published, published_at, seo_title, seo_description
) values (
  'winsweeps-next-generation-gaming-platform',
  'WinSweeps: The Next Platform for Online Sweepstakes Gaming',
  'What makes WinSweeps different from the last generation of sweepstakes sites, and exactly how deposits, play and cash-outs work end to end.',
  $t$## A Next-Generation Take on Sweepstakes Gaming

Most sweepstakes gaming sites are just a portal: pick a game, load credits, hope support answers. WinSweeps was built as a full platform instead — a dashboard that tracks your XP and VIP tier, daily and streak rewards, a referral program, and a live leaderboard, wrapped around the same fish-table and slot games players already know.

That's the difference between "a site with games on it" and a platform: your progress, rewards and history all live in one account instead of resetting every time you pick a different game.

## What You Get Inside WinSweeps

- **A real player dashboard** — wallet balance, XP/level, VIP tier progress and claim history in one place
- **Daily and streak rewards** — coming back every day compounds, it isn't just a one-time bonus
- **VIP tiers** — reward multipliers scale up the more you play, up to 2x at the top tier
- **Referral program** — invite friends and earn a 40% referral reward, uncapped
- **A live leaderboard** — weekly rankings with a real prize pool, not just bragging rights
- **A trusted game lineup** — Orion Stars, Game Vault, Juwa, Fire Kirin, Mr All In One, Cash Machine, Cash Frenzy, Panda Master, Vblink, Milky Way, Vegas Sweeps, Ultrapanda, Gameroom and Mafia, all under one account

## How Deposits & Play Actually Work

WinSweeps runs on a wallet model, not a per-game top-up:

1. **Fund your wallet.** Submit a deposit via CashApp, Zelle, or crypto and send your payment confirmation.
2. **Get credited.** Once confirmed, your WinSweeps wallet balance updates — most deposits are approved fast, and every eligible deposit earns a 20% deposit bonus on top.
3. **Load a game.** Move wallet balance into whichever game you want to play (Juwa, Game Vault, Fire Kirin — whatever you're in the mood for). Your login is issued straight to your account.
4. **Play.** Your progress, XP and VIP tier track across every game you load into, not just one.
5. **Redeem your winnings.** Cash out from your game back to your WinSweeps wallet, then request a payout the same way you deposited.

New players get $2 or $3 Free Play to start (eligible players only), and returning players can catch Happy Hour for an extra 20% on deposits during the promo window.

## Getting Started

Message the WinSweeps team to claim your Free Play, make your first deposit, and pick a game — the whole account-to-playing flow usually takes minutes, not days.$t$,
  'https://images.pexels.com/photos/3951449/pexels-photo-3951449.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
  array['winsweeps', 'gaming platform', 'how to deposit', 'sweepstakes', 'getting started'],
  'published',
  true,
  now(),
  'WinSweeps: The Next Platform for Online Sweepstakes Gaming',
  'How WinSweeps works as a full gaming platform, and the exact steps to deposit, play, and cash out.'
)
on conflict (slug) do update set
  title           = excluded.title,
  excerpt         = excluded.excerpt,
  content         = excluded.content,
  cover_image_url = excluded.cover_image_url,
  tags            = excluded.tags,
  status          = excluded.status,
  is_published    = excluded.is_published,
  published_at    = excluded.published_at,
  seo_title       = excluded.seo_title,
  seo_description = excluded.seo_description;

-- ==========================================
-- MIGRATION: 20260720000108_ai_system.sql
-- ==========================================

-- AI automation settings (blog, telegram, chatbot, health logs)
-- Run via Supabase migration or admin-essentials

CREATE TABLE IF NOT EXISTS public.ai_blog_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  topics TEXT[] NOT NULL DEFAULT ARRAY['Online Gaming', 'Fish Table Games', 'Slot Strategies'],
  target_keywords TEXT[] NOT NULL DEFAULT ARRAY['spinora bonus code', 'juwa 777 download'],
  posting_frequency_hours INT NOT NULL DEFAULT 24,
  ai_provider TEXT NOT NULL DEFAULT 'smart_auto',
  ai_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  auto_publish BOOLEAN NOT NULL DEFAULT true,
  auto_telegram_broadcast BOOLEAN NOT NULL DEFAULT true,
  last_generated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_telegram_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_post_blog BOOLEAN NOT NULL DEFAULT true,
  auto_post_promos BOOLEAN NOT NULL DEFAULT true,
  template_header TEXT NOT NULL DEFAULT '🔥 <b>SPINORA GAMING UPDATE</b> 🔥',
  template_footer TEXT NOT NULL DEFAULT '👉 Join now & claim your instant deposit bonus! 🚀',
  autopilot_enabled BOOLEAN NOT NULL DEFAULT true,
  last_autopilot_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_chatbot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  bot_name TEXT NOT NULL DEFAULT 'Spinora AI Assistant',
  system_prompt TEXT NOT NULL DEFAULT 'You are Spinora AI Assistant.',
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT true,
  human_handover_threshold NUMERIC(3, 2) NOT NULL DEFAULT 0.60,
  telegram_escalation_enabled BOOLEAN NOT NULL DEFAULT true,
  personality TEXT NOT NULL DEFAULT 'standard',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_query TEXT NOT NULL,
  bot_response TEXT NOT NULL,
  confidence_score NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
  escalated_to_human BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  health_score INT NOT NULL DEFAULT 100,
  seo_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  cron_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  database_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_blog_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_telegram_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chatbot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; authenticated staff read via app (admin pages use service role)

INSERT INTO public.ai_blog_settings (id) VALUES ('00000000-0000-0000-0000-000000000001') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ai_telegram_settings (id) VALUES ('00000000-0000-0000-0000-000000000001') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ai_chatbot_settings (id) VALUES ('00000000-0000-0000-0000-000000000001') ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_created_at ON public.ai_chat_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_logs_created_at ON public.system_health_logs (created_at DESC);

-- ==========================================
-- MIGRATION: 20260720000200_game_load_rpc_fix.sql
-- ==========================================

-- Safe fix: request_game_load for Supabase projects WITHOUT wallet_ledger
-- (uses wallet_transactions — do NOT run 20260617000085 if wallet_ledger is missing)
-- Run entire file once in Supabase SQL Editor.

-- ── Wallet transaction log (if you never ran wallets.sql) ─────────────────────
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  wallet_type TEXT NOT NULL CHECK (wallet_type IN ('current', 'bonus', 'cashout')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'adjustment')),
  source TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id
  ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at
  ON public.wallet_transactions(created_at DESC);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view own wallet transactions"
  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── game_load_requests load types ───────────────────────────────────────────
ALTER TABLE public.game_load_requests DROP CONSTRAINT IF EXISTS game_load_requests_load_type_check;
ALTER TABLE public.game_load_requests ADD CONSTRAINT game_load_requests_load_type_check
  CHECK (load_type IN ('new_account', 'reload', 'create_account', 'load', 'redeem', 'check_balance'));

ALTER TABLE public.game_load_requests DROP CONSTRAINT IF EXISTS game_load_requests_amount_check;
ALTER TABLE public.game_load_requests ADD CONSTRAINT game_load_requests_amount_check
  CHECK (amount >= 0);

-- ── Replace old 5-arg RPC with 6-arg wallet load ────────────────────────────
DROP FUNCTION IF EXISTS public.request_game_load(text, text, numeric, text, text);
DROP FUNCTION IF EXISTS public.request_game_load(text, text, numeric, text, text, text);

CREATE OR REPLACE FUNCTION public.request_game_load(
  p_game_slug TEXT,
  p_game_name TEXT,
  p_amount NUMERIC,
  p_wallet_type TEXT,
  p_load_type TEXT,
  p_game_username TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance NUMERIC;
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_load_type NOT IN ('new_account', 'reload', 'create_account', 'load') THEN
    RAISE EXCEPTION 'Invalid load type';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.game_load_requests
    WHERE user_id = v_user_id AND game_slug = p_game_slug
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'A request is already in progress for this game';
  END IF;

  IF p_load_type = 'create_account' THEN
    INSERT INTO public.game_load_requests (
      user_id, game_slug, game_name, amount, wallet_type, load_type, status
    )
    VALUES (v_user_id, p_game_slug, p_game_name, 0, 'current', 'create_account', 'pending')
    RETURNING id INTO v_request_id;
    RETURN v_request_id;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_wallet_type NOT IN ('current', 'bonus') THEN
    RAISE EXCEPTION 'Invalid wallet type';
  END IF;

  IF p_load_type IN ('reload', 'load')
     AND (p_game_username IS NULL OR trim(p_game_username) = '') THEN
    RAISE EXCEPTION 'Game username required for load';
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);

  IF p_wallet_type = 'current' THEN
    SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = v_user_id FOR UPDATE;
    IF v_balance IS NULL OR v_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;
    UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = v_user_id;
  ELSE
    SELECT bonus_wallet INTO v_balance FROM public.profiles WHERE id = v_user_id FOR UPDATE;
    IF v_balance IS NULL OR v_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient bonus wallet balance';
    END IF;
    UPDATE public.profiles SET bonus_wallet = bonus_wallet - p_amount WHERE id = v_user_id;
  END IF;

  -- Log debit: wallet_transactions (this project) — NOT wallet_ledger
  INSERT INTO public.wallet_transactions (
    user_id, amount, wallet_type, transaction_type, source, description, created_by
  )
  VALUES (
    v_user_id,
    p_amount,
    p_wallet_type,
    'debit',
    'game_load',
    format('Load $%s to %s', p_amount, p_game_name),
    v_user_id
  );

  INSERT INTO public.game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type, game_username, status
  )
  VALUES (
    v_user_id,
    p_game_slug,
    p_game_name,
    p_amount,
    p_wallet_type,
    CASE WHEN p_load_type = 'reload' THEN 'load' ELSE p_load_type END,
    NULLIF(trim(p_game_username), ''),
    'pending'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_game_load(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

-- ==========================================
-- MIGRATION: 20260720000300_kyc_and_ai_system.sql
-- ==========================================

-- KYC + AI automation tables (safe to run once in Supabase SQL Editor)
-- Fixes: KYC not saving, AI admin settings/bot/blog errors

-- ── KYC on profiles ───────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'unverified';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_document_url TEXT;

-- ── KYC submissions (replaces local JSON file) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  user_name TEXT,
  document_name TEXT NOT NULL DEFAULT 'government_id.jpg',
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user_id ON public.kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status ON public.kyc_submissions(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_submissions_user_unique ON public.kyc_submissions(user_id);

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own kyc" ON public.kyc_submissions;
CREATE POLICY "users read own kyc"
  ON public.kyc_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Inserts/updates via service role (server actions) only
DROP POLICY IF EXISTS "no direct kyc insert" ON public.kyc_submissions;
CREATE POLICY "no direct kyc insert"
  ON public.kyc_submissions FOR INSERT TO authenticated
  WITH CHECK (false);

-- ── AI automation (from ai_system migration) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_blog_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  topics TEXT[] NOT NULL DEFAULT ARRAY['Online Gaming', 'Fish Table Games', 'Slot Strategies'],
  target_keywords TEXT[] NOT NULL DEFAULT ARRAY['spinora bonus code', 'juwa 777 download'],
  posting_frequency_hours INT NOT NULL DEFAULT 24,
  ai_provider TEXT NOT NULL DEFAULT 'smart_auto',
  ai_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  auto_publish BOOLEAN NOT NULL DEFAULT true,
  auto_telegram_broadcast BOOLEAN NOT NULL DEFAULT true,
  last_generated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_telegram_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_post_blog BOOLEAN NOT NULL DEFAULT true,
  auto_post_promos BOOLEAN NOT NULL DEFAULT true,
  template_header TEXT NOT NULL DEFAULT '🔥 <b>SPINORA GAMING UPDATE</b> 🔥',
  template_footer TEXT NOT NULL DEFAULT '👉 Join now & claim your instant deposit bonus! 🚀',
  autopilot_enabled BOOLEAN NOT NULL DEFAULT true,
  last_autopilot_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_chatbot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  bot_name TEXT NOT NULL DEFAULT 'Spinora AI Assistant',
  system_prompt TEXT NOT NULL DEFAULT 'You are Spinora AI Assistant.',
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT true,
  human_handover_threshold NUMERIC(3, 2) NOT NULL DEFAULT 0.60,
  telegram_escalation_enabled BOOLEAN NOT NULL DEFAULT true,
  personality TEXT NOT NULL DEFAULT 'standard',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_query TEXT NOT NULL,
  bot_response TEXT NOT NULL,
  confidence_score NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
  escalated_to_human BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  health_score INT NOT NULL DEFAULT 100,
  seo_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  cron_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  database_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_blog_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_telegram_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chatbot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;

INSERT INTO public.ai_blog_settings (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ai_telegram_settings (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ai_chatbot_settings (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_created_at ON public.ai_chat_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_logs_created_at ON public.system_health_logs (created_at DESC);

-- ==========================================
-- MIGRATION: 20260720000400_game_redeem_fix.sql
-- ==========================================

-- Redeem fix: queue redeems reliably + credit Deposit Redeem (cashout_wallet) on bot completion
-- Uses wallet_transactions (NOT wallet_ledger). Safe to run once in Supabase SQL Editor.

-- Helper: resolve game UUID by slug (returns NULL if games table missing or slug unknown)
CREATE OR REPLACE FUNCTION public.game_id_for_slug(p_slug TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.games') IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN (SELECT id FROM public.games WHERE slug = p_slug LIMIT 1);
END;
$$;

-- ── Profile redeem wallets ────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cashout_wallet NUMERIC(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bonus_redeem_wallet NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- ── game_load_requests redeem column ──────────────────────────────────────────
ALTER TABLE public.game_load_requests
  ADD COLUMN IF NOT EXISTS redeem_all BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.game_load_requests DROP CONSTRAINT IF EXISTS game_load_requests_load_type_check;
ALTER TABLE public.game_load_requests ADD CONSTRAINT game_load_requests_load_type_check
  CHECK (load_type IN ('new_account', 'reload', 'create_account', 'load', 'redeem', 'check_balance'));

-- ── wallet_transactions types (cashout + bonus_redeem for redeem credits) ─────
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_wallet_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_wallet_type_check
  CHECK (wallet_type IN ('current', 'bonus', 'cashout', 'bonus_redeem'));

-- Allow payout source
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_source_check;
-- Only add if you have a source check; otherwise skip silently
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallet_transactions_source_check'
      AND conrelid = 'public.wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.wallet_transactions DROP CONSTRAINT wallet_transactions_source_check;
  END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ── Deposit rollover helper (redeem validation) ─────────────────────────────
DROP FUNCTION IF EXISTS public.get_deposit_rollover_totals(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.get_deposit_rollover_totals(
  p_user_id UUID,
  p_game_slug TEXT
)
RETURNS TABLE (active_load_amount NUMERIC, redeemed_since_active NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_amount NUMERIC := 0;
  v_active_at TIMESTAMPTZ;
  v_redeemed_since NUMERIC := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT amount, completed_at
  INTO v_active_amount, v_active_at
  FROM public.game_load_requests
  WHERE user_id = p_user_id
    AND game_slug = p_game_slug
    AND wallet_type = 'current'
    AND load_type IN ('load', 'reload')
    AND status = 'completed'
  ORDER BY completed_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF v_active_amount IS NULL OR v_active_amount <= 0 THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_redeemed_since
  FROM public.game_load_requests
  WHERE user_id = p_user_id
    AND game_slug = p_game_slug
    AND wallet_type = 'current'
    AND load_type = 'redeem'
    AND status = 'completed'
    AND (v_active_at IS NULL OR completed_at >= v_active_at);

  RETURN QUERY SELECT v_active_amount, v_redeemed_since;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_deposit_rollover_totals(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_deposit_rollover_totals(UUID, TEXT) TO service_role;

-- ── Queue redeem (pull from game panel → pending bot job) ─────────────────────
DROP FUNCTION IF EXISTS public.request_game_redeem(TEXT, TEXT, NUMERIC, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.request_game_redeem(TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.request_game_redeem(
  p_game_slug TEXT,
  p_game_name TEXT,
  p_amount NUMERIC,
  p_game_username TEXT,
  p_redeem_all BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_game_username IS NULL OR trim(p_game_username) = '' THEN
    RAISE EXCEPTION 'Game username required for redeem';
  END IF;

  IF NOT p_redeem_all AND (p_amount IS NULL OR p_amount <= 0) THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.game_load_requests
    WHERE user_id = v_user_id AND game_slug = p_game_slug
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'A request is already in progress for this game';
  END IF;

  INSERT INTO public.game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type,
    game_username, redeem_all, status
  )
  VALUES (
    v_user_id,
    p_game_slug,
    p_game_name,
    CASE WHEN p_redeem_all THEN 0 ELSE p_amount END,
    'current',
    'redeem',
    NULLIF(trim(p_game_username), ''),
    p_redeem_all,
    'pending'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_game_redeem(TEXT, TEXT, NUMERIC, TEXT, BOOLEAN) TO authenticated;

-- ── Bot completion: credit cashout_wallet on successful redeem ────────────────
DROP FUNCTION IF EXISTS public.complete_game_load(UUID, BOOLEAN, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.complete_game_load(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.complete_game_load(
  p_request_id UUID,
  p_success BOOLEAN,
  p_game_username TEXT DEFAULT NULL,
  p_game_password TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_redeemed_amount NUMERIC DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
  v_credit NUMERIC;
  v_dest_wallet TEXT;
  v_game_id UUID;
BEGIN
  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE id = p_request_id
    AND status IN ('pending', 'processing')
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN;
  END IF;

  v_game_id := public.game_id_for_slug(v_row.game_slug);

  -- Refund failed loads (debit happened at queue time for load/reload)
  IF NOT p_success AND v_row.load_type IN ('load', 'reload') AND COALESCE(v_row.amount, 0) > 0 THEN
    PERFORM set_config('app.wallet_update', 'true', true);
    IF v_row.wallet_type = 'bonus' THEN
      UPDATE public.profiles SET bonus_wallet = bonus_wallet + v_row.amount WHERE id = v_row.user_id;
    ELSE
      UPDATE public.profiles SET wallet_balance = wallet_balance + v_row.amount WHERE id = v_row.user_id;
    END IF;
    INSERT INTO public.wallet_transactions (
      user_id, amount, wallet_type, transaction_type, source, description, created_by
    )
    VALUES (
      v_row.user_id, v_row.amount, v_row.wallet_type, 'credit', 'game_load_refund',
      format('Refund failed load $%s to %s', v_row.amount, v_row.game_name), v_row.user_id
    );
  END IF;

  IF p_success AND v_row.load_type = 'redeem' THEN
    v_credit := COALESCE(p_redeemed_amount, NULLIF(v_row.amount, 0));
    IF v_credit IS NULL OR v_credit <= 0 THEN
      RAISE EXCEPTION 'Redeem completion requires a positive amount';
    END IF;

    v_dest_wallet := CASE WHEN v_row.wallet_type = 'bonus' THEN 'bonus_redeem' ELSE 'cashout' END;

    PERFORM set_config('app.wallet_update', 'true', true);

    IF v_dest_wallet = 'bonus_redeem' THEN
      UPDATE public.profiles
      SET bonus_redeem_wallet = bonus_redeem_wallet + v_credit
      WHERE id = v_row.user_id;
    ELSE
      UPDATE public.profiles
      SET cashout_wallet = cashout_wallet + v_credit
      WHERE id = v_row.user_id;
    END IF;

    INSERT INTO public.wallet_transactions (
      user_id, amount, wallet_type, transaction_type, source, description, created_by
    )
    VALUES (
      v_row.user_id,
      v_credit,
      v_dest_wallet,
      'credit',
      'game_redeem',
      format('Redeem $%s from %s', v_credit, v_row.game_name),
      v_row.user_id
    );

    IF v_game_id IS NOT NULL THEN
      UPDATE public.game_accounts
      SET credits_balance = GREATEST(0, credits_balance - v_credit),
          last_synced_at = NOW(),
          updated_at = NOW()
      WHERE user_id = v_row.user_id AND game_id = v_game_id;
    ELSIF to_regclass('public.game_accounts') IS NOT NULL AND v_row.game_username IS NOT NULL THEN
      UPDATE public.game_accounts
      SET credits_balance = GREATEST(0, credits_balance - v_credit),
          last_synced_at = NOW(),
          updated_at = NOW()
      WHERE user_id = v_row.user_id AND game_username = v_row.game_username;
    END IF;
  END IF;

  IF p_success AND v_row.load_type = 'check_balance' AND p_redeemed_amount IS NOT NULL THEN
    IF v_game_id IS NOT NULL THEN
      UPDATE public.game_accounts
      SET credits_balance = p_redeemed_amount, last_synced_at = NOW(), updated_at = NOW()
      WHERE user_id = v_row.user_id AND game_id = v_game_id;
    ELSIF to_regclass('public.game_accounts') IS NOT NULL AND v_row.game_username IS NOT NULL THEN
      UPDATE public.game_accounts
      SET credits_balance = p_redeemed_amount, last_synced_at = NOW(), updated_at = NOW()
      WHERE user_id = v_row.user_id AND game_username = v_row.game_username;
    END IF;
  END IF;

  UPDATE public.game_load_requests
  SET
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    game_username = COALESCE(p_game_username, game_username),
    game_password = COALESCE(p_game_password, game_password),
    amount = CASE
      WHEN p_success AND v_row.load_type = 'redeem' THEN COALESCE(p_redeemed_amount, amount)
      WHEN p_success AND v_row.load_type = 'check_balance' THEN COALESCE(p_redeemed_amount, amount)
      ELSE amount
    END,
    error_message = p_error_message,
    completed_at = CASE WHEN p_success THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_game_load(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC) TO service_role;

-- ── Admin cash-out payout (debit Deposit Redeem / cashout_wallet) ─────────────
DROP FUNCTION IF EXISTS public.admin_payout_cashout(UUID, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.admin_payout_cashout(
  p_user UUID,
  p_amount NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bal NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payout amount must be positive';
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);

  UPDATE public.profiles
  SET cashout_wallet = cashout_wallet - p_amount
  WHERE id = p_user AND cashout_wallet >= p_amount
  RETURNING cashout_wallet INTO v_bal;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient cash-out balance';
  END IF;

  INSERT INTO public.wallet_transactions (
    user_id, amount, wallet_type, transaction_type, source, description, created_by
  )
  VALUES (
    p_user,
    p_amount,
    'cashout',
    'debit',
    'payout',
    COALESCE(NULLIF(trim(p_note), ''), 'Cash-out payout'),
    p_user
  );

  RETURN v_bal;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_payout_cashout(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_payout_cashout(UUID, NUMERIC, TEXT) TO service_role;

-- ── Bot claim next pending job (required for redeem/load bots) ────────────────
CREATE OR REPLACE FUNCTION public.claim_next_game_load(p_game_slug TEXT)
RETURNS SETOF public.game_load_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
BEGIN
  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE game_slug = p_game_slug AND status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_row.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.game_load_requests
  SET status = 'processing',
      bot_attempts = COALESCE(bot_attempts, 0) + 1,
      updated_at = NOW()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN NEXT v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_next_game_load(TEXT) TO service_role;

-- ==========================================
-- MIGRATION: 20260720000500_redeem_kyc_wallet_trigger.sql
-- ==========================================

-- Redeem + KYC + wallet trigger fix (run once in Supabase SQL Editor)
-- Ensures: KYC required for redeem, wallet credits work, bots can complete redeems

-- ── Wallet columns ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cashout_wallet NUMERIC(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'unverified';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bonus_redeem_wallet NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- ── Protect wallet columns (must allow service-role SQL functions to update) ───
CREATE OR REPLACE FUNCTION public.protect_wallet_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    OLD.wallet_balance IS DISTINCT FROM NEW.wallet_balance
    OR OLD.bonus_wallet IS DISTINCT FROM NEW.bonus_wallet
    OR OLD.cashout_wallet IS DISTINCT FROM NEW.cashout_wallet
    OR OLD.bonus_redeem_wallet IS DISTINCT FROM NEW.bonus_redeem_wallet
  ) THEN
    IF current_setting('app.wallet_update', true) = 'true'
       OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RETURN NEW;
    END IF;
    NEW.wallet_balance := OLD.wallet_balance;
    NEW.bonus_wallet := OLD.bonus_wallet;
    NEW.cashout_wallet := OLD.cashout_wallet;
    NEW.bonus_redeem_wallet := OLD.bonus_redeem_wallet;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_wallet_columns_trigger ON public.profiles;
CREATE TRIGGER protect_wallet_columns_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_wallet_columns();

-- ── request_game_redeem with KYC gate ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_game_redeem(
  p_game_slug TEXT,
  p_game_name TEXT,
  p_amount NUMERIC,
  p_game_username TEXT,
  p_redeem_all BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_kyc TEXT;
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT kyc_status INTO v_kyc FROM public.profiles WHERE id = v_user_id;
  IF v_kyc IS DISTINCT FROM 'verified' THEN
    IF v_kyc = 'pending' THEN
      RAISE EXCEPTION 'KYC under review — admin must approve your ID before redeeming';
    END IF;
    RAISE EXCEPTION 'KYC Verification Required — upload ID at Dashboard → KYC before redeeming';
  END IF;

  IF p_game_username IS NULL OR trim(p_game_username) = '' THEN
    RAISE EXCEPTION 'Game username required for redeem';
  END IF;

  IF NOT p_redeem_all AND (p_amount IS NULL OR p_amount <= 0) THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.game_load_requests
    WHERE user_id = v_user_id AND game_slug = p_game_slug
      AND load_type IN ('load', 'reload', 'redeem')
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'A load or redeem is already in progress for this game';
  END IF;

  INSERT INTO public.game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type,
    game_username, redeem_all, status
  )
  VALUES (
    v_user_id,
    p_game_slug,
    p_game_name,
    CASE WHEN p_redeem_all THEN 0 ELSE p_amount END,
    'current',
    'redeem',
    NULLIF(trim(p_game_username), ''),
    p_redeem_all,
    'pending'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_game_redeem(TEXT, TEXT, NUMERIC, TEXT, BOOLEAN) TO authenticated;

-- ── Bot-safe redeem credit (fallback if complete_game_load fails) ─────────────
CREATE OR REPLACE FUNCTION public.credit_redeem_completion(
  p_request_id UUID,
  p_redeemed_amount NUMERIC,
  p_game_username TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
  v_credit NUMERIC;
BEGIN
  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_row.id IS NULL OR v_row.load_type <> 'redeem' THEN
    RAISE EXCEPTION 'Invalid redeem request';
  END IF;

  IF v_row.status = 'completed' THEN
    RETURN;
  END IF;

  v_credit := COALESCE(p_redeemed_amount, NULLIF(v_row.amount, 0));
  IF v_credit IS NULL OR v_credit <= 0 THEN
    RAISE EXCEPTION 'Redeem amount must be positive';
  END IF;

  PERFORM set_config('app.wallet_update', 'true', true);

  UPDATE public.profiles
  SET cashout_wallet = cashout_wallet + v_credit
  WHERE id = v_row.user_id;

  INSERT INTO public.wallet_transactions (
    user_id, amount, wallet_type, transaction_type, source, description, created_by
  )
  VALUES (
    v_row.user_id, v_credit, 'cashout', 'credit', 'game_redeem',
    format('Redeem $%s from %s', v_credit, v_row.game_name), v_row.user_id
  );

  UPDATE public.game_load_requests
  SET
    status = 'completed',
    amount = v_credit,
    game_username = COALESCE(p_game_username, game_username),
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_redeem_completion(UUID, NUMERIC, TEXT) TO service_role;

-- ==========================================
-- MIGRATION: 20260721000100_seed_telegram_promo_messages.sql
-- ==========================================

-- ============================================================================
-- WinSweeps · 0100 · Seed Telegram promo message pool with high-converting templates
-- ============================================================================

insert into public.telegram_promo_messages (text, link, image_url, is_active) values
  ('🎉 <b>WELCOME BONUS MATCH: 50% FREE PLAY</b> 🎉

New to Spinora? Sign up today and get an instant <b>50% bonus match</b> on your first deposit! Play top games like Juwa, Fire Kirin, and Game Vault with extra credits.

⚡ <b>How to claim:</b>
1. Register a free account.
2. Submit a deposit from $5.
3. Get your credentials with loaded credits in 5 minutes!',
   'https://spinoracasinos.com/register',
   'https://spinoracasinos.com/images/promos/spinora_gift_three.jpg',
   true),

  ('🪙 <b>CRYPTO SPEED LOAD: 100% MATCH</b> 🪙

Load your game wallet using <b>USDT (TRC20) or Bitcoin</b> and get a <b>double value match</b> up to $500! Safe, secure, and completed in under 5 minutes.

🚀 Join the future of gaming and claim your crypto match today!',
   'https://spinoracasinos.com/dashboard/deposit',
   'https://spinoracasinos.com/images/promos/spinora_slot_fifteen.jpg',
   true),

  ('🎡 <b>DAILY WHEEL SPIN IS ACTIVE</b> 🎡

Log in every 24 hours to spin the <b>Spinora Fortune Wheel</b>! Win up to <b>$50.00 in free play credits</b>, XP boosts, and VIP loyalty coins.

✨ No deposit required for your daily spin. Start spinning now!',
   'https://spinoracasinos.com/spin',
   'https://spinoracasinos.com/images/promos/spinora_model_five.jpg',
   true),

  ('💫 <b>ORION STARS: GALACTIC FISH MULTIPLIERS</b> 💫

Dive into the Orion Stars fish shooter table and hunt the legendary celestial bosses! Earn up to <b>500x weapon multipliers</b> and cash out in under 15 minutes.

📲 Get your dedicated Orion Stars account credentials instantly!',
   'https://spinoracasinos.com/games/orion-stars',
   'https://spinoracasinos.com/images/promos/spinora_dealer_ten.jpg',
   true);

-- ==========================================
-- MIGRATION: 20260721000200_blog_telegram_sent_status.sql
-- ==========================================

-- ============================================================================
-- Spinora · 0200 · Add telegram_sent status tracking to blog_posts
-- ============================================================================

ALTER TABLE public.blog_posts 
  ADD COLUMN IF NOT EXISTS telegram_sent boolean NOT NULL DEFAULT false;

-- Mark all existing posts as sent so the cron doesn't broadcast historical posts
UPDATE public.blog_posts SET telegram_sent = true;

-- ==========================================
-- MIGRATION: 20260721000300_deposit_wallet_credit.sql
-- ==========================================

-- Credit Total Deposit wallet when admin confirms a deposit request.
-- Run once in Supabase SQL Editor after deposit-requests.sql and wallets.sql

ALTER TABLE public.deposit_requests
  ADD COLUMN IF NOT EXISTS wallet_credited BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.complete_deposit_request(
  p_deposit_id UUID,
  p_amount NUMERIC DEFAULT NULL,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.deposit_requests;
  v_amount NUMERIC;
  v_method TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v_row
  FROM public.deposit_requests
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Deposit request not found';
  END IF;

  IF v_row.wallet_credited OR v_row.status = 'completed' THEN
    RAISE EXCEPTION 'Deposit already completed';
  END IF;

  v_amount := COALESCE(p_amount, v_row.amount);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Deposit amount is required';
  END IF;

  v_amount := round(v_amount::numeric, 2);

  PERFORM set_config('app.wallet_update', 'true', true);

  UPDATE public.profiles
  SET wallet_balance = wallet_balance + v_amount
  WHERE id = v_row.user_id;

  v_method := COALESCE(v_row.payment_method, 'payment');

  INSERT INTO public.wallet_transactions (
    user_id, amount, wallet_type, transaction_type, source, description, created_by
  )
  VALUES (
    v_row.user_id,
    v_amount,
    'current',
    'credit',
    'deposit',
    format('Deposit confirmed — $%s via %s (%s)', v_amount, v_method, v_row.game_name),
    auth.uid()
  );

  UPDATE public.deposit_requests
  SET
    status = 'completed',
    amount = v_amount,
    wallet_credited = true,
    admin_notes = COALESCE(NULLIF(trim(p_admin_notes), ''), admin_notes),
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_deposit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_deposit_request(UUID, NUMERIC, TEXT) TO authenticated;

-- ==========================================
-- MIGRATION: 20260722000100_fix_game_accounts_credentials.sql
-- ==========================================

-- Migration: 20260722000100_fix_game_accounts_credentials.sql
-- Adds game_password support to game_accounts and updates complete_game_load RPC

ALTER TABLE public.game_accounts
  ADD COLUMN IF NOT EXISTS game_password TEXT;

CREATE OR REPLACE FUNCTION public.complete_game_load(
  p_request_id UUID,
  p_success BOOLEAN,
  p_game_username TEXT DEFAULT NULL,
  p_game_password TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_redeemed_amount NUMERIC DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
  v_credit NUMERIC;
  v_dest_wallet TEXT;
  v_game_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE id = p_request_id
    AND status IN ('pending', 'processing')
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN;
  END IF;

  v_game_id := public.game_id_for_slug(v_row.game_slug);

  -- Refund failed loads (debit happened at queue time for load/reload)
  IF NOT p_success AND v_row.load_type IN ('load', 'reload') AND COALESCE(v_row.amount, 0) > 0 THEN
    PERFORM set_config('app.wallet_update', 'true', true);
    IF v_row.wallet_type = 'bonus' THEN
      UPDATE public.profiles SET bonus_wallet = bonus_wallet + v_row.amount WHERE id = v_row.user_id;
    ELSE
      UPDATE public.profiles SET wallet_balance = wallet_balance + v_row.amount WHERE id = v_row.user_id;
    END IF;
    INSERT INTO public.wallet_transactions (
      user_id, amount, wallet_type, transaction_type, source, description, created_by
    )
    VALUES (
      v_row.user_id, v_row.amount, v_row.wallet_type, 'credit', 'game_load_refund',
      format('Refund failed load $%s to %s', v_row.amount, v_row.game_name), v_row.user_id
    );
  END IF;

  IF p_success THEN
    -- Account Creation / New Account Insertion into game_accounts
    IF v_row.load_type IN ('create_account', 'new_account') AND v_game_id IS NOT NULL THEN
      INSERT INTO public.game_accounts (
        user_id, game_id, game_username, game_password, credits_balance, last_synced_at, updated_at
      )
      VALUES (
        v_row.user_id,
        v_game_id,
        COALESCE(p_game_username, v_row.game_username, 'player'),
        COALESCE(p_game_password, v_row.game_password),
        0,
        v_now,
        v_now
      )
      ON CONFLICT (user_id, game_id) DO UPDATE
        SET game_username = EXCLUDED.game_username,
            game_password = COALESCE(EXCLUDED.game_password, game_accounts.game_password),
            updated_at = v_now;

    ELSIF v_row.load_type IN ('load', 'reload') AND v_game_id IS NOT NULL THEN
      UPDATE public.game_accounts
      SET credits_balance = credits_balance + COALESCE(v_row.amount, 0),
          last_synced_at = v_now,
          updated_at = v_now
      WHERE user_id = v_row.user_id AND game_id = v_game_id;

    ELSIF v_row.load_type = 'redeem' THEN
      v_credit := COALESCE(p_redeemed_amount, NULLIF(v_row.amount, 0));
      IF v_credit IS NULL OR v_credit <= 0 THEN
        RAISE EXCEPTION 'Redeem completion requires a positive amount';
      END IF;

      v_dest_wallet := CASE WHEN v_row.wallet_type = 'bonus' THEN 'bonus_redeem' ELSE 'cashout' END;

      PERFORM set_config('app.wallet_update', 'true', true);

      IF v_dest_wallet = 'bonus_redeem' THEN
        UPDATE public.profiles
        SET bonus_redeem_wallet = bonus_redeem_wallet + v_credit
        WHERE id = v_row.user_id;
      ELSE
        UPDATE public.profiles
        SET cashout_wallet = cashout_wallet + v_credit
        WHERE id = v_row.user_id;
      END IF;

      INSERT INTO public.wallet_transactions (
        user_id, amount, wallet_type, transaction_type, source, description, created_by
      )
      VALUES (
        v_row.user_id,
        v_credit,
        v_dest_wallet,
        'credit',
        'game_redeem',
        format('Redeem $%s from %s', v_credit, v_row.game_name),
        v_row.user_id
      );

      IF v_game_id IS NOT NULL THEN
        UPDATE public.game_accounts
        SET credits_balance = GREATEST(0, credits_balance - v_credit),
            last_synced_at = v_now,
            updated_at = v_now
        WHERE user_id = v_row.user_id AND game_id = v_game_id;
      ELSIF to_regclass('public.game_accounts') IS NOT NULL AND v_row.game_username IS NOT NULL THEN
        UPDATE public.game_accounts
        SET credits_balance = GREATEST(0, credits_balance - v_credit),
            last_synced_at = v_now,
            updated_at = v_now
        WHERE user_id = v_row.user_id AND game_username = v_row.game_username;
      END IF;

    ELSIF v_row.load_type = 'check_balance' AND p_redeemed_amount IS NOT NULL THEN
      IF v_game_id IS NOT NULL THEN
        UPDATE public.game_accounts
        SET credits_balance = p_redeemed_amount, last_synced_at = v_now, updated_at = v_now
        WHERE user_id = v_row.user_id AND game_id = v_game_id;
      ELSIF to_regclass('public.game_accounts') IS NOT NULL AND v_row.game_username IS NOT NULL THEN
        UPDATE public.game_accounts
        SET credits_balance = p_redeemed_amount, last_synced_at = v_now, updated_at = v_now
        WHERE user_id = v_row.user_id AND game_username = v_row.game_username;
      END IF;
    END IF;
  END IF;

  UPDATE public.game_load_requests
  SET
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    game_username = COALESCE(p_game_username, game_username),
    game_password = COALESCE(p_game_password, game_password),
    amount = CASE
      WHEN p_success AND v_row.load_type IN ('redeem', 'check_balance') THEN COALESCE(p_redeemed_amount, amount)
      ELSE amount
    END,
    error_message = p_error_message,
    completed_at = CASE WHEN p_success THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_game_load(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC) TO service_role;

-- ============================================================================
-- SECTION B END
-- ============================================================================
