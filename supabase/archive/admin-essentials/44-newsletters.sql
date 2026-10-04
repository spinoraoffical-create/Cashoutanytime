-- ============================================================================
-- WinSweeps · 0107 · Newsletter campaigns — author, schedule, bulk-send
-- ============================================================================

create table public.newsletter_campaigns (
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

create index idx_newsletter_campaigns_due
  on public.newsletter_campaigns (scheduled_at asc)
  where status = 'scheduled';

create trigger trg_newsletter_campaigns_updated_at
  before update on public.newsletter_campaigns
  for each row execute function public.set_updated_at();

alter table public.newsletter_campaigns enable row level security;
-- No policies — service-role only (admin actions + the cron route),
-- matching telegram_promo_messages.

create table public.newsletter_campaign_recipients (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.newsletter_campaigns (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  email         text not null,
  status        text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at       timestamptz,
  error         text,
  created_at    timestamptz not null default now()
);

-- Lets a send tick cheaply claim "next N pending rows for this campaign".
create index idx_newsletter_campaign_recipients_pending
  on public.newsletter_campaign_recipients (campaign_id, status);

alter table public.newsletter_campaign_recipients enable row level security;
-- No policies — service-role only.

-- ── Permission ───────────────────────────────────────────────────────────────

insert into public.permissions (key, name, module, description) values
  ('newsletters.manage', 'Manage newsletters', 'newsletters', 'Author, schedule and send email newsletter campaigns');

-- super_admin's original blanket grant (migration 0013) only covered
-- permissions that existed at seed time — grant explicitly here too.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'newsletters.manage'
where r.key in ('super_admin', 'admin', 'manager');
