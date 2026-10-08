-- Store Creator → Sub-Creator → Player network.
-- Apply in the Supabase SQL editor if migrations are not auto-applied.

alter table public.profiles
  add column if not exists parent_agent_id uuid;

create table if not exists public.agent_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null check (tier in ('store_creator', 'sub_creator')),
  role_label text not null default 'sub_creator'
    check (role_label in ('store_creator', 'sub_creator', 'store_sub_creator')),
  parent_id uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  promo_code text not null unique,
  phone text,
  commission_bps integer not null default 0 check (commission_bps between 0 and 10000),
  approve_limit numeric check (approve_limit is null or approve_limit >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> user_id),
  check (tier <> 'sub_creator' or parent_id is not null)
);

create index if not exists idx_agent_accounts_parent on public.agent_accounts (parent_id);
create index if not exists idx_profiles_parent_agent on public.profiles (parent_agent_id);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references auth.users (id) on delete cascade,
  agent_id uuid not null references auth.users (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_messages_pair
  on public.agent_messages (player_id, agent_id, created_at);

-- Who may see or move this player. Service-role admin pages also enforce this in TypeScript.
create or replace function public.agent_may_touch_player(p_player uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  parent uuid;
  my_tier text;
begin
  if me is null or p_player is null then
    return false;
  end if;

  if exists (
    select 1 from public.profiles
    where id = me and role in ('admin', 'super_admin')
  ) then
    return true;
  end if;

  select tier into my_tier
    from public.agent_accounts
   where user_id = me and active;
  if not found then
    return false;
  end if;

  select parent_agent_id into parent from public.profiles where id = p_player;

  if my_tier = 'sub_creator' then
    return parent = me;
  end if;

  if my_tier = 'store_creator' then
    return parent = me
      or exists (
        select 1 from public.agent_accounts child
        where child.user_id = parent
          and child.parent_id = me
          and child.tier = 'sub_creator'
      );
  end if;

  return false;
end;
$$;

create or replace function public.protect_parent_agent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.parent_agent_id is not null and coalesce(auth.role(), '') <> 'service_role' then
      new.parent_agent_id := null;
    end if;
    return new;
  end if;

  if new.parent_agent_id is distinct from old.parent_agent_id
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.agent_may_touch_player(new.id) then
    new.parent_agent_id := old.parent_agent_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_parent_agent on public.profiles;
create trigger trg_protect_parent_agent
  before insert or update on public.profiles
  for each row execute function public.protect_parent_agent();

alter table public.agent_accounts enable row level security;
alter table public.agent_messages enable row level security;

drop policy if exists agent_accounts_select_own on public.agent_accounts;
create policy agent_accounts_select_own
  on public.agent_accounts
  for select
  to authenticated
  using (user_id = auth.uid() or parent_id = auth.uid());

drop policy if exists agent_messages_select on public.agent_messages;
create policy agent_messages_select
  on public.agent_messages
  for select
  to authenticated
  using (player_id = auth.uid() or agent_id = auth.uid());

drop policy if exists agent_messages_insert on public.agent_messages;
create policy agent_messages_insert
  on public.agent_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (
      (
        player_id = auth.uid()
        and agent_id = (select parent_agent_id from public.profiles where id = auth.uid())
      )
      or (
        agent_id = auth.uid()
        and exists (
          select 1 from public.profiles p
          where p.id = player_id and p.parent_agent_id = auth.uid()
        )
      )
    )
  );

do $$
begin
  alter publication supabase_realtime add table public.agent_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- Let store creators and in-limit sub-creators confirm a deposit for their own players.
create or replace function public.complete_deposit_request(
  p_deposit_id uuid,
  p_amount numeric default null,
  p_admin_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.deposit_requests;
  v_amount numeric;
  v_method text;
  v_limit numeric;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.deposit_requests
  where id = p_deposit_id
  for update;

  if v_row.id is null then
    raise exception 'Deposit request not found';
  end if;

  if not public.agent_may_touch_player(v_row.user_id)
     and not exists (select 1 from public.profiles where id = me and role in ('admin', 'super_admin')) then
    raise exception 'Admin only';
  end if;

  if v_row.wallet_credited or v_row.status = 'completed' then
    raise exception 'Deposit already completed';
  end if;

  v_amount := coalesce(p_amount, v_row.amount);
  if v_amount is null or v_amount <= 0 then
    raise exception 'Deposit amount is required';
  end if;
  v_amount := round(v_amount::numeric, 2);

  select approve_limit into v_limit
    from public.agent_accounts
   where user_id = me and tier = 'sub_creator' and active;
  if found and (v_limit is null or v_amount > v_limit) then
    raise exception 'Amount is above your approval limit';
  end if;

  perform set_config('app.wallet_update', 'true', true);

  update public.profiles
  set wallet_balance = wallet_balance + v_amount
  where id = v_row.user_id;

  v_method := coalesce(v_row.payment_method, 'payment');

  insert into public.wallet_transactions (
    user_id, amount, wallet_type, transaction_type, source, description, created_by
  )
  values (
    v_row.user_id,
    v_amount,
    'current',
    'credit',
    'deposit',
    format('Deposit confirmed — $%s via %s (%s)', v_amount, v_method, v_row.game_name),
    me
  );

  update public.deposit_requests
  set
    status = 'completed',
    amount = v_amount,
    wallet_credited = true,
    admin_notes = coalesce(nullif(trim(p_admin_notes), ''), admin_notes),
    reviewed_by = me,
    reviewed_at = now(),
    updated_at = now()
  where id = p_deposit_id;
end;
$$;
