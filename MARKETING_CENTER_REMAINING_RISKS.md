# Remaining marketing risks

Overall Marketing Center: 4/10. The screens tell the truth and reuse the email saver. Sending is not verified, and the live provider keys and cron secret are missing.

- Email cannot send on production until `RESEND_API_KEY` and `CRON_SECRET` are added. Do not paste them into chat.
- SMS cannot send until Twilio is configured, and US registration was not verified.
- Telegram promo can still land in the admin alert chat until a separate promo chat is set.
- Accepted is not delivered.
- Clicks, conversions, and revenue are not tracked.
- Browser tests and database concurrency tests were not run.
- Financial Center behavior was not changed. The $5 refund from 18 October stays as already recorded.
