-- Spinora admin-essentials · Promotions / banners / broadcasts
-- Skips WinSweeps notifications table (Spinora already has one).

create table if not exists public.promotions (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title               text not null,
  summary             text not null default '',
  description         text not null default '',
  image_url           text,
  badge_text          text,
  coins_bonus         bigint not null default 0 check (coins_bonus >= 0),
  xp_bonus            bigint not null default 0 check (xp_bonus >= 0),
  code                text unique,
  status              public.promo_status not null default 'draft',
  is_featured         boolean not null default false,
  priority            integer not null default 100,
  starts_at           timestamptz,
  ends_at             timestamptz,
  max_claims          integer check (max_claims is null or max_claims > 0),
  max_claims_per_user integer not null default 1 check (max_claims_per_user > 0),
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

drop trigger if exists trg_promotions_updated_at on public.promotions;
create trigger trg_promotions_updated_at
  before update on public.promotions
  for each row execute function public.set_updated_at();

create index if not exists idx_promotions_live
  on public.promotions (priority, starts_at)
  where status = 'active';

create table if not exists public.promotion_claims (
  id           uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  claim_no     integer not null default 1,
  claimed_at   timestamptz not null default now(),
  unique (promotion_id, user_id, claim_no)
);

create index if not exists idx_promotion_claims_promo on public.promotion_claims (promotion_id);
create index if not exists idx_promotion_claims_user on public.promotion_claims (user_id, claimed_at desc);

create table if not exists public.banners (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  subtitle   text,
  image_url  text,
  link_url   text,
  placement  public.banner_placement not null default 'home_strip',
  is_active  boolean not null default false,
  priority   integer not null default 100,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_banners_updated_at on public.banners;
create trigger trg_banners_updated_at
  before update on public.banners
  for each row execute function public.set_updated_at();

create index if not exists idx_banners_placement on public.banners (placement, priority) where is_active;

-- New table — does not conflict with Spinora notifications
create table if not exists public.notification_preferences (
  user_id             uuid primary key references public.profiles (id) on delete cascade,
  email_rewards       boolean not null default true,
  email_promotions    boolean not null default true,
  email_vip           boolean not null default true,
  email_referrals     boolean not null default true,
  email_support       boolean not null default true,
  email_announcements boolean not null default true,
  inapp_rewards       boolean not null default true,
  inapp_promotions    boolean not null default true,
  inapp_vip           boolean not null default true,
  inapp_referrals     boolean not null default true,
  inapp_support       boolean not null default true,
  inapp_announcements boolean not null default true,
  updated_at          timestamptz not null default now()
);

drop trigger if exists trg_notification_prefs_updated_at on public.notification_preferences;
create trigger trg_notification_prefs_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

create table if not exists public.broadcasts (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  body            text not null,
  link_url        text,
  segment         public.broadcast_segment not null default 'all',
  recipient_count integer not null default 0,
  sent_by         uuid references auth.users (id) on delete set null,
  sent_at         timestamptz not null default now()
);

-- Records broadcast only (does not write to Spinora notifications table)
create or replace function public.send_broadcast(
  p_title text,
  p_body text,
  p_link_url text default null,
  p_segment public.broadcast_segment default 'all'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare b_id uuid;
begin
  if not public.has_permission('notifications.broadcast') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.broadcasts (title, body, link_url, segment, sent_by)
  values (p_title, p_body, p_link_url, p_segment, auth.uid())
  returning id into b_id;

  return b_id;
end;
$$;
