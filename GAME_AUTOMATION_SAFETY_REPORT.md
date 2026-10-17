# Game automation safety report

No migration was applied. Nothing was deployed. No recharge, redemption, account creation, or password change was sent.

The saved Orion Stars login was tried once, with the credentials already stored. It succeeded. No other password was tried.

## 1. Files changed

- `supabase/migrations/20261017000300_provider_transfer_operations.sql` — prepared, not applied
- `src/lib/game-automation/transfer-ledger.ts`
- `src/lib/game-automation/transfer-guard.ts`
- `src/lib/game-automation/supabase-transfer-store.ts`
- `src/lib/game-automation/terminal-money-guard.ts` — the in-memory guard now refuses, so it cannot send a second transfer after a restart
- `src/lib/game-automation/firekirin-api.ts`, `firekirin-service.ts`
- `src/lib/game-automation/milkyway-api.ts`, `milkyway-service.ts`
- `src/lib/game-automation/orionstars-api.ts`, `orionstars-service.ts`
- `src/lib/game-automation/terminal-response.ts`
- `src/lib/game-automation/provider-ready.ts` — Orion Stars loads stay closed
- `src/lib/payments/auto-settle.ts` — a deposit no longer starts an Orion Stars load
- `src/lib/supabase/admin.ts` — import path only
- `src/lib/admin/nav.ts`
- `src/lib/admin/game-automation-health.ts`
- `src/app/admin/game-automation/page.tsx`
- `src/app/admin/game-automation/actions.ts`
- `scripts/transfer-ledger.test.mjs`
- `scripts/terminal-api-safety.test.mjs`
- `scripts/dev-only/terminal-login-readonly.mjs`

Wallet RPCs, Paydora, and Juwa were not modified. Panda Master still has no client.

## 2. Database migration prepared

`20261017000300_provider_transfer_operations.sql` adds:

- a unique operation key
- a state machine: pending, submitted, confirmed, failed, unknown, manual review
- a lock on the existing game-load reservation before a claim
- provider pause/resume
- redacted request and response metadata
- service-role-only access

It does not call `credit_wallet` or `debit_wallet`, and it does not update wallet balances. A staff review only changes the operation row.

Checked on a disposable Postgres 16 database, then that database was removed:

- first claim: proceed
- same key again: hold
- after the row was marked submitted: hold
- a field named sign was not stored

The hosted database was not changed. Until this file is applied, a money call fails closed and is not sent.

## 3. Tests passed and failed

Passed:

- `scripts/transfer-ledger.test.mjs` — duplicate claim, two instances, restart after submit, timeout, lost response, provider acceptance followed by an unconfirmed balance, insufficient balance, authentication failure before send, manual review, pause, and a pending row that cannot be confirmed
- `scripts/terminal-api-safety.test.mjs`
- `scripts/firekirin-api.test.mjs`
- `scripts/game-load-outcome.test.mjs`
- `npx tsc --noEmit`
- disposable Postgres uniqueness and redaction check

No test is still failing.

## 4. Fire Kirin readiness

- Authentication: working. Agent login on port 8033 succeeded. Agent balance was a confirmed zero.
- The August 2026 document lists `https://firekirin.xyz:8034/ws/service.ashx`. Port 8034 did not accept a connection from this network. Port 8033 did, and login succeeded there. Query, recharge, and redeem were not sent to port 8034, so the two ports are not treated as interchangeable. The client stays on 8033.
- Player lookup: not verified. No saved player account was available in this environment. A name that is not a player returned code 201, and the reply contained “signature”. It did not say the account was missing, and it did not mention an IP whitelist.
- Player balance, account creation, recharge, redemption, and password reset: unverified.
- Repeating the same query timestamp also returned 201. Session expiry was not isolated from that signature rejection.

## 5. Milky Way readiness

- Authentication: working. Agent login succeeded and returned a numeric agent balance.
- Player lookup: not verified, for the same reason as Fire Kirin. Code 201, and the reply contained “signature”.
- Player balance, account creation, recharge, redemption, and password reset: unverified.
- The documented API has no provider transaction id. The ledger will not send that operation again, including after a restart. That does not prove the provider itself would ignore a second request.

## 6. Orion Stars blockers

- The same stored login that was rejected earlier succeeded on this retry. Agent balance was a confirmed zero.
- No further passwords were tried.
- Player lookup, balance, creation, recharge, and redemption were not called.
- Player-facing loads stay closed in `provider-ready.ts`, and deposits do not start an Orion Stars load.
- The provider can be resumed only after the ledger exists. Resume still does not send money by itself.

## 7. Panda Master blockers

No official API document is in the zip. These are missing, and they were not invented:

- API endpoint
- authentication method
- request signing
- player, balance, recharge, and redeem permissions
- any statement about IP whitelist

The agent panel was not opened. Automated transfers stay unavailable.

## 8. Remaining financial risks

- The ledger is not on the hosted database. Deploying this code first makes Fire Kirin and Milky Way loads fail before the provider call and refund the existing wallet reservation.
- Milky Way and Orion Stars cannot give the provider an idempotency key. After a timeout, the row stays unknown and must be reviewed. It must not be sent again, even if the server restarts.
- Fire Kirin can send a transaction id. The provider’s duplicate rule was not tested live.
- A provider acceptance stays in manual review until a balance read confirms it. That balance read is currently blocked by the signature error, so a future live recharge could land in review instead of completing.
- Manual review does not refund or credit a wallet. A wrong staff decision can disagree with the wallet row. Staff still have to use the existing load tools for money.
- This network was accepted for agent login. Vercel’s outbound address was not tested. The three Terminal API documents do not mention an IP whitelist.
- This computer’s router still sends the Orion Stars and Milky Way host names to `127.0.0.1`. The checks used public DNS. That is separate from a provider whitelist.

## 9. Approval steps before Production

1. Review `supabase/migrations/20261017000300_provider_transfer_operations.sql`.
2. Apply it only to `zecitlewsynyioemsqna`. Do not apply it to the old Spinora project.
3. Confirm Fire Kirin, Milky Way, and Orion Stars are paused in `provider_automation_controls`.
4. Deploy this code only after that migration is applied.
5. Give the app one existing Fire Kirin player and one existing Milky Way player, then repeat the read-only lookup. Do not create an account for that test.
6. Resolve the query signature rejection before any recharge test. Do not resume a provider while lookup returns a signature error.
7. A live one-dollar recharge or redeem needs a separate explicit approval. Do not retry a row that is pending, submitted, unknown, or in manual review.
8. Turn Orion Stars player loads back on only after that supervised test. Panda Master stays off until its own API document exists.
