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
  if coalesce(p.is_suspended, false) then
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

  if exists (select 1 from public.profiles where id = uid and coalesce(is_suspended, false)) then
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

  insert into public.notifications (user_id, title, message, type, is_read)
  values (uid, 'Bonus claimed',
          format('%s credited to your account.', promo.title), 'promo', false);

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

drop trigger if exists trg_profiles_completion on public.profiles;
create trigger trg_profiles_completion
  after update of profile_completed on public.profiles
  for each row execute function public.complete_profile_side_effects();
