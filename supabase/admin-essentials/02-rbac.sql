-- ============================================================================
-- WinSweeps · 0002 · RBAC — roles, permissions, user assignments
-- ============================================================================

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  key         public.app_role not null unique,
  name        text not null,
  description text not null default '',
  is_system   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,           -- e.g. 'users.manage'
  name        text not null,
  module      text not null,                  -- e.g. 'users', 'cms', 'promotions'
  description text not null default '',
  created_at  timestamptz not null default now()
);

create table public.role_permissions (
  role_id       uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role_id    uuid not null references public.roles (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index idx_user_roles_user on public.user_roles (user_id);
create index idx_user_roles_role on public.user_roles (role_id);
create index idx_role_permissions_role on public.role_permissions (role_id);

-- ── Authorization helper functions (used by RLS everywhere) ─────────────────
-- SECURITY DEFINER so they can read user_roles regardless of caller's RLS.

create or replace function public.has_role(required public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.key = required
  );
$$;

create or replace function public.has_any_role(required public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.key = any (required)
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(
    array['super_admin','admin','manager','support_agent','moderator']::public.app_role[]
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(array['super_admin','admin']::public.app_role[]);
$$;

create or replace function public.has_permission(perm_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and p.key = perm_key
  ) or public.has_role('super_admin');
$$;
