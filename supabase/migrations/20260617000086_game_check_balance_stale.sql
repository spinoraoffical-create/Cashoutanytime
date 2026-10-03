-- Stage 2 support: check-balance request + stale-job recovery for game pages.

-- Queue a balance-check job (no wallet movement).
create or replace function public.request_game_check_balance(
  p_game_slug text,
  p_game_name text,
  p_game_username text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_game_username is null or trim(p_game_username) = '' then
    raise exception 'Create your game account first';
  end if;
  if exists (
    select 1 from public.game_load_requests
    where user_id = v_user and game_slug = p_game_slug and status in ('pending','processing')
  ) then
    raise exception 'A request is already in progress for this game';
  end if;

  insert into public.game_load_requests (user_id, game_slug, game_name, amount, wallet_type, load_type, game_username, status)
    values (v_user, p_game_slug, p_game_name, 0, 'current', 'check_balance', nullif(trim(p_game_username), ''), 'pending')
    returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.request_game_check_balance(text, text, text) to authenticated;

-- Fail jobs stuck in pending/processing past the threshold (refunds loads).
create or replace function public.fail_stale_game_loads(
  p_stale_minutes integer default 15,
  p_user_id uuid default null,
  p_game_slug text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer := 0; v_row public.game_load_requests;
begin
  for v_row in
    select * from public.game_load_requests
    where status in ('pending','processing')
      and updated_at < now() - make_interval(mins => greatest(p_stale_minutes, 5))
      and (p_user_id is null or user_id = p_user_id)
      and (p_game_slug is null or game_slug = p_game_slug)
    for update
  loop
    if v_row.load_type = 'reload' then
      perform public.refund_game_load_wallet(v_row.id);
    end if;
    update public.game_load_requests
      set status = 'failed',
          error_message = coalesce(nullif(trim(error_message), ''),
            'Timed out waiting for the game bot. Restart the bot on your PC, then try again.'),
          updated_at = now()
      where id = v_row.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.fail_stale_game_loads(integer, uuid, text) to authenticated, service_role;
