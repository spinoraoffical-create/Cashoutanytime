# Terminal lookup and pre-deployment decision

No hosted SQL was applied. Nothing was deployed. No recharge, redemption, account creation, or password change was sent. The signing formula was not changed.

## 1. Error 201

The published Fire Kirin and Milky Way example is reproduced locally:

`md5("agent01" + "1595756537" + "cb71121e4569433986bf401a347a7649")` equals the documented `1097bf94d4fa4a70641fc396ea1868ab`.

The code uses that same rule: lowercase `agentName + time + agentKey`, then MD5. Login does not use that signature. It sends the MD5 password and a new timestamp. That login succeeds. Each later call is documented to use a new timestamp and a new signature. The code does that. Parameter order is not part of the documented signature. The account is not part of the signature. Password on lookup is optional. The sign input for this agent is 57 characters with a millisecond timestamp and 54 with a 10-digit timestamp. The Milky Way note says the string should not exceed 63. This agent is under that limit. The agent key length is 32, the same length as the example.

A lookup of a name that is not a saved player returns code 201, and the reply contains “signature”. It does not contain “terminal”, “enable”, “timeout”, “session”, or “whitelist”. Repeating that call with the example’s 10-digit timestamp, and the same documented formula, still returns code 201 with “signature”. So the timestamp width is not the cause, and a different algorithm was not tried.

What is still missing: one existing Fire Kirin player name and one existing Milky Way player name, each 6 to 32 letters or numbers, already created under this agent. Without those, a successful lookup cannot be distinguished from a signature rejection of every signed call. Port 8034, which the Fire Kirin document lists, still does not accept a connection. The signed lookup was made on port 8033, the port where login succeeds. Those ports were not compared for lookup.

## 2. Files changed

- `supabase/migrations/20261017000300_provider_transfer_operations.sql` — rollback comments only
- `scripts/terminal-api-safety.test.mjs` — published signature example, pause refund, and unknown-outcome refund checks
- `TERMINAL_LOOKUP_PREDEPLOY_DECISION.md`

No provider client formula was changed.

## 3. Tests passed

- `scripts/terminal-api-safety.test.mjs`
- `scripts/transfer-ledger.test.mjs`
- One read-only comparison of the documented 10-digit timestamp. No money call.

## 4. Migration safety

The file has no database URL and cannot attach itself to the old Spinora project. It is safe only when a person runs it on `zecitlewsynyioemsqna`. It adds three new tables and new functions. It does not replace wallet functions or update balances. Re-running it does not unpause a provider. Disposable Postgres already showed one claim proceeds, the duplicate is held, and a sign field is not stored. Rollback is the commented `DROP` list at the top of the migration. That rollback does not move wallet money. Do not drop the tables while a row is pending, submitted, unknown, or in manual review.

## 5. Wallet reservation compatibility

`claim_provider_transfer` locks the existing `game_load_requests` row and requires it to be open. It does not debit the wallet. The existing `request_game_load` debit still happens first. A paused or clearly refused transfer can be refunded once by `refund_game_load_wallet`. That function returns immediately when `wallet_refunded` is already true, and it also returns when `game_api_debited` is true. A second refund does not credit the wallet again.

If the provider accepts a transfer and the following balance read fails, the ledger stays in manual review and the error contains “outcome unknown”. That error is not refunded. Staff confirm or fail only changes the ledger row. It does not change `profiles` or `wallet_transactions`. The player’s wallet reservation stays where the existing load row left it until someone uses the existing load tools.

## 6. Provider pause

After the migration, Fire Kirin, Milky Way, and Orion Stars are inserted paused. A paused claim returns before any provider request. The unit test sends zero provider calls while paused. That covers recharge and redeem from player loads, deposit auto-settlement, and the admin retry in `retryFailedLoadAction`, because those paths call the same client methods. No cron route calls these three clients. The store-browser adapters still refuse to run. Fire Kirin account creation through the older store script is not a wallet transfer and is not covered by this pause switch.

Orion Stars deposits do not start a load. Fire Kirin and Milky Way deposits can still reserve the wallet; the provider call is then refused while paused, and that refusal is refundable once.

## 7. Remaining blockers

- No authorized existing player name for Fire Kirin or Milky Way.
- Signed lookup still returns 201 on a name that is not a saved player, with both documented timestamp widths.
- Fire Kirin port 8034 is unreachable, so the documented port was not used for lookup.
- Panda Master still has no API document.
- The ledger is not on the hosted database.

## 8. Migration recommendation

GO, only on `zecitlewsynyioemsqna`, before any deploy. The new tables are unused until the new code is deployed. Leave the three providers paused.

## 9. Deploy recommendation

NO-GO. Do not deploy until a real player lookup succeeds and the migration is already applied. Deploying first makes Fire Kirin and Milky Way loads fail closed, and the signature failure is not fixed.

## 10. Post-deployment read-only tests

1. Confirm `provider_automation_controls` shows Fire Kirin, Milky Way, and Orion Stars paused.
2. Ask the owner for one existing Fire Kirin username and one existing Milky Way username. Do not create them.
3. Call `queryInfo` once per name. Record only the code, the reply category, and whether the balance is missing, zero, or numeric. Do not record the balance amount, the agent key, or the signature.
4. Do not call register, recharge, redeem, or password change.
5. Do not resume a provider in that test.
