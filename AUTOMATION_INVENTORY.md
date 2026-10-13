# Automation inventory

Read of the jobs that already exist. Nothing here is a second scheduler. Vercel is scheduled to call one path: `/api/cron/seo-index` at 08:00 UTC (`vercel.json`). The other cron routes exist and require `CRON_SECRET`, but this project does not list them on the Vercel schedule. No `pg_cron` job was found in the repo.

There is no separate queue worker. Work runs inside the HTTP request that triggers it.

## How to read a row

- **Trigger** is what starts the work.
- **Scheduler** is what is actually on a timer in this repo.
- **Authentication** is who is allowed to call it.
- **Retry** is what the code does after a failure. A blank automatic retry means a person decides.

## Scheduled and callable jobs

### Search index (`GET /api/cron/seo-index`)

| | |
|---|---|
| Trigger | Vercel Cron, daily 08:00 UTC |
| Scheduler | `vercel.json` only |
| Authentication | Bearer `CRON_SECRET`. Missing secret returns 503. Wrong secret returns 401. |
| Input validation | No body. It lists public URLs already in the app. |
| Processing | Submits those URLs to IndexNow. |
| Retry | None in the app. A 502 is the HTTP result. The next day is the next attempt. |
| Idempotency | IndexNow can receive the same URL again. That does not change a wallet. |
| Error handling | Returns 502 when the submit result is not ok. |
| Logs | Cron auth logs a missing secret. The route does not write a last-run row. |
| Alerting | Automation page shows “Last run is not stored.” |
| Recovery | Wait for the next 08:00 UTC run, or call the route once with the cron secret from a trusted host. Do not call it from a test that you do not intend to notify search engines. |

### Newsletter send (`GET` or `POST /api/cron/newsletter-send`)

| | |
|---|---|
| Trigger | Something outside Vercel (the route comment names cron-job.org). Not in `vercel.json`. |
| Scheduler | Not scheduled here |
| Authentication | Same Bearer `CRON_SECRET` |
| Input validation | Selects campaigns whose status is `scheduled` or `sending` and whose `scheduled_at` is due. |
| Processing | `processCampaignBatch`. Each pending recipient is claimed by moving the row from `pending` to `failed` with error `Sending.` before Resend is called. Consent is checked immediately before send: no preference row, `email_promotions` not true, banned, or suspended means skip. |
| Retry | A claimed row stays `failed` until a person changes it. The route does not reset failed recipients. |
| Idempotency | The claim update only matches `pending`, so two workers cannot both send the same row. |
| Error handling | Missing admin client returns 500. Missing `RESEND_API_KEY` marks the campaign failed and stores “RESEND_API_KEY is not configured in env.” on recipients. That path does not increase `failed_count`. |
| Logs | Recipient `error` text. `console` only. No error tracker. |
| Alerting | Automation page counts failed campaigns and campaigns still `sending` or overdue by more than one hour. |
| Recovery | Fix the missing key, then a person decides whether to queue a new campaign. Do not re-queue the failed “First deposit reminder” unless you intend to email those people. |

### Telegram promo (`GET` or `POST /api/cron/telegram-promo`)

| | |
|---|---|
| Trigger | External caller. Comment mentions an hourly Vercel cron. `vercel.json` does not include it. |
| Scheduler | Not scheduled here |
| Authentication | Bearer `CRON_SECRET` |
| Input validation | Handled inside `runTelegramPromoBroadcast`. |
| Processing | Can send a Telegram promo. |
| Retry | Failure returns 500 and `console.error`. No automatic second send in this route. |
| Idempotency | Not a per-message lock in this route. Calling it twice can send twice. |
| Error handling | 500 JSON. |
| Logs | `[cron] telegram-promo` |
| Alerting | Automation page says the job is not on the Vercel schedule. |
| Recovery | Leave it unscheduled unless a person wants a send. Do not call it to “test.” |

### Telegram auto-post (`GET` or `POST /api/cron/telegram-auto-post`)

