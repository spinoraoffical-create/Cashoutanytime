# Launch blockers

Audit date: 17 October 2026

Production: https://www.sweeptakehub.com

Deployment inspected: `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT`

Supabase project queried: `zecitlewsynyioemsqna`

No production data was changed. No migration was applied. No real payment, payout, or KYC decision was made.

## P0 — Server does not enforce 18+

- Severity: P0
- Affected system: Signup and deposits
- Root cause: Registration stores `date_of_birth` when a date is sent. The signup screen only checks that the value looks like a date and is not in the future. The deposit route does not read the date of birth. Terms text says 18+, and the server does not enforce it.
- Evidence: `src/components/auth/email-auth-form.tsx` date check; `src/lib/actions/auth.ts` `finalizeRegistrationAfterSignUp`; `src/app/api/payments/paydora/create/route.ts` has no age check; `src/app/terms/page.tsx` states 18+.
- Required fix: Reject under-18 dates on the server before the account is created, and again before any deposit, game load, redemption, or withdrawal.
- Verification test: A fixture date of birth under 18 is rejected by the server action and by the deposit route. A date of 18 or older is accepted. The test must not create a real player.
- Current status: Local code fixed on 17 October 2026. Not deployed. Signup and the server registration finish now reject a missing or under-18 date before the profile is saved. Deposit, load, redemption, payout, and webhook credit also check age. Fixture: a birth date of 2008-10-18 is rejected on 2026-10-17, and 2008-10-17 is accepted. Production still runs the old deployment until a release is approved.

## P0 — Exposed secrets have no recorded rotation

- Severity: P0
- Affected system: Game-agent credentials and the database password
- Root cause: Earlier project work recorded that game-agent credentials were shown in screenshots and that a database password was exposed and must be rotated. This audit did not rotate anything and did not find a rotation record.
- Evidence: Production still has secret names for Juwa, Game Vault, Vegas Sweeps, Cash Frenzy, Cash Machine, Game Room, Mr All In One, Fire Kirin, Milky Way, and Orion Stars. Values were not printed. The database password is not an application environment variable, so its rotation cannot be seen from Vercel.
- Required fix: Rotate every credential that was shown or exposed. Confirm the new values only in the password manager and in Vercel or Supabase. Do not paste them into chat.
- Verification test: Owner confirms each rotated secret by name and date. A read-only provider balance check uses the new secret without printing it. The old database password no longer connects.
- Current status: Still blocked. `SECRET_ROTATION_CHECKLIST.md` lists the secret names to rotate. No value was printed and nothing was rotated.

## P1 — Identity approval cannot be saved in production

- Severity: P1
- Affected system: Admin Verification Center and `public.admin_decide_kyc`
- Root cause: The live function updates `profiles.kyc_status`. The profile guard allows that write only when the old JWT role setting is service role, when `app.wallet_update` is true, or when `is_admin()` is true. Inside this function the old JWT role setting is empty, the service-role user id is empty, and `app.wallet_update` is never set. The guard raises `column protected` (`42501`). The whole review rolls back, so the request stays Pending. The screen then says "The identity status could not be saved."
- Evidence: Live function `admin_decide_kyc(uuid, text, uuid, text, text)` contains the service-role check and does not contain `set_config`. Live `protect_profile_columns` contains `app.wallet_update` and does not read `request.jwt.claims`. One KYC row is pending. The local SQL file `supabase/migrations/20261017000500_kyc_decision_profile_guard.sql` is not applied. The local screen changes are not in deployment `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT`.
- Required fix: Apply the prepared function replacement only after owner approval. It sets `app.wallet_update` for that transaction only, before the profile update. Then deploy the matching screen copy. Do not approve the real pending record as the test.
- Verification test: A disposable pending KYC row can be approved and rejected by an authorized admin, stays unchanged for an unauthorized caller, and does not create a second audit row when reviewed again.
- Current status: Still blocked in production. The prepared SQL stays unapplied. It only adds a transaction-local guard flag before the profile update, keeps the service-role and actor checks, and still writes one audit row. `scripts/kyc-decision.test.mjs` passed on fixtures. The real pending record was not changed.

## P1 — Deposits are not switched off

