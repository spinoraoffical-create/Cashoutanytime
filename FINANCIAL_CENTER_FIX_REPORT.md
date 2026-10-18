# Financial Center fix report

Date: 18 October 2026. Local only. No production deploy, push, migration, refund, or balance edit.

## Confirmed fixes in this checkout

1. Transaction history reads `userId`, checks it is a player id, and loads that player's wallet rows with the staff-gated service client. Pages of 50. Deposit wallet and cash-out wallet are labeled. Bonus coins stay off that list.
2. Deposit admin no longer treats a `paydora/` marker as a screenshot. `Paid online` is labeled as a system record, not proof of payment.
3. Game Vault errors no longer say the money was refunded unless `wallet_refunded` is true. The existing $5 row still contains the old sentence in the database. The admin screen will show "not confirmed" after this code is deployed, because the display checks the flag.
4. Financial Center navigation now uses Overview, Deposits, Game transactions, Failed loads, Withdrawals, Held cash outs, Payout activity, Wallet history, Transaction explorer, Reconciliation, and Reports and audit. Old routes still exist. The extra "Deposit records" nav item was the same deposits page. Failed loads remain under Game transactions and were removed from the Game Center duplicate.
5. `/admin/transaction-explorer` is a read-only super-admin search across players, game logins, wallet rows, deposits, loads, payment intents, and payout rows. It does not add those groups into one total.
6. `/admin/reconciliation` is a read-only super-admin alert list for the last 7 days. It does not refund or pay.

## Not changed

- Production balances
- The pending $5 load row
- Wallet triggers
- RLS
- The live `refund_game_load_wallet` function

## Files changed

Modified:

- `scripts/admin-nav-v2.test.mjs`
- `src/app/admin/deposits/page.tsx`
- `src/app/admin/money/page.tsx`
- `src/app/admin/transactions/page.tsx`
- `src/components/admin/admin-transactions-live.tsx`
- `src/components/admin/admin-user-transaction-hub.tsx`
- `src/components/admin/admin-wallet-loads-sidebar-panel.tsx`
- `src/components/admin/game-load-actions.tsx`
- `src/lib/actions/game-loads.ts`
- `src/lib/actions/wallet.ts`
- `src/lib/admin/nav.ts`
- `src/lib/game-automation/error-formatter.ts`
- `src/lib/game-automation/gamevault-service.ts`
- `src/lib/game-automation/load-outcome.ts`
- `src/lib/game-automation/types.ts`
- `src/lib/wallet/transaction-display.ts`

New:

- `MANUAL_TEST_FIX_REPORT.md`
- `scripts/manual-test-fixes.test.mjs`
- `src/app/admin/reconciliation/page.tsx`
- `src/app/admin/transaction-explorer/page.tsx`
- `src/lib/admin/reconciliation-data.ts`
- `src/lib/admin/reconciliation-rules.ts`
- `src/lib/admin/transaction-explorer-data.ts`
- `src/lib/admin/transaction-explorer.ts`
- `src/lib/admin/transaction-selection.ts`
- `src/lib/payments/deposit-record-display.ts`
- `supabase/migrations/20261018000200_refund_game_load_service_role.sql`
- `FINANCIAL_CENTER_DEEP_AUDIT.md`
- `FINANCIAL_CENTER_FIX_REPORT.md`
- `FINANCIAL_CENTER_TEST_RESULTS.md`
- `FINANCIAL_CENTER_MIGRATION_PLAN.md`
- `FINANCIAL_CENTER_RECONCILIATION_REPORT.md`

Do not stage `supabase/.temp/`.

## Safe to commit

Yes, after you review the diff. It is not deployed.

## Safe to deploy to production

No. The screens are an improvement, but the refund function in production still cannot pass the wallet trigger. Deploying the UI without the reviewed migration leaves the next confirmed Game Vault rejection able to debit the wallet and fail the refund. Do not deploy until you have approved the migration plan separately.

## Real-money launch

Not safe to treat as finished. The $5 is still missing from the wallet, provider success and timeout paths were not executed, and the migration is not applied.
