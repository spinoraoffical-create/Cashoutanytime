-- Disposable schema for the stale-load hold. Not the hosted database.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  instance_id uuid,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id),
  wallet_balance numeric not null default 0,
  bonus_wallet numeric not null default 0,
  cashout_wallet numeric not null default 0,
  bonus_redeem_wallet numeric not null default 0
);

create or replace function public.create_profile_for_user()
returns trigger language plpgsql as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;

drop trigger if exists create_profile_for_user on auth.users;
create trigger create_profile_for_user
  after insert on auth.users
  for each row execute function public.create_profile_for_user();

create table if not exists public.wallet_ledger (
  id bigserial primary key,
  user_id uuid,
  amount numeric,
  kind text
);

create or replace function public.refuse_wallet_write()
returns trigger language plpgsql as $$
begin
  raise exception 'wallet write is not allowed in this test';
end $$;

drop trigger if exists profiles_no_wallet_write on public.profiles;
create trigger profiles_no_wallet_write
  before update on public.profiles
  for each row execute function public.refuse_wallet_write();

drop trigger if exists ledger_no_insert on public.wallet_ledger;
create trigger ledger_no_insert
  before insert on public.wallet_ledger
  for each row execute function public.refuse_wallet_write();

create or replace function public.credit_wallet(p_user uuid, p_amount numeric)
returns void language plpgsql as $$
begin
  raise exception 'credit_wallet must not run';
end $$;

create or replace function public.debit_wallet(p_user uuid, p_amount numeric)
returns void language plpgsql as $$
begin
  raise exception 'debit_wallet must not run';
end $$;

create or replace function public.refund_game_load_wallet(p_request uuid)
returns void language plpgsql as $$
begin
  raise exception 'refund_game_load_wallet must not run';
end $$;

create table if not exists public.game_load_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  game_slug text not null,
  game_name text not null,
  amount numeric not null default 0,
  wallet_type text not null default 'current',
  load_type text not null,
  status text not null,
  admin_notes text,
  game_api_debited boolean not null default false,
  wallet_refunded boolean not null default false,
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
end $roles$;
