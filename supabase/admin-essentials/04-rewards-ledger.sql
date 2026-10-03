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
    insert into public.notifications (user_id, title, message, type, is_read)
    values (
      target_user,
      'Level up!',
      format('You reached level %s. Keep the streak alive.', new_level),
      'success',
      false
    );
  end if;

  return new_total;
end;
$$;
