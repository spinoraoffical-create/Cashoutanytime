# Admin v2 Phase 2B report

Date: 13 October 2026. This phase corrects the dashboard cards that shared `/admin/failed-loads` and restyles the existing financial screens. Wallet math, payment routes, Paydora, payout reservation, refunds, migrations, row security, authentication, and staff permissions were not edited. Nothing was deployed, committed, or written to the database. No payment was sent.

## 1. Financial routes inspected

| Route | What it does | Who can open it | Data |
| --- | --- | --- | --- |
| `/admin/money` | Links into the money tools | `requests.manage`, or a store/sub session | Child pages only |
| `/admin/deposits` | Deposit records with status filters | `requests.manage`, or a store/sub network | `deposit_requests` |
| `/admin/requests` | Redirects to `/admin/deposits` | Same as deposits | Same as deposits |
| `/admin/game-loads` | Load, reload, and redeem queue | `requests.manage` on the platform, or a store/sub network | `game_load_requests`, `profiles` |
| `/admin/failed-loads` | Redirects to `/admin/game-loads?status=failed` | Same as game loads | Failed `game_load_requests` |
| `/admin/payouts` | Players with a cash-out balance, plus recent cash-out debits | `requests.manage`, scoped for a store/sub network | `profiles.cashout_wallet`, `wallet_transactions` |
| `/admin/transactions` | Search one player and open stored deposit and redeem history | Page is inside the money hub permission | Existing transaction hub |
| `/admin/cashout-holds` | Holds marked `held`, plus the automatic limit form | `requests.manage` | `cashout_holds`, `platform_ops` |
| `/admin/payments` | Stored payment-method labels | `cms.manage` | `payment_methods` |
| `/admin/analytics` | Links only. Totals are not loaded | `analytics.read` | None on this page |
| `/admin/player-transactions` | Recharge records, redeem records, and a daily report | Agent scope | Existing report queries |

Deposit statuses on the deposit page are `pending`, `processing`, `completed`, and `rejected`.

Game-load statuses used by the load screen are `pending`, `processing`, `completed`, and `failed`. The existing complete/failed buttons can also mark `cancelled` through the same action.

Player-transaction filters use `completed`, `pending`, `processing`, `failed`, `cancelled`, and `all`.

Cash-out holds on that page are queried as `held`.

There is no admin route for webhook events, NOWPayments, a Paydora payout-status queue, or a separate reconciliation ledger. Submitted, paid, failed, and manual-review payout states live in the payout reservation system and are not rendered as their own list.

## 2. Existing features preserved

- Deposit search filters, proof images, live refresh, processing, and reject still call the same deposit action.
- Mark paid still calls `payoutCashout`. The button is now visually distinct. No new confirmation was added.
- Load and redeem search, the failed-only filter, live updates, and the existing complete/failed buttons are unchanged.
- The cash-out limit form still asks for confirmation before saving.
- Payment-method add, edit, and delete still use the same actions. Delete still asks for confirmation.
- Player-transaction filters, export links, and the daily figures still use the same queries. The received-minus-paid-out number is the existing `moneyReceived - cashPaidOut` value.
- Store and sub scope checks are unchanged.

## 3. UI improvements

Financial pages now use navy panels, purple-to-blue filters, status badges, and the shared empty and error states. Each status filter has a short explanation. Completed deposits are described as records. The cash-out total is described as a balance total. The daily report label is "Received minus paid out".

## 4. Dashboard corrections

- "Failed game loads" still counts `game_load_requests` with status `failed` and still opens `/admin/failed-loads`.
- The second card now reads "Failed webhooks" and counts `webhook_events` with status `failed`. It has no link, because no webhook list exists.
- The two counts are not added together.
- System health still shows whether the email, job, and Paydora webhook keys are configured, and it still shows the failed-webhook count.

## 5. Files changed

- `src/app/admin/page.tsx`
- `src/app/admin/money/page.tsx`
- `src/app/admin/deposits/page.tsx`
- `src/app/admin/game-loads/page.tsx`
- `src/app/admin/payouts/page.tsx`
- `src/app/admin/transactions/page.tsx`
- `src/app/admin/cashout-holds/page.tsx`
- `src/app/admin/payments/page.tsx`
- `src/app/admin/player-transactions/page.tsx`
- `src/components/admin/deposit-actions.tsx`
- `src/components/admin/payout-form.tsx`
- `src/components/admin/cashout-limit-form.tsx`
- `src/components/admin/admin-wallet-loads-panels.tsx`
- `src/components/admin/admin-revenue-analytics.tsx`
- `ADMIN_V2_PHASE2B_REPORT.md`

## 6. Tests passed

- `npx tsc --noEmit`
- `node scripts/admin-nav-v2.test.mjs`
- `node scripts/staff-access.test.mjs`
- `node scripts/financial-trust.test.mjs`
- `node scripts/payout-reservation.test.mjs`
- `node scripts/deposit-automation.test.mjs`
- `node scripts/auto-money.test.mjs`
- `node scripts/player-transactions.test.mjs`
- `npx next build` (existing image and hook warnings, exit 0)

## 7. Tests failed

None.

## 8. Unverified behavior

Signed-in browser use of the financial pages is **NOT VERIFIED**. These screens require a staff session, and this pass did not sign anyone in.

## 9. Remaining issues

- Failed game loads appears both in the top dashboard row and in the attention row. Both use the game-load count.
- Failed webhooks appears as an informational card and again in system health. Both use the webhook count.
- There is still no screen for Paydora payout states such as submitted, paid, failed, or manual review.
- The public site does not serve this work until a later deploy.
