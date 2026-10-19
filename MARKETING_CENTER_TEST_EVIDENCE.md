# Marketing test evidence

Passed:

- `scripts/marketing-center.test.mjs`
- `scripts/marketing-center-ui.test.mjs`
- `tsc --noEmit` exit 0

Not tested:

- A real Resend send
- A real Twilio send or STOP webhook
- A real Telegram post
- Playwright or a browser pass of the new screens
- PostgreSQL concurrency
- The first Vercel cron execution
- Production player inboxes

No production player was emailed, texted, or posted to during these checks.
