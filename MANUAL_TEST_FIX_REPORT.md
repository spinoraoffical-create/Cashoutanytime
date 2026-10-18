# Manual test fix report

Date: 18 October 2026. Local code only. Production data was read and was not changed. Nothing was deployed or pushed.

## 1. Root cause of each issue

### Transaction history

`/admin/transactions?userId=<player-id>` never read `userId`. The page always opened with no player selected, so it showed "Select a user above."

A second gap would have remained after that. The player list and the transaction query used the signed-in admin's database session. `wallet_transactions` only lets a person read their own rows, so another player's loads, redeems, deposits, and refunds would still come back empty. The deposit-wallet filter also dropped current-wallet rows whose source was not one of a short list.

The page now accepts a valid player id, loads that player, and reads that player's stored wallet rows through the staff-gated service client. Current-wallet and cash-out rows stay on the page, including loads, redeems, refunds, deposits, and other debits. Bonus-wallet rows stay off this page. No transactions were added.

### Deposit record

The Anthony Castro row is one `deposit_requests` record:

- Amount $16.49, method card, game Juwa, status completed, wallet credited
- Created 18 October 2026 at 08:49:01 UTC
- Note stored exactly as `Paid online`
- Attachment is a `paydora/` marker, not an uploaded image

That row was inserted by `credit_paydora_deposit`. The function writes `Paid online` when it is called without an order id. That text is not something the player typed, and it is not a Paydora status field.

The same player has a card payment intent for Juwa, base amount $10.99, created 08:38:36 UTC. A `deposit.paid` webhook arrived at 08:39:55 UTC. The payment ledger has one credit of $16.49, and the bonus ledger final credit is $16.49. The automatic Juwa load was skipped, so the $16.49 stayed in the wallet. The deposit row was created at 08:49, with the wallet credit, after that paid webhook. It was not created by an admin proof upload and not by a game-load job.

The image area was empty because the admin page tried to render every attachment as a screenshot. A `paydora/` value is not a file, so the image component drew a blank box. The page now says there is no screenshot and labels `Paid online` as a system record. The stored row was not edited.

### Game Vault refund

`player43137` is the Game Vault username on Anthony Castro's pending load.

- Created 18 October 2026 at 10:56:29 UTC
- Amount $5.00, type load, status pending
- `wallet_refunded` is false
- `game_api_debited` is false
- The stored error says the funds were 100% refunded

Wallet rows for that player:

- 08:49:01 UTC, credit $16.49, source deposit, description `Deposit confirmed`
- 10:56:29 UTC, debit $5.00, source `game_load`, description `Load $5 to Game Vault`
- No `game_load_refund` row

The wallet balance is $11.49, which is $16.49 minus $5.00. The refund was not committed.

Game Vault code 6 is a confirmed provider rejection for insufficient agent balance. It is not an unknown timeout. The error text claimed a refund before the refund function's result was read, and a failed refund call was ignored. The live wallet trigger then rejects the service-role balance update because its service-role check does not see the request role. The refund function rolls back, and the load stays pending. The UI kept the refund sentence anyway.

The screen no longer treats that sentence as a completed refund unless `wallet_refunded` is true. The refund function is unchanged in the database until the new migration is applied. This session did not refund the $5.

## 2. Files changed

- `src/app/admin/transactions/page.tsx`
- `src/components/admin/admin-transactions-live.tsx`
- `src/components/admin/admin-user-transaction-hub.tsx`
- `src/lib/actions/wallet.ts`
- `src/lib/admin/transaction-selection.ts`
- `src/lib/wallet/transaction-display.ts`
- `src/app/admin/deposits/page.tsx`
- `src/lib/payments/deposit-record-display.ts`
- `src/lib/game-automation/error-formatter.ts`
- `src/lib/game-automation/load-outcome.ts`
- `src/lib/game-automation/gamevault-service.ts`
- `src/lib/game-automation/types.ts`
- `src/lib/actions/game-loads.ts`
- `src/components/admin/admin-wallet-loads-sidebar-panel.tsx`
- `src/components/admin/game-load-actions.tsx`
- `supabase/migrations/20261018000200_refund_game_load_service_role.sql`
- `scripts/manual-test-fixes.test.mjs`
- `MANUAL_TEST_FIX_REPORT.md`

