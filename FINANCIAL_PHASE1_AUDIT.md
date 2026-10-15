# Financial Phase 1 — Game load and refund audit

Inspected commit `6a6c4df` (`6a6c4df3c02fa5d0efac72e1ea93011cbc0fa072`) by source only. No SQL was executed, no provider was called, and no application code was changed.

`src/lib/actions/admin/game-loads.ts` does not exist. Admin status changes live in `src/lib/actions/game-loads.ts`. The account-creation panel labels and hidden Complete / Failed buttons from `6a6c4df` are unchanged.

Latest SQL used below:

- `supabase/migrations/20261008000160_financial_trust.sql` — `request_game_load`
- `supabase/migrations/20261008000130_auto_ops.sql` — `request_auto_game_load`
- `supabase/migrations/20261008000210_create_requires_game_row.sql` — `complete_game_load`, `request_game_account_create`
- `supabase/migrations/20261011000280_refund_wallet_refunded_column.sql` — `refund_game_load_wallet`
- `supabase/migrations/20261013000150_hold_pending_game_load_cancel.sql` — cancel
- `supabase/migrations/20261013000130_hold_unknown_game_loads.sql` — `fail_stale_game_loads`

Whether those migrations are the functions actually installed in production was not checked.

## 1. Confirmed bugs

### Critical — Admin Failed can refund a load the provider may already have accepted

A timeout is classified as `unknown` and the row is left open. `game_api_debited` stays false. Admin Failed does not look at that classification. It calls `finishGameLoad` with `success: false`, and `complete_game_load` refunds every open `load` or `reload` whose `game_api_debited` flag is false.

- `src/lib/game-automation/load-outcome.ts` lines 5–14
- `src/lib/actions/game-loads.ts` lines 203–211 and 244–257 (`holdUnknownGameLoad`, no refund)
- `src/lib/actions/game-loads.ts` lines 1207–1214 (`adminUpdateGameLoadStatus`)
- `src/lib/game-automation/finish-game-load.ts` lines 59–63 (flag is set only on success)
- `supabase/migrations/20261008000210_create_requires_game_row.sql` lines 40–42
- `supabase/migrations/20261011000280_refund_wallet_refunded_column.sql` lines 26–39
- Buttons: `src/components/admin/game-load-actions.tsx` lines 61–69

Effect: the player can receive the $20 back and still have the $20 game credit. That is a house loss.

### Critical — Provider success is marked before the database finish is durable

`finishGameLoad` commits `mark_game_api_debited` in its own call, then calls `complete_game_load`. If that second call fails, the flag remains true, so `refund_game_load_wallet` will refuse a later refund. `complete_game_load` can raise `Account not found` for a `load` / `reload` when the saved username does not match.

- `src/lib/game-automation/finish-game-load.ts` lines 59–84
- `supabase/migrations/20261008000190_auto_money.sql` lines 13–22
- `supabase/migrations/20261008000210_create_requires_game_row.sql` lines 84–91
- `supabase/migrations/20261011000280_refund_wallet_refunded_column.sql` lines 29–31

Effect: wallet stays debited, automatic refund is blocked, and the game-account credit row may never be written. `fulfillTrackedRequest` retries any row that is not `completed` (`src/lib/actions/game-loads.ts` lines 282–289), so a later retry can send the provider credit again.

### High — Two overlapping Load clicks can debit twice

The “one open request” check is not locked to the balance update, and there is no partial unique index on open `game_load_requests` rows. Two requests that both pass the check before either insert will each subtract the wallet.

- App check: `src/lib/actions/game-loads.ts` lines 700–710
- SQL check then debit: `supabase/migrations/20261008000160_financial_trust.sql` lines 33–39 and 69–76

A second click after the first row exists is rejected. The hole is only the overlap.

### High — An automatic retry can credit the game again after a failed row

`request_auto_game_load` reopens a failed row when `wallet_refunded` is false and does not look at `game_api_debited`. `retryFailedLoadAction` then calls `fulfillTrackedRequest` on that same row, which calls the provider again.

- `supabase/migrations/20261008000130_auto_ops.sql` lines 166–187
- `src/lib/actions/auto-ops.ts` lines 53–64
- `src/lib/actions/game-loads.ts` lines 282–289

Effect: one wallet debit, two provider credits, if the first attempt had already reached the provider.

### High — Complete and Failed are not one locked operation

`complete_game_load` locks the open row, so two completions do not both add game credits. `mark_game_api_debited` does not use that lock. One admin can set the flag while the other admin’s Failed refund still runs, or Failed can mark the row failed after the flag is set and before game credits are written.

- `src/lib/game-automation/finish-game-load.ts` lines 61–83
- `supabase/migrations/20261008000210_create_requires_game_row.sql` lines 25–33 and 151–166

## 2. Potential risks that need a live check

