-- New accounts are players. profiles.role never grants Super Admin.
-- Staff access comes only from user_roles.

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'customer';

CREATE OR REPLACE FUNCTION public.force_new_profile_customer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.role := 'customer';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_force_customer_role ON public.profiles;
CREATE TRIGGER profiles_force_customer_role
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.force_new_profile_customer();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  desired_username citext;
  suffix int := 0;
  final_username citext;
  ref_code text;
  referrer public.profiles%rowtype;
  has_referrer boolean := false;
BEGIN
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

  ref_code := upper(nullif(new.raw_user_meta_data ->> 'referral_code', ''));
  if ref_code is not null then
    select * into referrer from public.profiles where referral_code = ref_code;
    if found and referrer.id <> new.id then
      has_referrer := true;
    end if;
  end if;

  insert into public.profiles (id, username, display_name, referral_code, referred_by, role)
  values (
    new.id,
    final_username,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    public.generate_referral_code(),
    case when has_referrer then referrer.id else null end,
    'customer'
  );

  if has_referrer then
    insert into public.referrals (referrer_id, referred_id, code_used)
    values (referrer.id, new.id, ref_code)
    on conflict do nothing;
  end if;

  insert into public.notification_preferences (user_id) values (new.id)
  on conflict do nothing;

  return new;
END;
$$;

-- Extra accounts lose the profile admin flag and any super_admin or admin role row.
-- The owner keeps super_admin in user_roles. The app does not check this email.
UPDATE public.profiles
SET role = 'customer'
WHERE id NOT IN (
  SELECT id FROM auth.users WHERE lower(email) = 'spinoraoffical@gmail.com'
)
AND coalesce(role, '') IN ('admin', 'super_admin');

INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM auth.users u
JOIN public.roles r ON r.key = 'super_admin'
WHERE lower(u.email) = 'spinoraoffical@gmail.com'
ON CONFLICT DO NOTHING;

DELETE FROM public.user_roles ur
USING public.roles r
WHERE ur.role_id = r.id
  AND r.key IN ('super_admin', 'admin')
  AND ur.user_id NOT IN (
    SELECT id FROM auth.users WHERE lower(email) = 'spinoraoffical@gmail.com'
  );