| | |
|---|---|
| Trigger | External caller. Not in `vercel.json`. |
| Scheduler | Not scheduled here |
| Authentication | Bearer `CRON_SECRET` |
| Input validation | Skips when `auto_post_blog` is false. |
| Processing | Posts the latest published blog row with `telegram_sent` false. Sets `telegram_sent` true only after a successful broadcast. If no post is waiting and promos are on, it can broadcast a promo string. |
| Retry | A failed broadcast leaves `telegram_sent` false, so the next successful call can send that post. That is a content retry, not a wallet retry. |
| Idempotency | `telegram_sent` true blocks the same post on a later call. |
| Error handling | Missing database client returns 500. |
| Logs | Route errors follow the Telegram helpers. |
| Alerting | Same “not on the Vercel schedule” notice. |
| Recovery | Turn the switch off in Telegram settings, or leave the route uncalled. |

### Telegram daily autopilot (`GET` or `POST /api/cron/auto-post`)

| | |
|---|---|
| Trigger | External caller, or the admin autopilot button. Not in `vercel.json`. |
| Scheduler | Not scheduled here |
| Authentication | Cron secret on this route. The admin route uses staff `cms.manage`. |
| Input validation | Inside `runAutopilotDailyPostNow`. |
| Processing | Can publish and send. |
| Retry | No automatic retry loop in the route. |
| Idempotency | Depends on the autopilot helper and saved last-run time. A second manual click can send again. |
| Error handling | Returns the helper’s error. |
| Logs | `console` in the helper path. |
| Alerting | Automation page reads `last_autopilot_at`. Switch off, or not scheduled. |
| Recovery | Use the existing admin autopilot screen only when a person wants a real post. |

### AI blog (`GET` or `POST /api/cron/auto-blog`)

| | |
|---|---|
| Trigger | External caller. Not in `vercel.json`. |
| Scheduler | Not scheduled here |
| Authentication | Bearer `CRON_SECRET` |
| Input validation | Skips when the saved blog switch is off. Unless `?force=true`, it skips when `posting_frequency_hours` has not elapsed. |
| Processing | Generates and saves a post. May broadcast to Telegram when both auto flags are on, then IndexNow. |
| Retry | A 500 does not roll forward a timer by itself. The next caller can try again after the frequency window. `force=true` bypasses the window. |
| Idempotency | Frequency window is the guard. `force=true` removes it. |
| Error handling | 500 JSON with the generator error. |
| Logs | No dedicated job table. `last_generated_at` is the heartbeat when a run is saved. |
| Alerting | Automation page. A missing settings row is treated as unknown switch data, not as “healthy.” `getBlogSettings()` itself falls back to an enabled default when the read throws. The health page does not use that fallback. |
| Recovery | Leave the route uncalled. Publishing and Telegram stay on the existing admin tools, with the frequency limit. |

### AI self-analyze (`GET` or `POST /api/cron/ai-self-analyze`)

| | |
|---|---|
| Trigger | External caller. Not in `vercel.json`. |
| Scheduler | Not scheduled here |
| Authentication | Bearer `CRON_SECRET` |
| Input validation | Inside `runSystemSelfAnalysis`. |
| Processing | Scores health. If the score is under 90 it can message the admin Telegram channel. That send is not awaited. |
| Retry | None. |
| Idempotency | Each call can message again. |
| Error handling | Returns the analysis result. A Telegram failure is not raised to the caller. |
| Logs | No saved run row for this route. |
| Alerting | Not a separate card. It is covered by “not on the Vercel schedule.” |
| Recovery | Do not call it to test. It can send a real Telegram message. |

## Admin actions that start the same work

| Path | Who | What it does |
|---|---|---|
| `POST /api/admin/autopilot` | Staff with `cms.manage` | Toggle or run the daily autopilot. Can send. |
| `POST /api/admin/telegram-broadcast` | Staff with `cms.manage` | Sends a photo, a message, or a default promo. Can send. |

The Automation page does not call these.

## Payments

### Paydora deposit webhook (`POST /api/payments/paydora/webhook`)

