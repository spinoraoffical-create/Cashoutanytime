-- Newsletter tables, the missing updated-at helper, phone consent columns,
-- and the newsletters.manage permission. Safe to run once in the SQL editor.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.newsletter_campaigns (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  subject           text not null,
  eyebrow           text not null default '',
  heading           text not null,
  subhead           text not null default '',
  body              text not null default '',
  cta_label         text not null default 'Play Now',
  cta_href          text not null,
  stat1_value       text,
  stat1_label       text,
  stat2_value       text,
  stat2_label       text,
  stat3_value       text,
  stat3_label       text,
  segment           text not null default 'all' check (segment in ('all', 'test')),
  status            text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_at      timestamptz,
  sent_at           timestamptz,
  sent_count        integer not null default 0,
  failed_count      integer not null default 0,
  total_recipients  integer not null default 0,
  created_by        uuid references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_newsletter_campaigns_due
  on public.newsletter_campaigns (scheduled_at asc)
  where status = 'scheduled';

drop trigger if exists trg_newsletter_campaigns_updated_at on public.newsletter_campaigns;
create trigger trg_newsletter_campaigns_updated_at
  before update on public.newsletter_campaigns
  for each row execute function public.set_updated_at();

alter table public.newsletter_campaigns enable row level security;

create table if not exists public.newsletter_campaign_recipients (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.newsletter_campaigns (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  email         text not null,
  status        text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at       timestamptz,
  error         text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_newsletter_campaign_recipients_pending
  on public.newsletter_campaign_recipients (campaign_id, status);

alter table public.newsletter_campaign_recipients enable row level security;

insert into public.permissions (key, name, module, description)
values (
  'newsletters.manage',
  'Manage newsletters',
  'newsletters',
  'Author, schedule and send email newsletter campaigns'
)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'newsletters.manage'
where r.key in ('super_admin', 'admin', 'manager')
on conflict (role_id, permission_id) do nothing;

alter table public.notification_preferences
  add column if not exists sms_marketing boolean not null default false;

alter table public.notification_preferences
  add column if not exists whatsapp_marketing boolean not null default false;

create index if not exists idx_notification_prefs_phone_marketing
  on public.notification_preferences (user_id)
  where sms_marketing or whatsapp_marketing;

alter table public.newsletter_campaigns
  drop constraint if exists newsletter_campaigns_segment_check;

alter table public.newsletter_campaigns
  add constraint newsletter_campaigns_segment_check
  check (segment in (
    'all',
    'test',
    'new_signups',
    'never_deposited',
    'deposited_7d',
    'deposited_14d',
    'deposited_30d',
    'inactive_7_14',
    'vip'
  ));

grant all on table public.newsletter_campaigns to service_role;
grant all on table public.newsletter_campaign_recipients to service_role;
