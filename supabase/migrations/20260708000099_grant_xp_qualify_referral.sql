-- Fix: referral rewards never paid out.
--
-- qualify_referral() requires profile_completed AND level >= 2, but it was
-- only ever invoked once, from trg_profiles_completion (on the
-- profile_completed false->true flip). Every profile starts at level 1 with
-- 0 xp, so that check always failed at completion time, and nothing called
-- qualify_referral again afterward — the referral row stayed 'pending'
-- forever. Re-check on the level-up path in grant_xp, where it belongs.

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

  -- side-effects of leveling: VIP tier re-check + notification + referral re-check
  if new_level > old_level then
    perform public.evaluate_vip_tier(target_user);
    perform public.qualify_referral(target_user);
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
