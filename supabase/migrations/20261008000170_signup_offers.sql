-- Signup consent and one-a-day offers. New profiles stay customers.

alter table public.profiles
  add column if not exists date_of_birth date;

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_promotions boolean not null default false,
  email_rewards boolean not null default true,
  email_vip boolean not null default true,
  email_referrals boolean not null default true,
  email_support boolean not null default true,
  email_announcements boolean not null default true,
  sms_marketing boolean not null default false,
  sms_login_codes boolean not null default false,
  whatsapp_marketing boolean not null default false,
  inapp_rewards boolean not null default true,
  inapp_promotions boolean not null default true,
  inapp_vip boolean not null default true,
  inapp_referrals boolean not null default true,
  inapp_support boolean not null default true,
  inapp_announcements boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
grant all on table public.notification_preferences to service_role;

alter table public.notification_preferences
  add column if not exists sms_marketing boolean not null default false;

alter table public.notification_preferences
  add column if not exists sms_login_codes boolean not null default false;

create table if not exists public.offer_sends (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  title text not null,
  email_count integer not null,
  sms_count integer not null,
  sent_at timestamptz not null default now()
);

create table if not exists public.offer_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  channel text not null check (channel in ('email', 'sms')),
  sent_on date not null default (timezone('utc', now()))::date,
  offer_id uuid references public.offer_sends (id) on delete cascade,
  unique (user_id, channel, sent_on)
);

alter table public.offer_sends enable row level security;
alter table public.offer_deliveries enable row level security;
revoke all on table public.offer_sends from public, anon, authenticated;
revoke all on table public.offer_deliveries from public, anon, authenticated;
grant all on table public.offer_sends to service_role;
grant all on table public.offer_deliveries to service_role;

-- New accounts start opted out. The signup form turns both on only after the offers box is ticked.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_username text;
  suffix int := 0;
  final_username text;
  ref_code text;
  referrer public.profiles%rowtype;
  has_referrer boolean := false;
begin
  desired_username := coalesce(
    nullif(regexp_replace(new.raw_user_meta_data ->> 'username', '[^A-Za-z0-9_]', '', 'g'), ''),
    split_part(new.email, '@', 1)
  );
  desired_username := substr(desired_username, 1, 20);
  if char_length(desired_username) < 3 then
    desired_username := 'player' || substr(new.id::text, 1, 6);
  end if;

  final_username := desired_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := substr(desired_username, 1, 20 - char_length(suffix::text)) || suffix;
  end loop;

  ref_code := upper(nullif(new.raw_user_meta_data ->> 'referral_code', ''));
  if ref_code is not null then
    select * into referrer from public.profiles where referral_code = ref_code;
    if found and referrer.id <> new.id then
      has_referrer := true;
    end if;
  end if;

  insert into public.profiles (id, username, display_name, referral_code, referred_by, role)
  values (
    new.id,
    final_username,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    public.generate_referral_code(),
    case when has_referrer then referrer.id else null end,
    'customer'
  );

  if has_referrer then
    insert into public.referrals (referrer_id, referred_id, code_used)
    values (referrer.id, new.id, ref_code)
    on conflict do nothing;
  end if;

  insert into public.notification_preferences (user_id, email_promotions, sms_marketing, sms_login_codes)
  values (new.id, false, false, false)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

notify pgrst, 'reload schema';
