# Full working system report

Date: 18 October 2026

Production: https://www.sweeptakehub.com

Deployment serving that domain: `dpl_5TumMEUAubN26ji99A4rSAWSs5jD`

Previous deployment: `dpl_HdYKxe2bJKWUuyjuG5WpBEDV1Ti8`

Supabase project: `zecitlewsynyioemsqna`

Money switches stayed off. No wallet was credited. No provider game panel was called. No payout was submitted. The $10.99 payment was not refunded.

## 1. Bugs fixed

- A paused provider, a missing pause row, and a failed pause read now stop account creation, balance checks, loads, redeems, automatic fulfillment, the admin live-coins page, and the Fire Kirin / Milky Way health refresh. Only an explicit resumed row is open. VBlink follows the same rule.
- An unrecognized Paydora method is no longer stored as Cash App. Card, Google Pay, and Apple Pay are stored as themselves. A deposit credit refuses to continue when the saved method is missing.
- Checkout now saves the chosen method on the payment intent. The webhook passes that saved method into the wallet credit.
- The public payment-methods route returns HTTP 503 and the sentence "Deposits are temporarily unavailable" while deposits are off or the API key is absent. It does not describe the missing setting.
- The deposit-request check now allows card, Google Pay, and Apple Pay in addition to the older labels. Existing rows were not rewritten. Wallet totals stayed 0.00.

## 2. Files changed

- `src/lib/game-automation/provider-pause.ts`
- `src/lib/game-automation/provider-pause-read.ts`
- `src/lib/actions/game-loads.ts`
- `src/lib/admin/live-game-balances.ts`
- `src/lib/admin/live-game-balances-data.ts`
- `src/lib/admin/game-automation-health.ts`
- `src/app/admin/game-balances/page.tsx`
- `src/lib/payments/paydora-method.ts`
- `src/lib/payments/paydora-wallet.ts`
- `src/lib/payments/auto-settle.ts`
- `src/app/api/payments/paydora/create/route.ts`
- `src/app/api/payments/paydora/methods/route.ts`
- `src/app/api/payments/paydora/status/route.ts`
- `src/app/api/payments/paydora/webhook/route.ts`
- `scripts/provider-pause.test.mjs`
- `scripts/paydora-method.test.mjs`
- `supabase/migrations/20261018000100_paydora_method_label.sql`

The method migration is applied on `zecitlewsynyioemsqna`. The $10.99 intent is still uncredited. Profiles remain 5 and the wallet sum remains 0.00.

## 3. Tests

| Check | Class | Result |
| --- | --- | --- |
| 41 application tests | Unit test passed | 41 passed, 0 failed |
| TypeScript | Unit test passed | Passed |
| Production build, local and Vercel | Unit test passed | Passed. Next.js 15.5.28, 123 pages. Existing image and hook warnings only. |
| Paydora `GET /payment-methods` | Actual production provider operation verified | HTTP 200. Methods listed below. No charge was created. |
| Paydora `GET /deposits/6ad2f76612536669727a47b6` | Actual production provider operation verified | HTTP 200. Status `failed`. |
| Webhook signature and credit decision | Unit test passed | Passed. No live webhook was posted. |
| Deposit and payout idempotency against Paydora | Not run | No sandbox charge or payout was sent. |
| Game-provider load, redeem, or balance | Not run | No provider panel was contacted. |
| Signed-in browser session | Not run | No player, staff, or owner password was used. |
| PostgreSQL concurrency suite | Not re-run | The earlier isolated run still stands. This pass did not open a disposable database. |
| Production methods after deploy | Actual production check | HTTP 503 with the unavailable sentence. |
| Production create, signed out | Actual production check | HTTP 401. No checkout was created. |
| `/login` and `/play` | Actual production check | HTTP 200. |
| `/admin` without a session | Actual production check | HTTP 307 to login. |

## 4. Paydora documentation verified

The project has no separate Paydora PDF. The live merchant API at `https://cpcs.paydora.net/api/v1` was read with the supplied key. That host is the one already used by this codebase. No other payment company's signature scheme was copied.

Verified response fields on the deposit read: `id`, `referenceId`, `status`, `amount`, `paidAmount`, `userName`, `createdAt`, `processedAt`, `paidAt`, `refundAmount`, `refundKind`, `refundedAt`. There is no currency field on this deposit resource. The webhook decision still holds a paid callback that omits currency. That rule was not loosened, because this was a status read, not a signed webhook body.

Checkout code posts to `/deposits/create`. Payout code posts to `/withdrawals/create`. The webhook still checks `x-signature` as `sha256=` plus HMAC-SHA256 of the raw body. A live signed webhook was not received in this pass, so the event names in a real callback remain unit-tested rather than verified against a captured payload.

## 5. Paydora deposits

Status of intent `0c70e8b2-7e6f-466a-820c-d9879fbff66d` / Paydora `6ad2f76612536669727a47b6`:

| Field | Verified value |
| --- | --- |
| Status | failed |
| Amount | 10.99 |
| Paid amount | empty |
| Paid at | empty |
| Refund amount | empty |
| Reference | 2026OCT17-5446 |
| Created | 2026-10-17 04:19:50 UTC |
| Processed | 2026-10-17 04:50:03 UTC |
| Matches the saved player and amount | yes |
| Wallet credit | still empty |

Reconciliation: do not credit this player. Do not refund it. Paydora shows it failed and nothing was captured.

Live deposit methods from the merchant account: Card Payments, Chime, Cash App, Google Pay, Apple Pay. Withdrawal methods: Card Payments, Chime, Cash App.