- `fail_stale_game_loads` in `20261013000130` returns 0 and does not refund. The older function in `20261008000160` does refund. This audit did not check which function production is running.
- If `fail_my_stale_game_load` errors, `healStaleGameLoads` falls back to `finishGameLoad(success: false)` and can refund open loads (`src/lib/actions/game-loads.ts` lines 1037–1074).
- Game Vault sends `orderId` derived from the request id (`src/lib/game-automation/gamevault-service.ts` lines 203–204). Other providers in this pass do not show the same idempotency key. A retry after a successful provider call can double-credit those games.
- `adminUpdateGameLoadStatus` still accepts a `create_account` id even though the panel hides the buttons (`src/lib/actions/game-loads.ts` lines 1176–1214). The SQL path does not change `wallet_balance` for that type, but it can write `game_accounts`.
- Staff authorization on that action is `profiles.role = 'admin'` (lines 1187–1193), not the newer staff-role check. A mismatched role fails closed. It does not move money by itself.

## 3. Safeguards that already work

- A normal $20 load debits `wallet_balance` once inside `request_game_load`, with `FOR UPDATE` on the profile, and writes one `wallet_transactions` debit (`20261008000160` lines 69–96). The app rounds to cents and forces wallet type `current` (`game-loads.ts` lines 686–717).
- `complete_game_load` updates a row only while it is `pending` or `processing` (`20261008000210` lines 25–33). A second completion returns without another wallet debit or another game-credit add.
- `refund_game_load_wallet` returns immediately when `wallet_refunded` is true, when `game_api_debited` is true, or when the type is not `load` / `reload` (`20261011000280` lines 26–34). A second refund does not credit the wallet again.
- Confirmed provider failure refunds through that function. Game Vault’s own refund (`gamevault-service.ts` lines 241–244) is followed by `complete_game_load`, and the flag stops the second credit.
- Unknown provider errors call `holdUnknownGameLoad` and do not refund (`game-loads.ts` lines 203–211 and 244–257).
- Current cancel SQL refuses to refund a `load` or `reload` (`20261013000150` lines 31–33 and 69–71).
- Account creation inserts `amount` 0 and does not touch `wallet_balance` (`20261008000210` lines 234–241). Refund SQL ignores `create_account`. The panel hides Complete and Failed for `create_account` and `new_account` (`game-load-actions.tsx` lines 53–61) and labels them “Account creation” / “Game account creation” (`admin-wallet-loads-sidebar-panel.tsx`).

## 4. How a wallet deduction and refund actually work

**Deduction.** `requestGameLoad` calls `request_game_load`. For `load`, the function locks the profile, checks `wallet_balance >= amount`, subtracts that amount, inserts a `game_load` debit, and inserts one pending `game_load_requests` row. It does not call the provider. The provider call happens afterward in `fulfillOrFail`.

**Success.** `finishGameLoad` sets `game_api_debited`, then `complete_game_load` adds `amount` to `game_accounts.credits_balance` when the username matches. The website wallet is not debited again.

**Confirmed failure.** `complete_game_load(p_success => false)` calls `refund_game_load_wallet`, which adds the same `amount` back to `wallet_balance`, inserts a `game_load_refund` credit, and sets `wallet_refunded`. The row is then marked `failed`.

**Timeout.** The row stays `pending` or `processing`, the wallet stays debited, and `game_api_debited` stays false until a person acts.

**Account creation.** No website-wallet debit and no refund. Success can insert or update `game_accounts`.

## 5. Priority

| Item | Priority |
|---|---|
| Admin Failed refunds a timed-out load | Critical |
| Debit flag committed before a failed finish, then a retry can load again | Critical |
| Overlapping Load clicks debit twice | High |
| Auto retry ignores `game_api_debited` and calls the provider again | High |
| Complete versus Failed is not one locked transaction | High |
| Stale-load fallback refund if the no-op function is missing or errors | Medium |
| Direct call of admin status update on `create_account` | Low |
| `profiles.role = 'admin'` gate | Low |

## 6. Smallest fixes to consider later

Do not apply these in this audit.

1. Make Admin Failed refuse a refund unless the stored outcome is a confirmed provider failure. A timeout stays open.
2. Set `game_api_debited` and finish the row in one database transaction. If finish fails, the flag must roll back.
3. Add a partial unique index on open `game_load_requests` for `(user_id, game_slug)`, and recheck that lock inside `request_game_load` after the profile lock.
4. Make `request_auto_game_load` return the existing id without a new provider call when `game_api_debited` is already true.
5. Keep the `6a6c4df` panel behavior. Also reject `create_account` inside `adminUpdateGameLoadStatus` so a direct call cannot write `game_accounts`.

## 7. Issues that can lose money

- **House loss:** Admin Failed, or the stale-load fallback, refunds the website wallet after the provider already added game credit.
- **Player loss:** Provider success is flagged, then `complete_game_load` fails. The wallet stays debited and the refund function will not return it.
- **House loss on retry:** That same stuck row, or a failed auto row with `game_api_debited` true, is sent to the provider again.
- **Player or house loss:** Two overlapping Load clicks each subtract the wallet. Both credits may also reach the game.
- **Wrong balances:** Admin Complete writes game credits and blocks a refund even when the provider never confirmed the load.

Account creation, as written, does not debit or refund the website wallet.
