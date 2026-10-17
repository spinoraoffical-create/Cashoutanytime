-- Disposable-database test for the stale-load hold. Rolls back all rows it creates.
-- The function definition is applied by the caller before this file runs.

begin;

do $$
declare
  v_user uuid := gen_random_uuid();
  v_balance numeric;
  v_status text;
  v_notes text;
  v_refunded boolean;
  v_debited boolean;
  v_count integer;
  v_held uuid;
  v_fresh uuid;
  v_done uuid;
  v_provider uuid;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'stale-hold-' || v_user::text || '@example.test', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

  select wallet_balance into v_balance from public.profiles where id = v_user;
  if v_balance <> 0 then
    raise exception 'New profile did not start at 0';
  end if;

  insert into public.game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type, status, updated_at, game_api_debited, wallet_refunded
  ) values (
    v_user, 'juwa', 'Juwa', 10, 'current', 'load', 'pending', now() - interval '2 hours', false, false
  ) returning id into v_held;

  insert into public.game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type, status, updated_at, game_api_debited, wallet_refunded
  ) values (
    v_user, 'juwa', 'Juwa', 8, 'current', 'load', 'pending', now(), false, false
  ) returning id into v_fresh;

  insert into public.game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type, status, updated_at, completed_at, game_api_debited, wallet_refunded
  ) values (
    v_user, 'juwa', 'Juwa', 12, 'current', 'load', 'completed', now() - interval '2 hours', now(), true, false
  ) returning id into v_done;

  insert into public.game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type, status, updated_at, game_api_debited, wallet_refunded
  ) values (
    v_user, 'fire-kirin', 'Fire Kirin', 15, 'current', 'load', 'processing', now() - interval '2 hours', true, false
  ) returning id into v_provider;

  v_count := public.fail_stale_game_loads(15, v_user, null);
  if v_count <> 2 then
    raise exception 'Expected 2 stale rows held, got %', v_count;
  end if;

  select wallet_balance into v_balance from public.profiles where id = v_user;
  if v_balance <> 0 then
    raise exception 'Wallet changed from 0 to %', v_balance;
  end if;

  select status, admin_notes, wallet_refunded, game_api_debited
  into v_status, v_notes, v_refunded, v_debited
  from public.game_load_requests where id = v_held;
  if v_status <> 'pending' or v_refunded or v_debited or v_notes not like '[held for review] Provider did not confirm.%' then
    raise exception 'Unconfirmed stale load was not held safely';
  end if;

  select status, admin_notes into v_status, v_notes from public.game_load_requests where id = v_fresh;
  if v_status <> 'pending' or COALESCE(v_notes, '') like '[held for review]%' then
    raise exception 'Fresh load was held';
  end if;

  select status, COALESCE(admin_notes, '') into v_status, v_notes from public.game_load_requests where id = v_done;
  if v_status <> 'completed' or v_notes like '[held for review]%' then
    raise exception 'Completed load was changed';
  end if;

  select status, wallet_refunded, admin_notes into v_status, v_refunded, v_notes
  from public.game_load_requests where id = v_provider;
  if v_status <> 'processing' or v_refunded or v_notes not like '[held for review] Provider flag is set.%' then
    raise exception 'Provider-flagged load was not held without a refund';
  end if;

  v_count := public.fail_stale_game_loads(15, v_user, null);
  if v_count <> 0 then
    raise exception 'Second run held % rows', v_count;
  end if;

  begin
    execute 'set local role authenticated';
    perform public.fail_stale_game_loads(15, v_user, null);
    raise exception 'Authenticated role was allowed to run the stale-load function';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

rollback;
