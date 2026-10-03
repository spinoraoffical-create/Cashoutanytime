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
