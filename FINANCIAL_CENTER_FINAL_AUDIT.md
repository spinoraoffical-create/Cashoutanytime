# Financial Center final audit

Date: 18 October 2026. Project `zecitlewsynyioemsqna`. Branch before this release: `restore/public-game-catalog` at `fa8dc2704983dadde6e5253981cd86d69d12f38d`. Production site still serves that commit. This audit does not award 10/10.

## What is live versus local

Live on https://www.sweeptakehub.com:

- Currency-omitted Paydora credit when the paid amount matches the intent (`fa8dc27`).
- `refund_game_load_wallet` after the owner applied `20261018000200_refund_game_load_service_role.sql`.

Verified read-only on the installed function:

- The function body sets `request.jwt.claim.role` to `service_role` for the transaction.
- `protect_wallet_columns()` still raises when that claim is absent.
- The refund flag is still checked before a second credit.
- `service_role` can execute the function. `authenticated` cannot.

Not live until a later production deploy of this release branch:

- Deposit proof no longer tries to render a `paydora/` path as a screenshot.
- “Paid online” is labeled as a system record.
- Wallet history reads another player’s rows only after an admin check, with the service role.
- Game-load errors no longer say “100% refunded” unless `wallet_refunded` is true.
- Overview figures, failed-load investigation, transaction explorer, and reconciliation.

## Confirmed bugs

1. Game Vault load for `player43137`, $5.00, 18 October 2026 10:56:29 UTC. Status `pending`. `wallet_refunded` is false. `game_api_debited` is false. One matching wallet debit. Zero refund ledger rows. Wallet balance $11.49. Provider code 6 is a confirmed rejection. The stored error still says the funds were refunded. Root cause: the refund function rolled back on the wallet trigger, while the error text was saved earlier. The migration fixed the function. It did not credit this row. Not refunded in this release.

2. Admin wallet history ignored `?userId=` and the player session could not read another player’s `wallet_transactions`. Fixed locally in `src/lib/actions/wallet.ts` and `src/app/admin/transactions/page.tsx`. Not deployed.

3. Online deposits stored `paydora/{payment id}` as a proof path. The image component rendered an empty box. Fixed locally in `src/app/admin/deposits/page.tsx`. Not deployed.

4. Code 6 errors claimed a refund before the ledger confirmed it. Fixed locally in `src/lib/game-automation/error-formatter.ts` and `src/lib/game-automation/load-outcome.ts`. The already stored $5 sentence is unchanged until a later write.

5. Reconciliation page expected an array after the data function started returning `{ alerts, errors }`. Fixed in `src/app/admin/reconciliation/page.tsx`.

## Suspected, not fully proven on the live site

- Debit-without-load matching can miss a load when the timestamp is not identical. The check now looks up loads for those player ids instead of only the first 200 load rows. It can still miss a load whose timestamp differs.
- Duplicate deposit detection uses player, amount, and description. Two legitimate identical deposits can look like duplicates.
- Refund-flag checks match player and amount, not the exact load id. A same-amount refund can be counted for the wrong load.
- Full wallet-versus-ledger reconstruction is not possible. Opening balances are not stored. No invented discrepancy total is shown.
- Held cash outs do not yet show an assigned reviewer or a joined audit history.
- Transaction Explorer lists matching stored rows. It does not yet draw one joined 10-step timeline with staff actions.

## $5 reconciliation status

Eligible for one call to `refund_game_load_wallet` after a separate owner approval. Expected result of a successful call: one `game_load_refund` credit of $5.00 and balance $11.49 to $16.49. A second call returns without another credit. This release did not call it and did not edit the balance.
