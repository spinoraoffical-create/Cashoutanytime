-- New accounts are players. profiles.role never grants Super Admin.
-- Staff access comes only from user_roles.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'user', 'admin', 'super_admin'))
  NOT VALID;

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
  desired_username text;
  suffix int := 0;
  final_username text;
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

-- This database never had the staff role tables. Create them before the grant.
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  module text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

INSERT INTO public.roles (key, name, description)
VALUES
  ('super_admin', 'Super Admin', 'Full platform control'),
  ('admin', 'Admin', 'Operations'),
  ('manager', 'Manager', 'Promotions and content'),
  ('support_agent', 'Support Agent', 'Support inbox'),
  ('moderator', 'Moderator', 'Community moderation')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_read_own ON public.user_roles;
CREATE POLICY user_roles_read_own ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS roles_read ON public.roles;
CREATE POLICY roles_read ON public.roles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS permissions_read ON public.permissions;
CREATE POLICY permissions_read ON public.permissions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS role_permissions_read ON public.role_permissions;
CREATE POLICY role_permissions_read ON public.role_permissions
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.user_roles, public.roles, public.permissions, public.role_permissions TO authenticated;
GRANT ALL ON public.user_roles, public.roles, public.permissions, public.role_permissions TO service_role;

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

NOTIFY pgrst, 'reload schema';
