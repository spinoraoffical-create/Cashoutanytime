# Money entry-point inventory

Date: 17 October 2026

Only the exact value `on` enables a switch. Missing, blank, uppercase, and every other value stay off.

The website checks are local and not deployed. A signed-in player can still call `request_game_load` and `request_game_redeem` directly in the database until `supabase/migrations/20261017000600_real_value_db_guard.sql` is approved and applied. That file is not applied.

| Route or function | Operation | Who may call it | Eligibility | Shutdown | Database change | Outside call | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /api/payments/paydora/create` | Deposit checkout | Signed-in player | Age, trusted location, switch | `REAL_VALUE_DEPOSITS` | Payment intent only | Paydora checkout | `real-value-controls`, `restricted-state` |
| `createPaydoraDeposit` | Deposit checkout | Server only | Switch before the provider call | `REAL_VALUE_DEPOSITS` | None before the call | `POST /deposits/create` | Source order test |
| `POST /api/payments/paydora/webhook` | Deposit credit or refund | Paydora, after signature | Age, exact amount, USD currency, saved intent | `REAL_VALUE_DEPOSITS` | Wallet only on a new accepted paid event | None | `webhook-reconciliation`, `deposit-automation` |
| `creditPaydoraDeposit` | Deposit credit | Server only | Switch, except a payout void | `REAL_VALUE_DEPOSITS` | `credit_paydora_deposit` | None | Source order test |
| `reversePaydoraDeposit` | Deposit reversal | Server only | Switch | `REAL_VALUE_DEPOSITS` | Reversal RPC | None | Decision test for refunds while off |
| `POST /api/payments/paydora/payout` | Payout | Signed-in player | Age, location, KYC, switch | `REAL_VALUE_PAYOUTS` | Reservation before the provider | Paydora withdrawal | `payout-reservation`, source order |
| `createPaydoraWithdrawal` | Payout | Server only | Switch before the provider call | `REAL_VALUE_PAYOUTS` | None before the call | `POST /withdrawals/create` | Source order test |
| `requestGameLoad` | Game load | Signed-in player | Age, location, switch, active game | `REAL_VALUE_GAME_LOADS` | `request_game_load` debits after the check | Provider only if the switch is on | Source order test |
| `requestGameRedeem` | Redemption | Signed-in player | Age, location, switch, KYC inside the database function | `REAL_VALUE_REDEMPTIONS` | Creates a redeem request | Provider only if the switch is on | Source order test |
| `fulfillOrFail` for load or redeem | Provider transfer | Server after a request | Switch again before login | Matching load or redeem switch | Finish or hold | Game provider | Source order test |
| `loadGameOnce` | Automatic load after a deposit | Server | Switch | `REAL_VALUE_GAME_LOADS` | Skips the load | None while off | Source order test |
| `retryFailedLoadAction` | Staff retry | Staff | Switch | `REAL_VALUE_GAME_LOADS` | None while off | None while off | Source order test |
| `payoutCashout`, `recordCashoutPayoutAction`, `debitCashoutWallet` | Staff or service payout | Admin or server | Switch | `REAL_VALUE_PAYOUTS` | `admin_payout_cashout` | None while off | `financial-audit-result` |
| `adjustWalletAction` | Staff balance edit | Admin or in-scope store | Switch | `REAL_VALUE_ADJUSTMENTS` | `credit_wallet` or `debit_wallet` | None | Source order test |
| `creditUserWallet`, `adminGrantWallet`, `adminDeductWallet`, `adminResetWallet` | Staff balance edit | Admin | Kind is treated as an adjustment or a payout | `REAL_VALUE_ADJUSTMENTS` or `REAL_VALUE_PAYOUTS` | Wallet RPC | None while off | `adjustmentDenial` is before the credit RPC |
| `spinWheel` cash prize | Prize credit | Signed-in player | Switch before the spin is saved | `REAL_VALUE_ADJUSTMENTS` | None while off | None | Source order test |
| `creditCurrentWallet` and `debitCurrentWallet` | Ledger credit or debit | Server | Deposit, load, redeem, refund, and payout kinds use the four switches. Adjustment kind uses the fifth switch | Matching switch | `credit_wallet` or `debit_wallet` | None | Source order test |
| Account create and balance check | No cash movement | Signed-in player | Game is active | Not a money switch | Request row | Provider read or account create | Not a cash test |
| `GET /api/payments/paydora/status` | Read payment status | Signed-in player | None | None | None | Paydora read | Not a credit path |
| Direct `request_game_load` or `request_game_redeem` | Load debit or redeem request | Any signed-in player through Supabase | Database checks only | Not enforced until the new SQL is applied | Can debit or create a redeem row | None by itself | SQL text test only |

Read-only pages, login, and balance reads are not blocked.

Admin money actions use the staff member's permission and the switch. They do not use the admin's own location as the player's location.

`claim_reward` and `claim_promotion` award coins and XP. They are not the cash deposit, load, redeem, or payout switches.
