-- ============================================================================
-- WinSweeps · 0108 · Admin hard-delete — bypass flag for append-only guards
-- ============================================================================
-- Hard-deleting a user cascades auth.users -> profiles -> ledger_entries /
-- wallet_ledger, both append-only tables. auth.admin.deleteUser() runs
-- outside PostgREST so it never carries request.jwt.claim.role = service_role,
-- and block_wallet_ledger_mutation() previously had no bypass at all. Add a
-- session-local flag (same shape as the app.wallet_update pattern used for
-- protect_profile_columns) so a dedicated definer function can purge a user
-- for real.

create or replace function public.forbid_mutation()
returns trigger language plpgsql as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or current_setting('app.allow_account_purge', true) = 'true' then
    return coalesce(new, old);
  end if;
  raise exception 'append-only table' using errcode = '42501';
end;
$$;

create or replace function public.block_wallet_ledger_mutation()
returns trigger language plpgsql as $$
begin
  if current_setting('app.allow_account_purge', true) = 'true' then
    return coalesce(new, old);
  end if;
  raise exception 'wallet_ledger is append-only';
end;
$$;

create or replace function public.admin_delete_user_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.allow_account_purge', 'true', true);
  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.admin_delete_user_account(uuid) from public;
grant execute on function public.admin_delete_user_account(uuid) to service_role;

insert into public.permissions (key, name, module, description) values
  ('users.delete', 'Delete user accounts', 'users',
   'Permanently delete a member account and all associated data')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'users.delete'
where r.key = 'super_admin'
on conflict do nothing;
