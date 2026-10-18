# Full system activation report

Date: 18 October 2026

Production: https://www.sweeptakehub.com

Vercel project: `cashoutanytime`

Supabase project: `zecitlewsynyioemsqna`

Deployment serving the domain: `dpl_HdYKxe2bJKWUuyjuG5WpBEDV1Ti8`

This pass finished the one release-blocking code gap that the safety release left open, then rechecked Paydora, the game providers, and the money switches. It did not turn real-money features on. It did not call Paydora. It did not call a game provider. It did not credit the $10.99 intent. It did not change a balance, a pause row, or a database trigger.

Real-money deposits: NO-GO

Paydora payouts: NO-GO

Game loads: NO-GO for every provider

Redemptions: NO-GO

Staff adjustments: NO-GO

Full launch: NO-GO

## What was fixed

The safety release stored pause rows for eleven providers. The fulfillment code that was deployed did not read those rows. A zero-amount account create and a balance check could still call a provider. The admin live-coins page also called every configured panel when a super admin opened it.

Local code now refuses a paused provider before any wallet debit and before any provider call:

- Account create, balance check, load, and redeem stop first.
- A failed pause read stops the call. A missing pause row does not invent a pause.
- Automatic fulfillment of an existing request stops the same way, and it does not refund or close that request.
- The admin live-coins page shows Paused and does not log in to a paused panel. A failed pause read skips every listed panel.

This fix is in the local working tree. It is not on `dpl_HdYKxe2bJKWUuyjuG5WpBEDV1Ti8`. Until that build is deployed, production can still call a provider for account create, balance check, and the admin live-coins page. Paid loads and redeems on production remain stopped by the database guard and by the absent application switches.

No other customer or admin screen was redesigned.

## What was tested

| Check | Result |
| --- | --- |
| Application tests | 40 passed, 0 failed. This includes the new pause check, webhook decision, real-value switches, staff access, KYC decision, deposit access, and payout reservation. |
| TypeScript | Passed |
| ESLint on the changed files | Passed, no warnings |
| Production build | Passed locally. Next.js 15.5.28, 123 pages. Existing image and hook warnings only. |
| Live Paydora charge, webhook, refund, or payout | Not run |
| Live provider account, load, redeem, or balance call | Not run |
| PostgreSQL concurrency suite | Not re-run in this pass. The earlier isolated run remains the evidence for duplicate credits and overlapping loads. |
| Signed-in player, staff, store, or owner browser session | Not opened |

The local build was not deployed.

## Provider integrations

None of the eight catalog providers is verified for account creation, lookup, balance, load, redeem, confirmation, duplicate prevention, timeout recovery, or reconciliation. No provider-approved test account was used. No live panel was contacted.

| Provider | Pause row in production | Load / redeem | Resume |
| --- | --- | --- | --- |
| Juwa | Paused | NOT VERIFIED | NO-GO |
| Game Vault | Paused | NOT VERIFIED | NO-GO |
| Vegas Sweeps | Paused | NOT VERIFIED | NO-GO |
| Cash Frenzy | Paused | NOT VERIFIED | NO-GO |
| Cash Machine | Paused | NOT VERIFIED | NO-GO |
| Game Room | Paused | NOT VERIFIED | NO-GO |
| Mr All In One | Paused | NOT VERIFIED | NO-GO |
| Mafia | Paused | NOT VERIFIED | NO-GO |
| Fire Kirin | Paused | NOT VERIFIED | NO-GO |
| Milky Way | Paused | NOT VERIFIED | NO-GO |
| Orion Stars | Paused | NOT VERIFIED | NO-GO |

Catalog visibility was left on. The public `/play` page still lists the eight active games. That is not proof a transfer works.

The pause function in the database still accepts only Fire Kirin, Milky Way, and Orion Stars. Resuming one of the other eight needs a direct update of its pause row. Do not do that until that provider has a passed test on a provider-approved test account.

A provider with no pause row is not treated as paused. Vblink is in the fulfillment list and is not one of the eleven paused names.

## Customer workflows

