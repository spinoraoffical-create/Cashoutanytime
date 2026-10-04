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
