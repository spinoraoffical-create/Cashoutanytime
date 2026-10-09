-- Player chat threads: staff access is public.is_staff() from user_roles.

do $$
begin
  if to_regprocedure('public.is_staff()') is null then
    execute $fn$
      create function public.is_staff()
      returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = auth.uid()
            and r.key in ('super_admin', 'admin', 'manager', 'support_agent', 'moderator')
        );
      $body$;
    $fn$;
  end if;
end $$;

grant execute on function public.is_staff() to authenticated, service_role;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  admin_id uuid references public.profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  attachment_url text,
  attachment_type text,
  attachment_name text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint messages_attachment_type_check check (attachment_type is null or attachment_type in ('image', 'file'))
);

create index if not exists idx_conversations_user_id on public.conversations (user_id);
create index if not exists idx_messages_conversation_id on public.messages (conversation_id);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('conversations', 'messages')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

create policy conversations_select_own_or_staff
  on public.conversations
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_staff());

create policy conversations_insert_own
  on public.conversations
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy conversations_update_own_or_staff
  on public.conversations
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_staff());

create policy messages_select_own_thread_or_staff
  on public.messages
  for select
  to authenticated
  using (
    public.is_staff()
    or exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

create policy messages_insert_as_self
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (
      public.is_staff()
      or exists (
        select 1
        from public.conversations c
        where c.id = messages.conversation_id
          and c.user_id = auth.uid()
      )
    )
  );

grant select, insert, update on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant all on public.conversations to service_role;
grant all on public.messages to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
exception
  when undefined_object then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
exception
  when undefined_object then null;
end $$;
