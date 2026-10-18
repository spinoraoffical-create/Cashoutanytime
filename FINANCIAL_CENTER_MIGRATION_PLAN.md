# Financial Center migration plan

Update, 18 October 2026, after the owner applied the SQL: the installed function now sets `request.jwt.claim.role` to `service_role` inside the transaction. The wallet trigger still raises for a session that does not set that claim. Authenticated users cannot execute the function. The $5 Game Vault row was not credited by this SQL. The paragraphs below are the pre-apply investigation and are kept as history.

## File

`supabase/migrations/20261018000200_refund_game_load_service_role.sql`

Explorer path: `supabase` → `migrations` → `20261018000200_refund_game_load_service_role.sql`

It is untracked. Git history does not contain it. Production does not contain it: a read-only check showed `refund_game_load_wallet` does not set `request.jwt.claim.role`.

## Why it is necessary

Confirmed from the live definitions on project `zecitlewsynyioemsqna`:

- `protect_wallet_columns()` allows a wallet balance change only when `is_service_role()` is true, or when `app.wallet_update` is set and `auth.uid()` is that same profile.
- `is_service_role()` is `current_setting('request.jwt.claim.role', true) = 'service_role'`.
- The live refund function sets `app.wallet_update` and then updates `wallet_balance`. It does not set the role claim. A service-role RPC has no `auth.uid()`, so the trigger raises and the function rolls back.
- The player debit still works, because that debit runs as the signed-in player.

The new file copies the live function, including the bonus-wallet branch, the NaN check, the early return when `wallet_refunded` is already true, and the early return when `game_api_debited` is true. The only behavior change is one transaction-local setting:

`PERFORM set_config('request.jwt.claim.role', 'service_role', true);`

The function remains granted only to `service_role`. The trigger is not dropped or disabled. The file does not credit the existing $5.

## Approval required before any production operation

1. Review the SQL file.
2. Apply only that migration to Cashoutanytime (`zecitlewsynyioemsqna`). Do not apply it to Spinora.
3. Do not refund in the same unattended step. After the function is updated, explicitly approve one call to `refund_game_load_wallet` for the pending Game Vault load of `player43137`, $5.00, created 18 October 2026 at 10:56:29 UTC.
4. Confirm `wallet_refunded` is true, one `game_load_refund` credit of $5.00 exists, and the balance moves from $11.49 to $16.49.
5. Call it only once. The function returns without a second credit if `wallet_refunded` is already true.

Do not update `wallet_balance` or `wallet_refunded` by hand.