- Severity: P1
- Affected system: Paydora deposits
- Root cause: Production has `PAYDORA_API_KEY` and `PAYDORA_WEBHOOK_SECRET`. The create route starts a live checkout when a signed-in player chooses a game and a listed amount. There is no maintenance switch on that route. Wallet credit is intended to happen only in the signed webhook, but that path was not executed in this audit.
- Evidence: `src/app/api/payments/paydora/create/route.ts`; `src/app/api/payments/paydora/webhook/route.ts` rejects a missing or bad signature; `src/app/api/payments/paydora/status/route.ts` is read-only. Live counts: `payment_intents` = 1, `deposit_requests` = 0, `wallet_transactions` = 0. NOWPayments code was not found.
- Required fix: Keep deposits disabled until webhook amount checks, duplicate delivery, and failed or cancelled payments pass a mock test against the deployed code. Do not run a real card payment for the test.
- Verification test: Invalid signature is rejected. A repeated paid callback credits once. A failed status does not credit. The browser status route cannot credit a wallet.
- Current status: Local switch fixed, production still blocked until deploy. Deposits stay off unless `REAL_VALUE_DEPOSITS=on`. The Paydora create call, wallet credit, and refund reversal all check that switch. A signed webhook returns 503 and does not credit while the switch is off. Duplicate-credit fixture in `scripts/deposit-automation.test.mjs` passed. No live payment was sent. Do not set the switch to `on` in production.

## P1 — Active game transfers are not paused

- Severity: P1
- Affected system: Game loads and redemptions
- Root cause: The pause table contains only Fire Kirin, Milky Way, and Orion Stars, and those three games are inactive. Juwa, Game Vault, Vegas Sweeps, Cash Frenzy, Cash Machine, Game Room, and Mr All In One have production credential names and are active. Mafia is active and has no matching credential names. The transfer pause used by Fire Kirin, Milky Way, and Orion Stars is not a global off switch.
- Evidence: Live `games.is_active` is true for eight games. Live `provider_automation_controls` has three paused rows. Production environment names include the seven credential sets above. Existing `game_load_requests` are 12 completed and 1 failed, and every amount sum is 0.00. This audit did not send a recharge or redemption.
- Required fix: Keep every provider paused for real value until recharge, redemption, timeout, and duplicate protection pass on mocks. Do not treat a zero-amount completed row as a successful money transfer.
- Verification test: A paused provider returns the paused decision and does not call the provider. A duplicate operation key does not send a second transfer.
- Current status: Local switch fixed, production still blocked until deploy. Loads and redemptions stay off unless `REAL_VALUE_GAME_LOADS=on` and `REAL_VALUE_REDEMPTIONS=on`. The player actions return before the wallet reservation. The provider call returns before the external request. Automatic deposit loads are skipped. Duplicate and timeout fixtures passed in `scripts/transfer-ledger.test.mjs` and `scripts/game-load-outcome.test.mjs`. No live transfer was sent.

## P1 — State eligibility is only an IP header

- Severity: P1
- Affected system: Pages, deposits, and withdrawals
- Root cause: Middleware redirects Washington, Idaho, Nevada, and Michigan using Vercel country and region headers. The middleware matcher skips every `/api` route. Paydora create and payout check the same headers themselves. A missing country header is not treated as restricted. The player's saved address is not the control. A VPN can present another region.
- Evidence: `src/middleware.ts` matcher excludes `api`. `src/lib/compliance/restricted-state.ts`. `RESTRICTED_STATES` is not set in production, so the code default `WA,ID,NV,MI` applies.
- Required fix: Enforce the same eligibility rule on the server for every deposit, load, redemption, and withdrawal, including when the IP header is missing. Decide with counsel whether IP headers are acceptable.
- Verification test: A restricted-region header is rejected by the page and by both payment routes. A fixture with no region header does not silently pass a money action.
- Current status: Local money paths fixed, legal acceptance not verified. Deposit, payout, load, and redemption now reject a missing country, a US visit with no state, and Washington, Idaho, Nevada, and Michigan. Public pages still open when the location header is missing. A VPN can still look like another state. Counsel has not accepted IP headers as the legal control.

## P1 — Critical dependency advisory on the installed Next.js

