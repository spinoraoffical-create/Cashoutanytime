-- Fix: deposits/loads failed to move wallet_balance ("crediting the wallet
-- failed" / "column protected"). credit_wallet/debit_wallet relied on the
-- protect_profile_columns trigger recognizing service_role via
-- current_setting('request.jwt.claim.role') — which current PostgREST often
-- leaves empty inside a SECURITY DEFINER RPC, so the wallet_balance write was
-- blocked. complete_game_load / admin_payout_cashout already dodge this by
-- setting the app.wallet_update flag the trigger honors. Do the same here.

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
  perform set_config('app.wallet_update', 'true', true);
  update public.profiles set wallet_balance = wallet_balance + p_amount
    where id = p_user
    returning wallet_balance into new_balance;
  if new_balance is null then raise exception 'user not found'; end if;
  insert into public.wallet_ledger (user_id, amount, balance_after, kind, wallet_type, description, ref_id)
    values (p_user, p_amount, new_balance, p_kind, 'current', p_desc, p_ref);
  return new_balance;
end;
$$;

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
  perform set_config('app.wallet_update', 'true', true);
  update public.profiles set wallet_balance = wallet_balance - p_amount
    where id = p_user and wallet_balance >= p_amount
    returning wallet_balance into new_balance;
  if new_balance is null then
    raise exception 'insufficient funds' using errcode = 'P0001';
  end if;
  insert into public.wallet_ledger (user_id, amount, balance_after, kind, wallet_type, description, ref_id)
    values (p_user, -p_amount, new_balance, p_kind, 'current', p_desc, p_ref);
  return new_balance;
end;
$$;

revoke execute on function public.credit_wallet(uuid,numeric,text,text,uuid) from public, anon, authenticated;
revoke execute on function public.debit_wallet(uuid,numeric,text,text,uuid)  from public, anon, authenticated;
grant  execute on function public.credit_wallet(uuid,numeric,text,text,uuid) to service_role;
grant  execute on function public.debit_wallet(uuid,numeric,text,text,uuid)  to service_role;
