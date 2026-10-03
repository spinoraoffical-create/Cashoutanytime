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
