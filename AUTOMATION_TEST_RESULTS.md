# Automation test results

Date: 13 October 2026.

These checks did not call cron routes, Paydora, Resend, Twilio, or Telegram. They did not run SQL against production.

## Mock rules

Command: `node scripts/automation-health.test.mjs`

Result: **passed** (`automation health checks passed`).

What it checked, with a fixed clock of 13 October 2026 12:00 UTC:

| Case | Result |
|---|---|
| Switch on, last run just now, but the path is not in the Vercel schedule | `not_scheduled` |
| Path is scheduled and the switch is off | `off` |
| Path is scheduled and no last-run time is stored | `unknown` |
| Last run 72 hours ago, expected every 24 hours | `stale` |
| Last run 4 hours ago, expected every 24 hours | `ok` |
| Cash-out status `submitted` and no provider status | Needs a person |
| Cash-out status `submitted` and provider status `paid` | Does not need an automatic retry flag |
| Cash-out status `paid` or `failed` with an empty provider status | Does not need an automatic retry flag |

The classifier lives in `src/lib/automation/health-rules.ts`. It has no database client and no network call.

## Typecheck

`npx tsc --noEmit` finished with exit code 0 after the job status type was pinned. The first run failed because a mapped list widened the status to a plain string. That is fixed.

## Follow-up on 13 October 2026

`node scripts/automation-health.test.mjs` passed again. No cron URL was called. No campaign, SMS, email, or Telegram message was sent.

Game-load timeouts are no longer closed by the page timer. Unknown provider errors stay pending instead of being retried. That decision is covered by `node scripts/game-load-outcome.test.mjs`, which passed.

`fail_stale_game_loads` in the database can still refund a timed-out load until `supabase/migrations/20261013000130_hold_unknown_game_loads.sql` is approved and run. That file was not run.

## What was not tested

- Opening `/admin/automation` in a signed-in browser. Port 3000 was already in use, and this task must not send live mail or start a second site that hits production cron.
- A real IndexNow submit, newsletter batch, Telegram post, or Paydora webhook.
- Whether `paydora_payout_requests` exists in production. If that table is missing, the page shows “Not available” for the cash-out count and does not write anything.
- Provider uptime. The page only checks that a secret name is set.
