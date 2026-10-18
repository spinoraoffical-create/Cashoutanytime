# Financial Center manual QA

Use a staff account that already exists. Do not create a deposit, game load, redeem, refund, or payout to prove a screen works. The $5 Game Vault row must stay untouched until a separate refund approval.

Production still serves the previous commit until you approve a production deploy. These checks apply to the release after it is deployed somewhere that is not the live money database. A Vercel Preview of `cashoutanytime` is not that place: it uses the production database and live game-provider credentials. Do not click financial actions there.

## 1. Overview

URL: `/admin/money`

Steps: open the page on desktop and on a phone-width window.

Expected: platform staff see labeled 7-day figures, or “Not available” if a query failed. Store staff do not see network totals. Opening a card does not move money.

Failure: a zero appears when the page also shows an error, or a store staff member sees every player’s totals.

Evidence: screenshot of the figure grid.

## 2. Deposits

URL: `/admin/deposits`

Steps: open a completed online deposit.

Expected: the note “Paid online” is labeled System record. There is no empty pulsing image for a `paydora/` path.

Failure: a blank image box, or the note presented as payment proof.

Evidence: screenshot of that deposit.

## 3. Game transactions and failed loads

URLs: `/admin/game-loads` and `/admin/failed-loads`

Steps: open failed loads. If the $5 Game Vault row is listed, read it. Do not press a refund control. There should not be one.

Expected: status reads Reconciliation required while `wallet_refunded` is false. Investigate opens Transaction Explorer for that id.

Failure: the page says the refund is complete, or a control changes the wallet.

Evidence: screenshot of the row and the explorer result.

## 4. Withdrawals, held cash outs, payout activity

URLs: `/admin/payouts`, `/admin/cashout-holds`, `/admin/payout-operations`

Steps: open each page. Do not mark anything paid and do not release a hold.

Expected: submitted or reserved is not labeled paid. A hold does not say the money was sent.

Failure: a paid badge on a row whose stored status is not paid, or a one-click send.

Evidence: screenshot of each page header and one row.

## 5. Wallet history

URL: `/admin/transactions?userId=` plus a player id you are allowed to view. Use the player link from a game-load row rather than typing a new id if you are unsure.

Steps: open the link. Use Older if more than 50 rows exist.

Expected: that player’s deposit-wallet and cash-out rows appear. Bonus coins are not mixed into a combined total.

Failure: the page still says only “Select a user above,” or it shows another store’s players to a store account.

Evidence: screenshot with the player name visible and the id cropped if you prefer.

## 6. Transaction Explorer and reconciliation

URLs: `/admin/transaction-explorer` and `/admin/reconciliation`

Steps: sign in as a super admin. Search the $5 load id. Open reconciliation.

Expected: explorer shows stored rows and “Not verified” where a provider result is not confirmed. Reconciliation shows the missing-refund alert or an explicit query error. Neither page changes a balance.

Failure: a non-super-admin can open these pages, a failed query shows as zero alerts, or money moves.

Evidence: screenshot of the alert and the explorer row.

## 7. Reports and audit

URL: `/admin/audit`

Steps: open the page.

Expected: existing staff audit rows only. No new financial row appears from simply opening the page.

Failure: a new wallet transaction appears after the visit.

Evidence: screenshot of the page time and a note that no wallet row was created.