Public pages were checked on the safety deployment: `/`, `/play`, `/login`, `/privacy`, `/terms`, `/faq`, `/robots.txt`, and `/sitemap.xml` returned 200. `/play` lists the eight games.

Signed-in registration, email verification, login, password reset, dashboard, wallet, KYC upload, deposit, game account, load, redeem, payout, history, notifications, and support were not opened with a real account in this pass. Unit tests cover auth email codes, KYC decision rules, deposit access, and webhook decisions. Those tests do not prove a live signup or a live wallet credit.

Deposits and payouts stay refused while the switches are off. A signed-out Paydora create and payout returned 401 on the current deployment. Paydora methods returned 500 because the API key is gone. That 500 happens before a charge.

## Admin workflows

Unsigned `/admin` redirects to login. That was checked on the current deployment. It does not prove an owner, staff, store, or sub-creator login.

Staff-access tests passed. The live-coins page is limited to the super admin in those tests. Staff do not receive that page. This pass did not open a signed-in admin session, so dashboard totals, KYC review, support, and financial reports were not compared with the database in a browser.

The database guard still blocks staff ledger adjustments while `adjustments` is off. That control was not turned on.

## Paydora deposits

Status: NOT VERIFIED. Deposits stay NO-GO.

The API key is not in the Vercel production environment and it is not in the local env file. It cannot be validated from this machine. Removing it from Vercel did not revoke it at Paydora. Do not paste the key into chat. Restoration belongs in the Vercel dashboard for `cashoutanytime`, and it must stay unused until deposits are separately enabled.

Code endpoints, default host `https://cpcs.paydora.net/api/v1`:

| Use | Call |
| --- | --- |
| Methods | `GET /payment-methods` |
| Checkout | `POST /deposits/create` with an idempotency key |
| Status | `GET /deposits/:id` |
| Payout | `POST /withdrawals/create` |
| Webhook | `POST` to the site webhook. Signature is HMAC-SHA256 of the raw body, header `x-signature`, prefix `sha256=`. |

No public contract for `cpcs.paydora.net` was found. Payora.money uses a different signature and must not be copied into this integration. Methods were the only live Paydora read, and that was before the key was removed. Checkout, signed webhook fields, refund, and payout were not exercised.

Webhook unit tests passed for these rules: credit only a paid USD amount that matches the stored intent, hold a missing currency, ignore an unknown event, hold a repeat of a held payment, and hold every event including refunds while deposits are off. Those are code decisions. They are not a captured Paydora payment.

The outstanding intent is still uncredited. Id `0c70e8b2-7e6f-466a-820c-d9879fbff66d`, external id `6ad2f76612536669727a47b6`, amount 10.99, created 2026-10-17 04:19:51 UTC, final credit empty. Webhook events 0. Processed Paydora events 0. Provider status was not read, because the key is unavailable. Do not invent a capture and do not credit it.

Card is not one of the stored deposit methods. An unrecognized Paydora method, including a card label, is saved as cashapp. That mislabel has to be fixed before card deposits can go live.

## Paydora payouts

Status: NOT VERIFIED. Payouts stay NO-GO.

Payout requests in the database: 0. The payout route requires a signed-in player and the payout switch. The switch is absent, so it stays off. No payout success, failure, or timeout was sent to Paydora. The database guard still allows a `payout-void:` credit and a `refund:` debit, and blocks ordinary credits and debits. That allow path was probed and rolled back during the safety release. It was not used to move money.

## Production safety that stayed in place

- All five `REAL_VALUE_*` switches remain absent on Vercel.
- All five database controls remain off. The three guard triggers stay enabled.
- Wallet, cash-out, and bonus totals were 0.00 after the safety release. This pass did not write ledger, wallet, or payment rows.
- Profiles 5, game loads 13, payment intents 1, storage objects 1, and the one pending KYC submission were not changed.
- The encrypted backup from earlier today was not modified. The private identity image is still not in that backup. Do not delete the storage object.
- Secrets were not rotated.

## Exact blockers that need someone outside this code

