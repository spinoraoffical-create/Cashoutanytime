# Financial Center final fixes

Date: 18 October 2026. No production refund, payout, deposit credit, or balance edit was performed.

## Database

`supabase/migrations/20261018000200_refund_game_load_service_role.sql`

The owner already applied this on `zecitlewsynyioemsqna`. Supabase returned “Success. No rows returned.” A later read-only check confirmed the installed function sets the service-role claim, remains idempotent, is executable by `service_role` only, and leaves the wallet trigger in place. The SQL does not credit the $5 row.

## Admin

- `src/app/admin/money/page.tsx` and `src/lib/admin/financial-overview-data.ts`: platform overview shows 7-day counts and sums for verified payment-ledger credits, deposit wallet credits, completed loads, completed redeems, paid payouts, and open payouts. Held cash outs are current rows, not a 7-day window. Pending refunds and unresolved discrepancies use the same evidence rules as reconciliation. A failed query shows “Not available,” not zero. Store and sub-creator views do not see network totals.
- `src/app/admin/deposits/page.tsx` and `src/lib/payments/deposit-record-display.ts`: `paydora/` paths are records, not screenshots. “Paid online” is labeled “System record.”
- `src/app/admin/failed-loads/page.tsx`: investigation list for failed rows, missing refunds, unknown outcomes, and requests open longer than 30 minutes. Each row links to Transaction Explorer. No refund button.
- `src/app/admin/transactions/page.tsx`, `src/lib/actions/wallet.ts`, `src/components/admin/admin-user-transaction-hub.tsx`: selected player from `userId`, service-role read only after `requireAdmin()`, search limited to 80 safe characters, 50-row pages.
- `src/app/admin/transaction-explorer/page.tsx` and `src/lib/admin/transaction-explorer-data.ts`: super-admin read-only search by player or id. Unverified rows stay labeled “Not verified.” Totals are not merged across wallet types.
- `src/app/admin/reconciliation/page.tsx`, `src/lib/admin/reconciliation-rules.ts`, `src/lib/admin/reconciliation-data.ts`: high and review alerts, query errors shown separately, debit check uses loads for the debited players.
- `src/lib/admin/nav.ts`: Financial Center links stay on their existing URLs. The duplicate Deposit records item is gone.

## Game-load wording

- `src/lib/game-automation/error-formatter.ts`
- `src/lib/game-automation/load-outcome.ts`
- `src/lib/game-automation/gamevault-service.ts`
- `src/lib/actions/game-loads.ts`

A refund sentence is saved only when `wallet_refunded` is true. Code 6 stays a provider rejection.

## Not changed

Wallet triggers, RLS, payment keys, and the $5 row were not changed. No one-click money control was added.
