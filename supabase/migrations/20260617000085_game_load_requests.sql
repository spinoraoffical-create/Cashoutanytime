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
