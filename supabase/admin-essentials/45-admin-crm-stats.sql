-- Fast CRM overview stats (single round-trip). Run once in Supabase SQL Editor.

create or replace function public.admin_crm_overview_stats(since timestamptz)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total_players', (select count(*)::bigint from public.profiles),
    'new_this_week', (select count(*)::bigint from public.profiles where created_at >= since),
    'active_last_7d', (select count(*)::bigint from public.profiles where last_seen_at >= since),
    'total_fulfilled', (
      select coalesce(sum(amount), 0)::numeric
      from public.deposit_requests
      where status = 'completed'
    )
  );
$$;

revoke all on function public.admin_crm_overview_stats(timestamptz) from public;
grant execute on function public.admin_crm_overview_stats(timestamptz) to service_role;

create or replace function public.admin_user_deposit_stats(p_user_ids uuid[])
returns table (
  user_id uuid,
  fulfilled_count bigint,
  total_deposited numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    dr.user_id,
    count(*)::bigint as fulfilled_count,
    coalesce(sum(dr.amount), 0)::numeric as total_deposited
  from public.deposit_requests dr
  where dr.user_id = any (p_user_ids)
    and dr.status = 'completed'
  group by dr.user_id;
$$;

revoke all on function public.admin_user_deposit_stats(uuid[]) from public;
grant execute on function public.admin_user_deposit_stats(uuid[]) to service_role;
