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
