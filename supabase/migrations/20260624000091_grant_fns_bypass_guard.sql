-- Fix: "Could not save your profile" on complete-profile, and (more broadly)
-- any coin/XP grant made from inside an authenticated SECURITY DEFINER RPC.
--
-- Cause: grant_coins() / grant_xp() update the protected columns coins_balance,
-- lifetime_coins and xp. protect_profile_columns only bypasses when it sees
-- service_role via current_setting('request.jwt.claim.role') — which current
-- PostgREST leaves EMPTY inside a SECURITY DEFINER RPC. So when complete_my_profile
-- → trg_profiles_completion → evaluate_achievements / qualify_referral →
-- grant_coins/grant_xp ran, the protected write raised 'column protected' and the
-- whole transaction aborted. This is the same failure migration 0089 fixed for
-- credit_wallet/debit_wallet by setting the app.wallet_update flag the trigger
-- honors. Apply the same bypass to the coin/XP grant functions. This also
-- unblocks daily/weekly/streak/referral/achievement rewards on PostgREST builds
-- that drop the role GUC inside definer RPCs.

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

  -- Trusted system credit — allow the protected-column write (see 0089).
  perform set_config('app.wallet_update', 'true', true);

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

  -- Trusted system credit — allow the protected-column write (see 0089).
  perform set_config('app.wallet_update', 'true', true);

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
    insert into public.notifications (user_id, type, title, body, link_url)
    values (
      target_user, 'reward',
      'Level up!',
      format('You reached level %s. Keep the streak alive.', new_level),
      '/dashboard/rewards'
    );
  end if;

  return new_total;
end;
$$;
