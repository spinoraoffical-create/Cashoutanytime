# Marketing Center fixes

- `/admin/marketing-center` now reads saved opt-in counts, signup counts, campaign statuses, and provider-accepted emails. A failed query says Unavailable. Missing tracking says Not tracked.
- Create campaign at `/admin/marketing-center/create` saves through the existing newsletter action. The confirmation box is required before a schedule. An unchecked box stays a draft and sends nothing.
- Audience reads now say when the account or deposit scan hits its cap.
- Saving a campaign returns its id so a confirmed schedule can use the existing scheduler.
- `/api/cron/newsletter-send` is on a 15-minute Vercel schedule. It still refuses to run without `CRON_SECRET`. No campaign rows were waiting.
- Telegram, SMS, offers, promotions, and AI blog keep their existing pages. Wallet math was not changed.
