# Financial Center deep audit

Date: 18 October 2026. Repository: `C:\Users\asus\Downloads\sweeptakes\Cashoutanytime`. Branch `restore/public-game-catalog`. HEAD `fa8dc2704983dadde6e5253981cd86d69d12f38d`. Linked Supabase ref `zecitlewsynyioemsqna` (this Cashoutanytime project, not Spinora).

This audit separates confirmed defects, suspected issues, and behavior that was not re-run against production.

## Workspace and the missing migration

The file exists on disk and is untracked. It is not in Git history on `main`, `restore/public-game-catalog`, or the other local remotes. It is not ignored.

Path in Cursor Explorer:

`supabase/migrations/20261018000200_refund_game_load_service_role.sql`

Full path:

`C:\Users\asus\Downloads\sweeptakes\Cashoutanytime\supabase\migrations\20261018000200_refund_game_load_service_role.sql`

`MANUAL_TEST_FIX_REPORT.md` is also untracked in the repository root. The earlier transaction, deposit, and refund-message edits are uncommitted modifications in this same checkout.

A read-only production check on 18 October 2026 showed:

- `refund_game_load_wallet` does not set `request.jwt.claim.role`
- `is_service_role()` does read that claim
- `protect_wallet_columns()` still raises when a wallet column changes outside its allowed sessions
- The `player43137` Game Vault $5 load is still `pending` with `wallet_refunded` false

The migration is necessary. It was not applied.

## Section findings

### Deposits — `/admin/deposits`

Purpose: list `deposit_requests`. Data source: that table, latest 100 rows, optional status filter. Staff permission `requests.manage`, with a store-network scope. Confirmed: `Paid online` is written by `credit_paydora_deposit` when no order id is passed (`supabase/migrations/20261004000100_paydora_security_hardening.sql` around the deposit insert). It is not a player note and not a Paydora status. Confirmed: a `paydora/` proof path is not an uploaded image. The admin page used to render it as a blank screenshot (`src/app/admin/deposits/page.tsx`). Local code now labels the system record and skips the fake image. Production still shows the old screen until deploy.

### Loads and redeems — `/admin/game-loads`

Purpose: `game_load_requests`. Failed loads redirect from `/admin/failed-loads` to `?status=failed`. Wallet debit happens in `request_game_load` as the signed-in player. Provider work runs later through `fulfillOrFail` in `src/lib/actions/game-loads.ts`. Confirmed defect: Game Vault code 6 stored a refund sentence before a refund row existed (`src/lib/game-automation/error-formatter.ts` before the local edit). The admin sidebar prints `error_message` (`src/components/admin/admin-wallet-loads-sidebar-panel.tsx`).

### Cash outs, payout activity, held cash outs

`/admin/payouts` acts on cash-out balances. `/admin/payout-operations` reads `paydora_payout_requests` and already says submitted is not paid. `/admin/cashout-holds` reads `cashout_holds` where status is held, limit 100. Suspected, not re-tested live: a second click on a payout form can still depend on the reservation unique key. Existing `scripts/payout-reservation.test.mjs` passed for the reservation decision code. A live duplicate-click test was not run.

### All transactions — `/admin/transactions`

Confirmed defect: the page ignored `userId` (`src/app/admin/transactions/page.tsx` before the local edit) and the query used the admin session, which cannot read another player's `wallet_transactions` under the own-row policy in `supabase/migrations/20260720000200_game_load_rpc_fix.sql`. Local code reads a valid `userId`, uses the staff-gated service client, pages 50 rows at a time, and keeps deposit-wallet and cash-out rows. Bonus-wallet rows stay off this list. No rows were invented.

### Wallet sidebar and player CRM

The sidebar link `/admin/transactions?userId=` is in `src/components/admin/admin-wallet-loads-sidebar-panel.tsx`. It was correct. The destination ignored it. CRM financial pages were not clicked in this pass.

## Provider matrix

Not run against live or mock provider HTTP. The decision code that is tested says: a timeout stays unknown and is not refunded; code 6 is a confirmed rejection and may be refunded only when `wallet_refunded` is still false and the game was not debited. Repeated refunds are stopped inside `refund_game_load_wallet` when `wallet_refunded` is already true. That second part is in the live function and was not executed.

## What this pass did not prove

Every game provider's success, invalid account, timeout, duplicate click, and redeem path was not executed. Webhook signature code was not called with a live Paydora payload. Postgres concurrency tests were not run. The new explorer and reconciliation pages were not opened in a browser.
