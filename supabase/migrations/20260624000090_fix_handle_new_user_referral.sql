-- Fix: signup with a referral code failed with "Database error saving new user".
--
-- Cause: handle_new_user() set the referrer via a separate
--   UPDATE public.profiles SET referred_by = ...
-- That UPDATE fires trg_profiles_protect (protect_profile_columns), which guards
-- `referred_by`. During GoTrue signup none of the bypass conditions
-- (service_role / app.wallet_update / is_admin) are true, so the trigger raised
-- 'column protected' and the whole signup transaction aborted. Signups WITHOUT a
-- referral code were unaffected (no UPDATE ran).
--
-- Fix: resolve the referrer BEFORE inserting the profile and set `referred_by`
-- in the INSERT itself. trg_profiles_protect is BEFORE UPDATE only, so the
-- INSERT is allowed. The referrals row is inserted after the profile exists.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_username citext;
  suffix int := 0;
  final_username citext;
  ref_code text;
  referrer public.profiles%rowtype;
  has_referrer boolean := false;
  customer_role_id uuid;
begin
  desired_username := coalesce(
    nullif(regexp_replace(new.raw_user_meta_data ->> 'username', '[^A-Za-z0-9_]', '', 'g'), ''),
    split_part(new.email, '@', 1)
  );
  desired_username := substr(desired_username, 1, 20);
  if char_length(desired_username) < 3 then
    desired_username := 'player' || substr(new.id::text, 1, 6);
  end if;

  final_username := desired_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := substr(desired_username, 1, 20 - char_length(suffix::text)) || suffix;
  end loop;

  -- Resolve referrer first so we can set referred_by in the INSERT (avoids a
  -- protected-column UPDATE that trg_profiles_protect would reject).
  ref_code := upper(nullif(new.raw_user_meta_data ->> 'referral_code', ''));
  if ref_code is not null then
    select * into referrer from public.profiles where referral_code = ref_code;
    if found and referrer.id <> new.id then
      has_referrer := true;
    end if;
  end if;

  insert into public.profiles (id, username, display_name, referral_code, referred_by)
  values (
    new.id,
    final_username,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    public.generate_referral_code(),
    case when has_referrer then referrer.id else null end
  );

  -- default role: customer
  select id into customer_role_id from public.roles where key = 'customer';
  if customer_role_id is not null then
    insert into public.user_roles (user_id, role_id) values (new.id, customer_role_id)
    on conflict do nothing;
  end if;

  -- referral intake row (profile now exists, satisfies the FK)
  if has_referrer then
    insert into public.referrals (referrer_id, referred_id, code_used)
    values (referrer.id, new.id, ref_code)
    on conflict do nothing;
  end if;

  insert into public.notification_preferences (user_id) values (new.id)
  on conflict do nothing;

  return new;
end;
$$;
