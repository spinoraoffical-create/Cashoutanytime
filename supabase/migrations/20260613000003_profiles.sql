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
