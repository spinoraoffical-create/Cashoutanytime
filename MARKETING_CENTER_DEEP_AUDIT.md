# Marketing Center audit

Date: 19 October 2026. Branch `release/financial-center-2026-10-18`. Supabase project `zecitlewsynyioemsqna`. Production before this deploy was the live-chat release `dpl_5vThvyRrH3zhc9dJ11H99HbQLr2U`.

## What was actually there

`/admin/marketing-center` was a list of links. It did not show subscriber counts, campaign states, or provider readiness.

Email campaigns already exist at `/admin/newsletters`. They save drafts, count an audience, skip people with promotional email off, and call Resend. A recipient row marked sent means Resend accepted the request. It does not mean the inbox delivered it.

The send route `/api/cron/newsletter-send` existed and requires `CRON_SECRET`. It was not on the Vercel schedule. `vercel.json` only ran search indexing once a day. A scheduled email had a stored time and no worker.

A read of `newsletter_campaigns` returned no rows. Turning the schedule on does not send an old campaign.

Player search for live chat was a separate bug and is already deployed. Signup stores `email_promotions` only after the account form's email-notice checkbox. SMS marketing stays off unless a later preference turns it on.

Telegram promo falls back to the admin alert chat when `TELEGRAM_PROMO_CHAT_ID` is empty. That can mix promotions with staff alerts.

SMS STOP handling exists at `/api/sms/stop` and turns `sms_marketing` off after a valid Twilio signature.

## Confirmed gaps

- Marketing dashboard numbers were missing.
- Email scheduler was not scheduled.
- Vercel production env list has no `RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, `TELEGRAM_PROMO_CHAT_ID`, or `CRON_SECRET`. Names only were checked. Values were not printed.
- Clicks, opens, conversions, and revenue are not stored.
- AI blog, Telegram promo, and auto-post routes exist and are still not on the Vercel schedule. They were left off so this deploy does not publish or text anyone by itself.