| | |
|---|---|
| Trigger | Paydora |
| Scheduler | None |
| Authentication | `x-signature` checked with `PAYDORA_WEBHOOK_SECRET`. Missing secret returns 500. Bad signature returns 401. |
| Input validation | JSON body. Credit only for `deposit.paid` with a saved `payment_intents` row for that `depositId`. Credit amount is the smaller of the saved amount and the collected amount. |
| Processing | `creditPaydoraDeposit` uses the saved user id, not a user name from the webhook, for the wallet credit. Refund events call `reversePaydoraDeposit`. |
| Retry | A thrown error returns HTTP 500 with body `RETRY`, which asks Paydora to try again. |
| Idempotency | `paydora_processed_events.payment_id` is the primary key, so the same payment id is not credited twice. |
| Error handling | 400 bad JSON, 401 bad signature, 500 on processing errors. |
| Logs | `[paydora/webhook]` on `console.error`. `auto-settle` can upsert `webhook_events` (`received`, `processed`, `failed`, `ignored`). |
| Alerting | Automation snapshot counts `webhook_events` with status `failed` in the last 24 hours. The dashboard also has a failed-webhook count for Super Admin. |
| Recovery | If the payment id is already processed, do not credit it again. If provider status is unclear, reconcile the Paydora id before any wallet change. |

### Player cash-out (`POST /api/payments/paydora/payout`)

| | |
|---|---|
| Trigger | The signed-in player |
| Scheduler | None |
| Authentication | Player session, then `reserve_paydora_payout` and `begin_paydora_provider_attempt` |
| Input validation | Reservation comes from SQL. The route refuses an empty idempotency key and any key that starts with `refund:`. |
| Processing | Reserves wallet funds, then talks to Paydora. Statuses include `requested`, `reserved`, `submitted`, `paid`, `failed`, `manual_review`. |
| Retry | This reliability work does not add one. A row in `reserved` or `submitted` with an empty `provider_status` is shown as needing a person. |
| Idempotency | The SQL idempotency key is the payout key. |
| Error handling | If the reservation function is missing, the route returns an error and does not pay. |
| Logs | Existing payout row and `provider_status`. |
| Alerting | Count on the Automation page. No payout button was added. |
| Recovery | A person reconciles the Paydora payout id. Unknown provider status is not an automatic retry. |

### Admin payout action (`payoutCashout`)

Staff with `requests.manage` can call `admin_payout_cashout`. Store and sub-creator scopes are not applied on that action. This inventory does not change it.

### Deposit checkout (`POST /api/payments/paydora/create`)

Creates a checkout. The idempotency key includes the current time, so two clicks are two checkouts. One Paydora payment id is still credited once.

## Consent and opt-out

| Path | Role |
|---|---|
| `POST /api/email/unsubscribe/[userId]/[token]` | Turns off offer email for a valid token. |
| `POST /api/sms/stop` | Twilio-signed STOP. Sets SMS marketing off for that phone. Unsigned requests get 403. |

Newsletter sends re-check `email_promotions` immediately before Resend. Offer email and SMS also require the matching consent flag, and `offer_deliveries` blocks a second email or SMS to the same person on the same UTC day.

## Chat helpers

`/api/chat/live-bot`, `/api/chat/ai-bot`, and `/api/chat/after-send` answer a player chat. They are not cron jobs. Live bot and AI bot return 429 when rate limited. They do not move wallets.

## What was added for visibility

`/admin/automation` now reads existing rows and environment-variable presence:

- Job health: switch off, not on the Vercel schedule, last run not stored, last run late, or inside the expected window.
- Alerts on the page for unscheduled jobs, late saved runs, stuck or failed email campaigns, cash outs with no provider status, and failed webhook rows.
- A daily snapshot of those counts. It is not emailed.
- Provider lines for Paydora, Resend, Twilio, Telegram, and the cron secret. “Present” means the variable is non-empty. It does not call the provider.

No new table, no production migration, and no change to who can open the page. Operators are still Super Admin, admin, or manager.