## 3. Tests executed

- `node --experimental-strip-types --import file:///C:/Users/asus/AppData/Local/Temp/coa-release/register-ts.mjs --test scripts/manual-test-fixes.test.mjs scripts/game-load-outcome.test.mjs scripts/webhook-reconciliation.test.mjs`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node node_modules/next/dist/bin/next build`

The logged-in admin screens were not clicked. These changes are local and are not on the live site.

## 4. Tests passed and failed

Passed:

- `scripts/manual-test-fixes.test.mjs`
- `scripts/game-load-outcome.test.mjs`
- `scripts/webhook-reconciliation.test.mjs`
- Typecheck, exit 0
- Next.js 15.5.28 production build, exit 0

Failed: none of the commands above.

Not run: the Postgres concurrency suite, and the new refund migration against the database.

## 5. Remaining risks

- Until the migration is applied, the next confirmed Game Vault rejection can still fail to return the debit. The new screen text will say the refund is not confirmed instead of saying it completed.
- The same wallet trigger can block other service-role balance writes, including a later Paydora credit. That path was not changed here.
- The stored Game Vault error still contains the old refund sentence. The corrected sentence appears only after this code is deployed. The $5 is still out of the wallet.
- Bonus-wallet activity is still not listed on the deposit transaction page.
- `Paid online` is still the stored note. Only the label on the admin page changed.

## 6. Database migration

Yes. `supabase/migrations/20261018000200_refund_game_load_service_role.sql` is required before `refund_game_load_wallet` can pass the live wallet trigger.

It was not applied. It does not credit the existing $5. It does not change row-level security.

## 7. The $5

Yes. It needs one manual reconciliation after the migration is applied.

The provider rejection is confirmed, the game account was not debited, and the wallet refund row does not exist. Do not add $5 with a direct balance edit. After the migration is applied, call `refund_game_load_wallet` once for the pending Game Vault load of `player43137` for $5.00 from 18 October 2026 at 10:56:29 UTC. Then confirm `wallet_refunded` is true, one `game_load_refund` credit of $5.00 exists, and the balance moves from $11.49 to $16.49. The function returns without a second credit if it is called again. Calling it before the migration fails the same way as today.

## 8. Ready to commit

Yes. The local changes are ready for review. They are not committed, pushed, or deployed.

Do not stage `supabase/.temp/`.

```powershell
git add -- src/app/admin/transactions/page.tsx src/components/admin/admin-transactions-live.tsx src/components/admin/admin-user-transaction-hub.tsx src/lib/actions/wallet.ts src/lib/admin/transaction-selection.ts src/lib/wallet/transaction-display.ts src/app/admin/deposits/page.tsx src/lib/payments/deposit-record-display.ts src/lib/game-automation/error-formatter.ts src/lib/game-automation/load-outcome.ts src/lib/game-automation/gamevault-service.ts src/lib/game-automation/types.ts src/lib/actions/game-loads.ts src/components/admin/admin-wallet-loads-sidebar-panel.tsx src/components/admin/game-load-actions.tsx supabase/migrations/20261018000200_refund_game_load_service_role.sql scripts/manual-test-fixes.test.mjs MANUAL_TEST_FIX_REPORT.md

git commit -m @"
Show the selected player's real wallet rows and stop claiming a refund that was not saved.

"@

git status -sb
git push origin HEAD:restore/public-game-catalog
git push origin HEAD:main
```

Apply the migration only after this commit is reviewed. Do not refund the $5 until that migration has been applied.
