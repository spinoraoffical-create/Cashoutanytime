# Release approval summary

Date: 18 October 2026

Decision: shutdown preparation is ready for separate owner decisions. Real-money launch remains NO-GO. Nothing was deployed, and no live SQL was applied.

## What was proven

The three SQL files were run on a disposable Postgres 15 database, then that database was deleted. All 25 checks passed.

- A direct game load or redeem cannot move money while the matching control is off.
- Deposit credits, payout debits, and adjustments stop while their controls are off.
- A repeated credit, refund, or payout does not move money twice.
- A refund and a payout void still work while new deposits are off.
- Changing a username and reading profiles still work.
- The identity flag cannot change a wallet balance or a staff role.
- Approval and rejection save completely, or the old function rolls them back.
- A stale load is marked once and is not refunded.
- Running the guard file again does not turn a switch on.
- Dropping the load trigger immediately allows a direct debit again.

The live database was not cloned. Backups were not opened. The live audit-column list was not re-read. Those items stay NOT VERIFIED.

## What is off

All five application switches are off because they are absent, not because they were set to a blocking value.

- `REAL_VALUE_DEPOSITS`
- `REAL_VALUE_GAME_LOADS`
- `REAL_VALUE_REDEMPTIONS`
- `REAL_VALUE_PAYOUTS`
- `REAL_VALUE_ADJUSTMENTS`

They are absent on this computer and they are not listed in the Vercel production environment for `cashoutanytime`. The live website does not use them. It can still move money.

## What the owner is being asked

Say yes or no to one step at a time. A yes on one step is not a yes on the next.

| Step | What you are approving | Approval |
| --- | --- | --- |
| 1 | Leave all five switches unset. No change is required. | No |
| 2 | Look at backups for `zecitlewsynyioemsqna` and record whether a restore point exists. Do not restore. | Owner look only |
| 3 | Remove the Paydora API key and republish the current website so new checkouts stop. Do not publish the new build yet. | Yes, separate |
| 4 | Pause the eight active games so provider fulfillment stops. | Yes, separate |
| 5 | Apply only the database money-guard file, with every row left off. | Yes, separate |
| 6 | Publish the new website only after step 5 is verified. | Yes, separate |
| 7 | Apply the identity SQL later, after the audit columns are confirmed. | Yes, separate, not now |
| 8 | Apply the stale-load SQL later. | Yes, separate, not now |

Do not approve turning money on. Do not approve dropping the database triggers. Do not approve putting the Paydora key back. Do not approve a live payment, a live game transfer, or a click on the real pending identity request.

## What can still move money if a step is skipped

- Skipping the key removal can let the current site create a charge. If the database guard is already on, that charge may not be credited.
- Skipping the guard leaves direct game-load and redeem calls open, even after the new website is published.
- Skipping the game pause leaves provider fulfillment open on Cash Frenzy, Cash Machine, Game Vault, Gameroom, Juwa, Mafia, Mr All In One, and Vegas Sweeps.
- Rolling back by deleting a trigger, or by returning to the old deployment while the Paydora key exists, reopens money movement.
- An environment change does not affect a server instance that is already running. The shutdown counts only after a new instance is serving the site and the check has been repeated.

Full actions, expected results, checks, rollback, and risk are in `PRODUCTION_SHUTDOWN_RELEASE_PLAN.md`. The disposable-database evidence is in `DATABASE_GUARD_TEST_REPORT.md`.

Reply with a yes or no for one step only.
