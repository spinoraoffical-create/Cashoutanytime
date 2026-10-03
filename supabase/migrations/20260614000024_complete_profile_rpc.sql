-- ============================================================================
-- WinSweeps · 0024 · complete_my_profile RPC
-- Lets an authenticated user save their own profile completion fields without
-- needing service_role. SECURITY DEFINER bypasses RLS; auth.uid() ensures the
-- caller can only write their own row.
-- ============================================================================

create or replace function public.complete_my_profile(
  p_display_name  text,
  p_country       text    default null,
  p_bio           text    default null,
  p_marketing_opt_in boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    display_name     = p_display_name,
    country          = p_country,
    bio              = p_bio,
    marketing_opt_in = p_marketing_opt_in,
    profile_completed = true
  where id = auth.uid()
    and not is_banned;

  if not found then
    raise exception 'profile_not_found';
  end if;
end;
$$;

-- Authenticated users only; public (anon) cannot call this
revoke execute on function public.complete_my_profile(text, text, text, boolean) from public;
grant  execute on function public.complete_my_profile(text, text, text, boolean) to authenticated;
