-- Cash-out payouts: admin records that a player's redeemed (cash-out) balance
-- has been paid out off-platform (CashApp/Zelle/crypto). Atomically debits
-- cashout_wallet and appends an append-only ledger row. Service-role only —
-- called from the admin client after an authorize("requests.manage") check.

-- Allow the 'payout' ledger kind.
alter table public.wallet_ledger drop constraint if exists wallet_ledger_kind_check;
alter table public.wallet_ledger add constraint wallet_ledger_kind_check
  check (kind in ('deposit','game_load','game_redeem','refund','adjustment','payout'));

create or replace function public.admin_payout_cashout(
  p_user uuid,
  p_amount numeric,
  p_note text default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare v_bal numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payout amount must be positive';
  end if;

  -- Permit the protected-column write for this transaction (see protect_profile_columns).
  perform set_config('app.wallet_update', 'true', true);

  update public.profiles
    set cashout_wallet = cashout_wallet - p_amount
    where id = p_user and cashout_wallet >= p_amount
    returning cashout_wallet into v_bal;

  if not found then
    raise exception 'Insufficient cash-out balance';
  end if;

  insert into public.wallet_ledger (user_id, amount, balance_after, kind, wallet_type, description)
    values (p_user, -p_amount, v_bal, 'payout', 'cashout',
            coalesce(nullif(trim(p_note), ''), 'Cash-out payout'));

  return v_bal;
end;
$$;

revoke all on function public.admin_payout_cashout(uuid, numeric, text) from public;
grant execute on function public.admin_payout_cashout(uuid, numeric, text) to service_role;