1. Put the Paydora API key back only through the Vercel dashboard. Then run Paydora's own test checkout, failed checkout, cancelled checkout, signed webhook, duplicate webhook, refund, and payout. Do not use a customer card.
2. Read deposit `6ad2f76612536669727a47b6` with that key. Credit the wallet only if Paydora shows a captured USD 10.99 payment and the normal webhook path posts it. Do not type a manual credit.
3. Revoke the old Paydora key at Paydora after a replacement key is stored. Removal from Vercel is not revocation.
4. Supply provider-approved test accounts for each game that should resume. A balance read is not enough.
5. Written legal eligibility, official rules, a free-entry method, and merchant approval. Age 18 and the state block in code are not that approval.
6. Back up the private identity image bytes without creating a public link. Point-in-time recovery in the Supabase dashboard is still not confirmed.
7. Fix the card-to-cashapp method label before any card deposit is enabled.

## Production activation steps

Do not run these now. Each one needs its own pass after the evidence above exists. Leave the database triggers in place the whole time.

1. Restore the Paydora API key in Vercel for `cashoutanytime`. Do not set `REAL_VALUE_DEPOSITS`. Confirm methods return without creating a charge, then read the $10.99 intent.
2. Deploy this pause fix. Confirm the domain is no longer `dpl_HdYKxe2bJKWUuyjuG5WpBEDV1Ti8`. Confirm a paused game refuses account create before any provider login. Keep every money switch off.
3. Enable deposits only after a Paydora test payment credits one test wallet once, a duplicate webhook does not credit again, a failed and a cancelled payment do not credit, and the amount is USD.
4. Resume one provider only after its own test account passes create, lookup, balance, load, redeem, duplicate prevention, and timeout recovery. Repeat per provider. Do not resume the list together.
5. Enable game loads only for providers that passed step 4, with the database `game_loads` control and `REAL_VALUE_GAME_LOADS` both required.
6. Enable redemptions only after a test redeem returns the test wallet amount once and a duplicate redeem does not pay twice.
7. Enable payouts only after a Paydora test payout shows success, failure, and timeout without leaving a double debit.
8. Enable staff adjustments only for the owner role that already passes the staff-access checks, with the database `adjustments` control still blocking every other role.

## GO / NO-GO

| Feature | Decision | Why |
| --- | --- | --- |
| Restore Paydora key in Vercel | NOT READY TO EXECUTE | The key is not on this machine. Dashboard entry is an owner action. Restoring it does not by itself enable charges. |
| Deploy the pause fix | READY, NOT DEPLOYED | Local tests and the production build passed. Money switches stay off. Waiting for approval. |
| Deposits | NO-GO | No sandbox payment, no signed Paydora webhook, key unavailable, card method mislabeled. |
| Resume any game provider | NO-GO | No provider test was run. |
| Game loads | NO-GO | Same provider gap, plus the pause fix is not deployed. |
| Redemptions | NO-GO | No redeem test. |
| Payouts | NO-GO | No payout test. Zero payout rows. |
| Staff adjustments | NO-GO | Guard remains off. Signed-in staff screens were not opened. |
| Full real-money launch | NO-GO | Legal approval, identity-image backup, secret revocation, and the payment and provider checks are still open. |

## Approval request

This is the request. It was not executed.

1. Restore the Paydora API key in the Vercel dashboard. Evidence still missing: a read of deposit `6ad2f76612536669727a47b6` and a test checkout. Do not enable deposits in that same step.
2. Deploy the local pause fix to `cashoutanytime` while every `REAL_VALUE_*` switch stays unset. Evidence: 40 tests passed, TypeScript passed, production build passed. After deploy, confirm a paused provider is not contacted.
3. Enable deposits. NO until the Paydora test list in activation step 3 passes.
4. Resume providers one at a time. NO for all eleven until each has its own test-account result.
5. Enable game loads. NO until step 4 passes for that provider and the pause fix is on the domain.
6. Enable redemptions. NO until a test redeem is shown.
7. Enable payouts. NO until Paydora shows payout success, failure, and timeout.
8. Enable staff adjustments. NO until the adjustment role is limited to the approved owner path and the guard remains on for everyone else.
