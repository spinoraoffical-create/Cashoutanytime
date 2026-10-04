-- Run LAST after all admin-essentials files succeed.
-- Replace YOUR_EMAIL with your login email.

-- Spinora admin flag (always works)
update public.profiles
set role = 'admin'
where email = 'YOUR_EMAIL@example.com';

-- Optional: RBAC super_admin (only if 02-rbac + 12-seed ran successfully)
insert into public.user_roles (user_id, role_id)
select p.id, r.id
from public.profiles p
cross join public.roles r
where p.email = 'YOUR_EMAIL@example.com'
  and r.key = 'super_admin'
on conflict do nothing;