- Severity: P1
- Affected system: Production application dependencies
- Root cause: `npm audit --omit=dev` reports Next.js 15.5.19 as critical, plus eight high findings in other production packages. This audit did not attempt those issues and did not upgrade packages.
- Evidence: Installed `next` version `15.5.19`. Audit counts: 1 critical, 8 high, 33 moderate, 0 low. Command: `npm audit --omit=dev --json`.
- Required fix: Review the advisory against this Vercel deployment and upgrade only through a separate tested release. Do not treat the audit count as permission to change the framework during launch.
- Verification test: After an approved upgrade, `npm audit --omit=dev` no longer reports the critical finding, and the production build and money tests still pass.
- Current status: Critical Next.js finding fixed in the working tree, not deployed. Installed Next.js is 15.5.28. The critical range ended before 15.5.24. `npm audit --omit=dev` now reports 0 critical. Eight high findings remain in other packages, and Next.js still has a moderate advisory. `npm run build` passed on 15.5.28. Production is still 15.5.19 until a release is approved.

## P2 — Automatic cash outs are held, not proven safe

- Severity: P2
- Affected system: Paydora payouts
- Root cause: `platform_ops` has no rows. The payout route returns a hold and does not charge the wallet when that row is missing. Local reservation code is meant to stop a second provider call. It was not executed against production.
- Evidence: Live query returned no `platform_ops` rows. `src/app/api/payments/paydora/payout/route.ts` returns before `reserve_paydora_payout` when the row is missing. `scripts/payout-reservation.test.mjs` and `scripts/payout-operations-security.test.mjs` passed locally.
- Required fix: Leave the hold in place. Before any real payout, prove with mocks that a double-click, a timeout, and a repeated webhook cannot create a second provider payout.
- Verification test: Two concurrent fixture requests produce one provider call. A timeout does not send a second payout.
- Current status: Not verified on the live database. Local fixture: 12 concurrent reservations debit once and reuse one key. A timeout is classified as ambiguous and does not send a second provider call. Player and staff payout paths now also require `REAL_VALUE_PAYOUTS=on`, which is unset. No live payout was sent.

## P2 — Stale game loads are not marked for review

- Severity: P2
- Affected system: `public.fail_stale_game_loads`
- Root cause: The live function does not update rows, does not call a refund function, and does not contain the review note. The safer local file `supabase/migrations/20261017000200_hold_stale_game_loads_for_review.sql` is not applied.
- Evidence: Live function positions for `held for review`, `refund_game_load_wallet`, `credit_wallet`, and `UPDATE` were all 0. `RETURN` is present.
- Required fix: Do not apply the SQL until the owner approves it. Do not refund a load whose provider result is unknown.
- Verification test: A fixture stale row stays pending, is marked once, and is not credited again.
- Current status: Still blocked. The review-hold SQL is still unapplied. Local `scripts/stale-load-hold.test.mjs` passed. An unknown provider result still does not refund in the local outcome rules.

## P2 — Mail, SMS, Telegram, and cron are not configured in production

- Severity: P2
- Affected system: Resend, Twilio, Telegram, scheduled jobs
- Root cause: Production environment names do not include `RESEND_API_KEY`, Twilio keys, Telegram keys, or `CRON_SECRET`. Signup codes use Supabase email, not Resend. Cron routes fail closed when the secret is missing.
- Evidence: Production name list from `npx vercel env ls production`. `src/lib/cron/auth.ts`. `src/lib/email/resend.ts`.
- Required fix: Add only the secrets that counsel and operations approve. Do not send a marketing campaign as a test.
- Verification test: A test mailbox receives one signup code. An unsubscribed fixture is excluded from a campaign dry run. A cron call without the secret is rejected.
- Current status: Not verified. No mail, SMS, Telegram, or cron secret was added.

## P2 — Backups, restore, and monitoring were not proven

- Severity: P2
- Affected system: Production operations
- Root cause: This audit did not open Supabase backup settings, did not run a restore drill, and did not find a confirmed error-alerting channel. Telegram alerts are not configured.
- Evidence: No backup timestamp was queried. Production has no Telegram token name.
- Required fix: Confirm automated backups and a restore drill before any player funds are accepted. Confirm an alert path for failed payments and failed game loads.
- Verification test: A backup timestamp is recorded, and a restore is rehearsed on a copy. No production restore was attempted here.
- Current status: Not verified. No backup timestamp was opened and no restore was rehearsed.
