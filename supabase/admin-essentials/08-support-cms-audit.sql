-- Spinora admin-essentials · Support, CMS, audit, settings
-- Skips announcements table (Spinora already has one).

create table if not exists public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  ticket_no       bigint generated always as identity unique,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  subject         text not null check (char_length(subject) between 3 and 140),
  category        public.ticket_category not null default 'other',
  status          public.ticket_status not null default 'open',
  priority        public.ticket_priority not null default 'normal',
  assigned_to     uuid references auth.users (id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  closed_at       timestamptz
);

drop trigger if exists trg_tickets_updated_at on public.support_tickets;
create trigger trg_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

create index if not exists idx_tickets_user on public.support_tickets (user_id, created_at desc);
create index if not exists idx_tickets_queue on public.support_tickets (status, priority, last_message_at);
create index if not exists idx_tickets_assignee on public.support_tickets (assigned_to) where assigned_to is not null;

create table if not exists public.ticket_messages (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references public.support_tickets (id) on delete cascade,
  sender_id      uuid not null references auth.users (id) on delete cascade,
  is_staff       boolean not null default false,
  body           text not null check (char_length(body) between 1 and 5000),
  attachment_url text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_ticket_messages_ticket on public.ticket_messages (ticket_id, created_at);

create or replace function public.touch_ticket_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_tickets
     set last_message_at = new.created_at,
         status = case
           when new.is_staff and status = 'open' then 'in_progress'::public.ticket_status
           when not new.is_staff and status in ('resolved') then 'open'::public.ticket_status
           else status
         end
   where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists trg_ticket_messages_touch on public.ticket_messages;
create trigger trg_ticket_messages_touch
  after insert on public.ticket_messages
  for each row execute function public.touch_ticket_on_message();

create table if not exists public.cms_pages (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9/-]+$'),
  title           text not null,
  content         jsonb not null default '{}'::jsonb,
  seo_title       text,
  seo_description text,
  og_image_url    text,
  is_published    boolean not null default false,
  published_at    timestamptz,
  updated_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_cms_pages_updated_at on public.cms_pages;
create trigger trg_cms_pages_updated_at
  before update on public.cms_pages
  for each row execute function public.set_updated_at();

create table if not exists public.faqs (
  id           uuid primary key default gen_random_uuid(),
  question     text not null,
  answer       text not null,
  category     text not null default 'general',
  sort_order   integer not null default 100,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_faqs_updated_at on public.faqs;
create trigger trg_faqs_updated_at
  before update on public.faqs
  for each row execute function public.set_updated_at();

create index if not exists idx_faqs_published on public.faqs (category, sort_order) where is_published;

create table if not exists public.blog_posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title           text not null,
  excerpt         text not null default '',
  content         text not null default '',
  cover_image_url text,
  tags            text[] not null default '{}',
  author_id       uuid references auth.users (id) on delete set null,
  is_published    boolean not null default false,
  published_at    timestamptz,
  seo_title       text,
  seo_description text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;
create trigger trg_blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

create index if not exists idx_blog_published on public.blog_posts (published_at desc) where is_published;

create table if not exists public.testimonials (
  id           uuid primary key default gen_random_uuid(),
  author_name  text not null,
  author_title text not null default '',
  avatar_url   text,
  quote        text not null,
  rating       integer not null default 5 check (rating between 1 and 5),
  is_featured  boolean not null default false,
  is_published boolean not null default true,
  sort_order   integer not null default 100,
  created_at   timestamptz not null default now()
);

create table if not exists public.game_categories (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  name       text not null,
  icon       text not null default 'gamepad-2',
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  category_id uuid not null references public.game_categories (id) on delete restrict,
  description text not null default '',
  image_url   text,
  badge_text  text,
  is_featured boolean not null default false,
  is_active   boolean not null default true,
  popularity  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_games_updated_at on public.games;
create trigger trg_games_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

create index if not exists idx_games_category on public.games (category_id, popularity desc) where is_active;

create table if not exists public.user_favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game_id    uuid not null references public.games (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  action      text not null,
  description text not null default '',
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_activity_user on public.activity_log (user_id, created_at desc);

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  before_data jsonb,
  after_data  jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_actor on public.audit_logs (actor_id, created_at desc);
create index if not exists idx_audit_entity on public.audit_logs (entity_type, entity_id);
create index if not exists idx_audit_created on public.audit_logs (created_at desc);

drop trigger if exists trg_audit_no_update on public.audit_logs;
create trigger trg_audit_no_update before update on public.audit_logs
  for each row execute function public.forbid_mutation();
drop trigger if exists trg_audit_no_delete on public.audit_logs;
create trigger trg_audit_no_delete before delete on public.audit_logs
  for each row execute function public.forbid_mutation();

create table if not exists public.site_settings (
  key         text primary key,
  value       jsonb not null,
  description text not null default '',
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_site_settings_updated_at on public.site_settings;
create trigger trg_site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();
