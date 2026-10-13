# Financial test results

Date: 13 October 2026. No wallet was changed. No deposit, cash out, or game load was sent to a provider.

## Passed

| Check | What it showed | Result |
|---|---|---|
| `node scripts/game-load-outcome.test.mjs` | Success is not refunded. A confirmed failure can be refunded once. A timeout, a delayed success, a duplicate completion, a second refund, a second open load, a worker interruption, and a network error do not refund or do not start a second load. | passed |
| `node scripts/financial-trust.test.mjs` | Game loads still use the signed-in player's account. The player stale function stays player-scoped. Webhook credit still uses the saved user and amount. | passed |
| `node scripts/payout-reservation.test.mjs` | Cash-out source still reserves before the provider call and does not fail an unknown provider result. | passed |
| `node scripts/deposit-automation.test.mjs` | Deposit source checks passed. | passed |
| `node scripts/whole-coin.test.mjs` | Whole-dollar game amount checks passed. | passed |
| `node scripts/player-transactions.test.mjs` | Ledger math sample passed. | passed |
| `npx tsc --noEmit` | Types passed. | exit 0 |

These are source and decision tests. They do not prove a live wallet balance.

## Failed

`node scripts/auto-money.test.mjs` failed at line 61.

The new game-load assertion on line 58 passed: `src/lib/actions/game-loads.ts` no longer contains `status: "failed"`.

Line 61 expects `src/app/dashboard/wallet/page.tsx` not to mention `DepositPageClient`. The page still mentions it. That assertion was already going to fail before this change. The wallet page was not edited. The test was not weakened. Later assertions in that file, including the admin menu links, did not run.

## Not tested on a real account

- A successful game load.
- A confirmed failed load returning the wallet once.
- A provider timeout leaving the row pending.
- Two clicks on the same load.
- A Paydora webhook replay.
- A cash out of $1.

## Rules that still depend on the database

`refund_game_load_wallet` still refuses a second refund and refuses a refund after `game_api_debited` is true. That behavior is in `supabase/migrations/20261011000280_refund_wallet_refunded_column.sql`. It was not executed here.

`fail_stale_game_loads` on the database still refunds timed-out loads until the owner runs `supabase/migrations/20261013000130_hold_unknown_game_loads.sql`.
