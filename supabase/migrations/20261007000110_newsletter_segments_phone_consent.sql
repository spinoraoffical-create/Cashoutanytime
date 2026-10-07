-- ============================================================================
-- Newsletter audiences + explicit phone marketing consent
--
-- newsletter_campaigns.segment gains lifecycle audiences. Existing rows
-- ("all" / "test") stay valid.
--
-- notification_preferences.sms_marketing and whatsapp_marketing default to
-- false. Promotional phone outreach requires the player to turn them on.
-- email_promotions stays an opt-out (default true) and is unchanged.
-- ============================================================================

alter table public.notification_preferences
  add column if not exists sms_marketing boolean not null default false;

alter table public.notification_preferences
  add column if not exists whatsapp_marketing boolean not null default false;

comment on column public.notification_preferences.sms_marketing is
  'Player opted in to promotional SMS. Default off. Not used for bulk blasts.';

comment on column public.notification_preferences.whatsapp_marketing is
  'Player opted in to promotional WhatsApp. Default off. 1:1 follow-up only.';

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
