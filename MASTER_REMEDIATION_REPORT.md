# Master remediation report

Date: 17 October 2026

Project: Sweepstakes Hub

Branch: `restore/public-game-catalog`

Commit still at: `2f170db003abd97a3d754d7ee7c6df8668c79994`

Production deployment still: `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT`

Nothing in this session was committed, pushed, migrated, or deployed. No player balance, payment, payout, game transfer, or identity decision was made. The old Spinora project was not contacted.

## Plain result

The unsafe money paths are blocked in this working copy. The live website does not have those blocks yet. You should not take player money today.

## Issue results

### Money shutdown

- Original problem: Deposits and game transfers could run. Only three inactive providers were paused.
- Root cause: There was no single off switch on the server.
- Exact fix: `REAL_VALUE_DEPOSITS`, `REAL_VALUE_GAME_LOADS`, `REAL_VALUE_REDEMPTIONS`, and `REAL_VALUE_PAYOUTS` stay off unless the value is exactly `on`. Staff cash-out recording, load retry, automatic deposit loads, and ledger credits of those kinds use the same switch. Staff balance edits stay off unless `REAL_VALUE_ADJUSTMENTS` is exactly `on`.
- Files: `src/lib/compliance/real-value.ts`, payment routes, `paydora.ts`, `paydora-wallet.ts`, `auto-settle.ts`, `game-loads.ts`, `auto-ops.ts`, `admin/payouts.ts`, `admin/users.ts`, `service-mutate.ts`.
- Tests: `scripts/real-value-controls.test.mjs` passed. A disabled deposit does not call the provider or change the fixture balance.
- Production status: BLOCKED. The live deployment does not contain this code.
- Remaining risk: Promoting the old deployment `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT` would remove the switches and reopen deposits while Paydora keys remain.
- Owner action: Approve a deploy only with all five values unset. Do not roll back to the old deployment while Paydora keys are present.

### Webhook while deposits are off

- Original problem: A paid callback could be dropped with no record.
- Root cause: The first switch returned 503 before writing `webhook_events`.
- Exact fix: After the signature check, a held callback is saved as `received` with the note `held: deposits off`. A row that is already `processed` is not rewritten. The wallet is not credited. The response stays 503 so the provider can retry later.
- Policy: Do not treat the browser as proof of payment. When you later approve deposits, a retry may credit once through the existing duplicate check. If the provider stops retrying, the saved row is the reconciliation clue. Do not credit it by hand from the browser.
- Tests: Source order is checked in `scripts/real-value-controls.test.mjs`. Duplicate credit behavior is checked in `scripts/deposit-automation.test.mjs`.
- Production status: NOT VERIFIED on the live callback URL.
- Owner action: None until the deploy is approved.

### Age 18

- Original problem: The server stored any past date.
- Root cause: Only the browser checked the shape of the date.
- Exact fix: `src/lib/compliance/age.ts` rejects missing, invalid, future, and under-18 dates, including the day before a birthday and a leap-day birthday. Signup finish and money actions call it on the server.
- Tests: `scripts/real-value-controls.test.mjs` passed.
- Production status: BLOCKED until deploy. No existing date of birth was changed.
- Owner action: Ask counsel to confirm 18 is the required age.

### Location

- Original problem: Missing location evidence did not stop money, and API routes skipped middleware.
- Root cause: The check trusted a country header alone.
- Exact fix: Money actions now require Vercel's request id, a country, and a US state when the country is US. Washington, Idaho, Nevada, and Michigan stay blocked. Public pages still open without that evidence.
- Tests: `scripts/restricted-state.test.mjs` passed.
- Production status: BLOCKED until deploy.
- Remaining risk: A VPN can look like another state. This is not a legal opinion. The state list is still the existing default, not a new legal list.
- Owner action: Have counsel accept or replace `WA,ID,NV,MI`.

### Identity approval

- Original problem: Approve shows "The identity status could not be saved."
- Root cause: The live profile guard blocks the status write inside `admin_decide_kyc`.
- Exact fix prepared, not applied: `supabase/migrations/20261017000500_kyc_decision_profile_guard.sql` sets `app.wallet_update` only for that transaction, immediately before the profile update. Service-role and actor checks stay. One audit row is still written. A repeated decision returns before a second audit row. The screen copy is in the local admin card.
- Tests: `scripts/kyc-decision.test.mjs` passed on fixtures.
- Production status: BLOCKED. The live function still has no `set_config`. The real pending record was not touched.
- Owner action: Approve that one SQL file separately. Do not use the real pending record as the test.

### Stale game loads

- Original problem: A timeout could be confused with a failed load.
- Root cause: The live function returns without marking the row. It also does not refund.
- Exact fix prepared, not applied: `supabase/migrations/20261017000200_hold_stale_game_loads_for_review.sql` marks the row once and does not refund or retry.
- Tests: `scripts/stale-load-hold.test.mjs` and `scripts/game-load-outcome.test.mjs` passed.
- Production status: BLOCKED until that SQL is approved.
- Owner action: Approve that file separately from the identity SQL.

### Next.js

- Original problem: Next.js 15.5.19 had a critical advisory.
- Exact fix: This working copy uses Next.js 15.5.28. The critical range ended before 15.5.24.
- Tests: `npm audit --omit=dev` reports 0 critical. `npx tsc --noEmit`, `npx next lint`, and `npm run build` passed.
- Production status: BLOCKED. Production is still 15.5.19 until deploy.
- Remaining risk: 8 high findings remain in other packages. Next.js still has a moderate advisory. They were not exploited.

### Secrets, backups, mail, and legal

- Secrets: checklist only. NOT VERIFIED. Nothing was rotated.
- Backups: NOT VERIFIED. No restore was run.
- Mail, SMS, and Telegram: NOT VERIFIED. Those secret names are still absent.
- Legal and payment-provider approval: NOT VERIFIED. Pages for privacy, terms, and FAQ exist. That is not legal approval.

## Public site check on 17 October 2026

Homepage, play, robots, sitemap, login, privacy, terms, and FAQ returned 200. `/games?q=juwa` returned 308. Mobile layout was not clicked. These checks do not prove the new money code is live.