New checkout creation: BLOCKED BY EXTERNAL ACCESS until deposits are explicitly enabled. The switch is off, the API key is not in Vercel, and this pass did not create a test charge.

## 6. Paydora payouts

FIXED BUT UNTESTED as a live payout. The payout route still requires a signed-in player, eligibility checks, and the payout switch. The switch is off. Database payout requests remain 0. No success, failure, or timeout was sent to Paydora. A timeout is not treated as a failure by the existing reservation code; that behavior was not exercised against Paydora.

## 7. Game providers

No provider was called. None is WORKING.

| Provider | Result |
| --- | --- |
| Juwa | BLOCKED BY EXTERNAL ACCESS. Paused. No test account was used. |
| Game Vault | BLOCKED BY EXTERNAL ACCESS. Paused. |
| Vegas Sweeps | BLOCKED BY EXTERNAL ACCESS. Paused. |
| Cash Frenzy | BLOCKED BY EXTERNAL ACCESS. Paused. |
| Cash Machine | BLOCKED BY EXTERNAL ACCESS. Paused. |
| Game Room | BLOCKED BY EXTERNAL ACCESS. Paused. |
| Mr All In One | BLOCKED BY EXTERNAL ACCESS. Paused. |
| Mafia | BLOCKED BY EXTERNAL ACCESS. Paused. |
| Fire Kirin | BLOCKED BY EXTERNAL ACCESS. Paused. The health page no longer logs in while the row is paused. |
| Milky Way | BLOCKED BY EXTERNAL ACCESS. Paused. Same health-page gate. |
| Orion Stars | BLOCKED BY EXTERNAL ACCESS. Paused. |
| VBlink | BLOCKED BY EXTERNAL ACCESS. No pause row, so the new rule keeps it closed. |
| Panda Master | BLOCKED BY EXTERNAL ACCESS. No API client exists in this project. |

## 8. Customer workflows

Public `/login` and `/play` return 200 on the new deployment. Registration, email verification, password reset, KYC upload, deposit, game load, redeem, payout, notifications, email, and SMS were not completed with a test account in a browser. Those journeys are FIXED BUT UNTESTED as live sessions. Unit tests cover auth codes, KYC decision rules, and deposit access.

## 9. Admin workflows

Unsigned `/admin` redirects to login. Staff-access unit tests passed. A signed-in owner, staff, store, or sub-creator session was not opened. The real pending KYC submission was not approved or rejected. Admin operations in a browser are FIXED BUT UNTESTED.

## 10. Database and wallet

The method column and the wider deposit-method check are applied. The five real-value controls and their triggers were not turned off and were not dropped. Wallet sum 0.00. The failed $10.99 intent is still uncredited. Isolated concurrency tests were not re-run in this pass.

## 11. Deployment

`dpl_5TumMEUAubN26ji99A4rSAWSs5jD` is Ready and aliased to https://www.sweeptakehub.com and https://sweeptakehub.com. Inspect confirms that alias. `REAL_VALUE_*` switches were not set. The Paydora API key was not written to Vercel. The older deployment that still had a payment key was not promoted.

## 12. Credentials requiring owner action

The API key was pasted in chat and then used for two read-only GETs. It is not stored in git or in Vercel. Revoke that key in the Paydora dashboard and create a replacement there. Do not paste the replacement into chat. Leave it out of Vercel until deposits are separately approved. The failed $10.99 payment does not need that key anymore.

The webhook secret is still the one already in Vercel. It was not printed and was not rotated.

## 13. Outstanding external dependencies

- Provider-approved test accounts for each game that should resume.
- A Paydora test deposit and a test payout, including a signed webhook, after the replacement key is stored and deposits are approved.
- A private backup of the identity image bytes. Storage was not changed. The file was not made public.
- Supabase point-in-time recovery was not opened in the dashboard.

## 14. Compliance

No counsel letter, license, official-rules approval, or free-entry method was found in this pass. Age 18 and the state block in code are not that approval. Do not treat the public site as legally cleared for real-money play.

## 15. Activation steps

Do not run these until each line has its own evidence. Leave the database triggers in place.

1. Revoke the chat-exposed Paydora key and store the replacement only in the Vercel dashboard.
2. Run one test deposit: success, failure, cancel, duplicate webhook, and a USD amount that matches the intent. Then enable deposits.
3. Resume one provider only after its test account passes create, lookup, balance, load, redeem, and a duplicate request. Repeat per provider.
4. Enable loads and redemptions only for providers that passed step 3.
5. Run one test payout through success, failure, and timeout. Then enable payouts.
6. Enable staff adjustments only for the approved owner path.

## Feature results

| Feature | Result |
| --- | --- |
| Read the outstanding $10.99 payment | WORKING. Paydora status is failed. It was not credited. |
| Deposit checkout and wallet credit | BLOCKED BY EXTERNAL ACCESS. Switches are off. No test charge was sent. |
| Payment method label | FIXED BUT UNTESTED against a new live checkout. The failed payment was not relabeled. |
| Disabled-payment response | WORKING on production. HTTP 503, no configuration text. |
| Payouts | FIXED BUT UNTESTED. No Paydora payout was sent. |
| Provider pause, including a missing row | FIXED BUT UNTESTED on a live panel. Unit tests passed. Production now serves this code. No provider was contacted to prove the refusal. |
| Every game load and redeem | BLOCKED BY EXTERNAL ACCESS. |
| Customer signed-in journey | FIXED BUT UNTESTED. |
| Admin signed-in operations | FIXED BUT UNTESTED. |
| Full real-money launch | BLOCKED BY EXTERNAL ACCESS. |
