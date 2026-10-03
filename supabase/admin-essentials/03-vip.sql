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
