-- ============================================================================
-- WinSweeps · 0008 · Promotions, banners, notifications, broadcasts
-- ============================================================================

create table public.promotions (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title               text not null,
  summary             text not null default '',
  description         text not null default '',
  image_url           text,
  badge_text          text,                        -- 'LIMITED', 'NEW', '2X'
  coins_bonus         bigint not null default 0 check (coins_bonus >= 0),
  xp_bonus            bigint not null default 0 check (xp_bonus >= 0),
  code                text unique,                 -- optional redeem code
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

create trigger trg_promotions_updated_at
  before update on public.promotions
  for each row execute function public.set_updated_at();

create index idx_promotions_live
  on public.promotions (priority, starts_at)
  where status = 'active';

create table public.promotion_claims (
  id           uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  claim_no     integer not null default 1,
  claimed_at   timestamptz not null default now(),
  unique (promotion_id, user_id, claim_no)
);

create index idx_promotion_claims_promo on public.promotion_claims (promotion_id);
create index idx_promotion_claims_user on public.promotion_claims (user_id, claimed_at desc);

create table public.banners (
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

create trigger trg_banners_updated_at
  before update on public.banners
  for each row execute function public.set_updated_at();

create index idx_banners_placement on public.banners (placement, priority) where is_active;

-- ── Notifications ────────────────────────────────────────────────────────────

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       public.notification_type not null default 'system',
  title      text not null,
  body       text not null default '',
  link_url   text,
  icon       text,
  is_read    boolean not null default false,
  read_at    timestamptz,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_notifications_user
  on public.notifications (user_id, created_at desc);
create index idx_notifications_unread
  on public.notifications (user_id) where is_read = false;

create table public.notification_preferences (
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

create trigger trg_notification_prefs_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ── Broadcasts (staff → segment fan-out) ─────────────────────────────────────

create table public.broadcasts (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  body            text not null,
  link_url        text,
  segment         public.broadcast_segment not null default 'all',
  recipient_count integer not null default 0,
  sent_by         uuid references auth.users (id) on delete set null,
  sent_at         timestamptz not null default now()
);

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
declare
  min_rank int := case p_segment
    when 'all' then 0
    when 'vip_silver_up' then 1
    when 'vip_gold_up' then 2
    when 'vip_platinum_up' then 3
    when 'vip_diamond_up' then 4
    when 'vip_elite' then 5
  end;
  b_id uuid;
  n int;
begin
  if not public.has_permission('notifications.broadcast') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.broadcasts (title, body, link_url, segment, sent_by)
  values (p_title, p_body, p_link_url, p_segment, auth.uid())
  returning id into b_id;

  insert into public.notifications (user_id, type, title, body, link_url, metadata)
  select p.id, 'announcement', p_title, p_body, p_link_url,
         jsonb_build_object('broadcast_id', b_id)
  from public.profiles p
  left join public.vip_status vs on vs.user_id = p.id
  left join public.vip_tiers vt on vt.id = vs.tier_id
  join public.notification_preferences np on np.user_id = p.id
  where p.is_banned = false
    and np.inapp_announcements
    and coalesce(vt.rank, 0) >= min_rank;

  get diagnostics n = row_count;
  update public.broadcasts set recipient_count = n where id = b_id;
  return b_id;
end;
$$;
