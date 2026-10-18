# Production shutdown release plan

Date: 18 October 2026

This plan replaces the release order in `SAFE_DEPLOYMENT_AND_ROLLBACK_PLAN.md` for the shutdown release. That older note published the new website first and applied the database guard later. That order is not the order for this release.

Nothing in this plan has been done to production. No deploy, no live SQL, no credential change, and no money movement.

## Goal

Stop real financial operations, prove they are stopped, and only then publish the new website. This is not a real-money launch.

## What is live now

- Vercel project: `cashoutanytime` (`prj_ZF2oBLDLZVkBTQe3SyEokAdhffkz`)
- Public site: `https://www.sweeptakehub.com`
- Live deployment: `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT`
- Database: `zecitlewsynyioemsqna`
- The shutdown code is still only on this computer. It is not committed.
- The live deployment has no money switches. Leaving the new switches unset does not change the live site.

## Switches

Only the exact value `on` enables a switch. Missing, blank, and every other value stay off in the new code.

Checked on 18 October 2026:

| Switch | This computer | Vercel production list |
| --- | --- | --- |
| `REAL_VALUE_DEPOSITS` | Absent | Not listed |
| `REAL_VALUE_GAME_LOADS` | Absent | Not listed |
| `REAL_VALUE_REDEMPTIONS` | Absent | Not listed |
| `REAL_VALUE_PAYOUTS` | Absent | Not listed |
| `REAL_VALUE_ADJUSTMENTS` | Absent | Not listed |

`.env` is absent. `.env.local` does not contain these names. `.env.production` and `.env.production.local` are absent. The Vercel production list for `cashoutanytime` has no `REAL_VALUE` name. That means the new code would keep all five off. It does not mean the current website is off.

A Vercel environment change does not instantly change an invocation that is already running. The running copy keeps the environment it started with until a new instance starts. Removing a key, or adding a switch, is not finished until the new deployment is the one serving the domain and a fresh request has been checked.

## Why the database guard cannot go on first

The live website can still create a Paydora checkout if `PAYDORA_API_KEY` is present. The new guard would then reject the wallet credit. A player could be charged and not credited.

The webhook uses `PAYDORA_WEBHOOK_SECRET`, not the API key. Removing the API key stops new checkouts on the next instance that reads the environment. It does not stop a callback for a payment that was already created.

The pause table stops only Fire Kirin, Milky Way, and Orion Stars. These eight active games are not paused: Cash Frenzy, Cash Machine, Game Vault, Gameroom, Juwa, Mafia, Mr All In One, and Vegas Sweeps. Pausing them stops provider fulfillment. It does not stop `request_game_load` from debiting the wallet. The database guard is what stops that debit.

## Required order

Each numbered step needs its own yes. Do not approve the whole list at once.

### 1. Leave the five switches unset

Exact action: do not add `REAL_VALUE_DEPOSITS`, `REAL_VALUE_GAME_LOADS`, `REAL_VALUE_REDEMPTIONS`, `REAL_VALUE_PAYOUTS`, or `REAL_VALUE_ADJUSTMENTS` in Vercel. Do not set any of them to `on`.

Expected result: the production environment list still has none of those names.

Verification: `npx vercel env ls production` shows no `REAL_VALUE` line. Do not pull environment values into a file.

Rollback: none. Nothing changed.

Risk: low. The live site is unchanged, so it can still move money until the later steps.

Owner approval: not required for this confirmation. Approval is required before anyone adds one of these names.

### 2. Confirm a restore point before any live SQL

Exact action: in the Supabase dashboard for `zecitlewsynyioemsqna` only, look at backups or point-in-time recovery. Do not restore anything. Do not open the old Spinora project.

Expected result: the owner can see whether a backup exists and how recent it is.

Verification: the owner records yes or no, and the time of the newest restore point. This session did not open backups. They remain NOT VERIFIED.

Rollback: none. This is a look, not a change.

Risk: if no restore point exists, applying SQL later has no proven way back.

Owner approval: the owner does this look. No engineer change is approved by this step.

### 3. Stop new Paydora checkouts on the current website

Exact action: remove `PAYDORA_API_KEY` from the production environment of project `cashoutanytime`, then republish the current deployment `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT` so new instances start without that key. Do not publish the new shutdown build in this step. Do not remove `PAYDORA_WEBHOOK_SECRET` yet. Do not print the key.

Expected result: a new deposit or payout setup fails before Paydora creates a charge. Pages that do not move money still open.

Verification: after the republish, one signed-in attempt to start a deposit shows a failure and no new Paydora charge. Check the Paydora dashboard for a new payment created after the republish. There should be none.

Rollback: putting the key back reopens charges on the old website. Do not put it back as part of this release. If browsing breaks, restore the previous known-good instance only while the key stays absent.

Risk: an invocation that started before the republish can still finish with the old key. Wait until the republished deployment is the one on `https://www.sweeptakehub.com`, then test a fresh request. Callbacks for payments created earlier can still credit the wallet until step 5.

Owner approval: required. This is a production change.

### 4. Pause fulfillment for every active game

Exact action: set `paused = true` on `provider_automation_controls` for Cash Frenzy, Cash Machine, Game Vault, Gameroom, Juwa, Mafia, Mr All In One, and Vegas Sweeps. Leave the three already paused games paused. Do not call a game provider. Do not create, recharge, or redeem an account.

Expected result: those eight providers are paused. Wallet debits are still possible until step 5.

Verification: read `provider` and `paused` only. All eight show paused. Do not print reasons or credentials.

Rollback: setting `paused = false` lets fulfillment resume. Do not do that in this release.

Risk: pause does not block a direct database load. A player can still lose wallet balance until the guard is on. This step only reduces provider-side transfers.

Owner approval: required. This is a production change.

### 5. Apply only the database money guard

Exact action: after steps 3 and 4 are verified, run only `supabase/migrations/20261017000600_real_value_db_guard.sql` on `zecitlewsynyioemsqna`. Do not run the identity file. Do not run the stale-load file. Do not set any `real_value_controls.enabled` value to true.

Expected result: five rows exist, all with `enabled = false`. New deposit credits, payout debits, paid game loads, redeems, and ledger adjustments raise `real value off`. Refunds and payout voids still work. Username edits and browsing still work.

Verification: read the five rows and confirm the three triggers exist: `trg_real_value_wallet_ledger`, `trg_real_value_game_load`, and `trg_real_value_paydora_event`. Do not send a live payment to prove it. The isolated test already proved the behavior. A production money test is out of scope.

Rollback: do not drop the triggers to fix a browsing problem. The isolated test showed that dropping `trg_real_value_game_load` lets a direct load debit the wallet again. Re-running the file restores the block, but re-running it does not turn an enabled row back off.

Risk: a payment created before this step can reach the old webhook and then fail the credit. That player was charged and not credited. Record the payment id for a later manual decision. Do not auto-credit it and do not auto-refund it in this release. Service-role access can still set a control row to enabled. Nobody should do that.

Owner approval: required. This is production SQL.

### 6. Publish the new website only after the guard is verified

Exact action: deploy the local shutdown build to Vercel project `cashoutanytime` and attach it to `https://www.sweeptakehub.com`. Keep all five switches unset. Keep `PAYDORA_API_KEY` absent. Do not enable money.

Expected result: the domain serves a new deployment id, not `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT`. Public pages open. Deposit, load, redeem, payout, and staff balance actions say the action is off. The database guard remains in place.

Verification: the Vercel deployment attached to the domain is the new id. Home, play, login, privacy, terms, and FAQ return a normal page. One attempt at each money action is refused without a provider call and without a balance change. Read the wallet balance before and after. It must match.

Rollback: point the domain back at `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT` only if browsing is broken. Leave the guard in place and leave the Paydora API key absent. Do not drop triggers. Do not turn a switch on to repair the rollback.

Risk: the first requests after publish create new instances. Confirm the domain assignment before testing. The old deployment must not be promoted while the Paydora key is present.

Owner approval: required. This is a production deploy.

### 7. Identity SQL, later and separate

Exact action: none during the shutdown release. The file is `supabase/migrations/20261017000500_kyc_decision_profile_guard.sql`.

Expected result: no live identity row changes in this release.

Verification: the live pending identity submission is still pending. Do not click Approve or Reject on it.

Rollback: not applicable until the file is applied. If it is later applied and must be undone, restore the previous `admin_decide_kyc` function from `supabase/migrations/20261014000160_admin_decide_kyc.sql`. That old function is the one that currently rolls back. Do not test it on the real pending row.

Risk: the isolated test passed, but the live audit-column list was not re-read. Apply this only after a read-only check shows `before_data`, `after_data`, `ip_address`, and `user_agent` on `audit_logs`.

Owner approval: required before any later run. Not part of the shutdown yes.

### 8. Stale-load SQL, later and separate

Exact action: none during the shutdown release. The file is `supabase/migrations/20261017000200_hold_stale_game_loads_for_review.sql`.

Expected result: no live game-load row is marked by this release.

Verification: do not call `fail_stale_game_loads` on production in this release.

Rollback: replace the function with the previous body if a later run marks rows incorrectly. The isolated function does not refund, does not close the row, and does not call a provider.

Risk: low on the fixture. It still writes `admin_notes` on open stale rows, so it needs its own yes.

Owner approval: required before any later run. Not part of the shutdown yes.

## What can still move money

These paths stay open until the matching step above is finished and verified.

- The current deployment can create a Paydora checkout while `PAYDORA_API_KEY` is still loaded in a running instance.
- A callback for an already created payment can still credit the wallet until the guard trigger is on. Removing the API key does not stop that callback.
- A signed-in player can call `request_game_load` or `request_game_redeem` directly until the guard is on. The website switches do not stop that call. The pause table does not stop the wallet debit.
- Server-only wallet functions can still credit or debit until the ledger and payment triggers are on.
- The eight active games can still be fulfilled by the current worker until they are paused and the guard is on.
- A zero-amount account request is still allowed after the guard. It does not debit cash, but a worker could still create an account.
- The service role can set `real_value_controls.enabled` to true after the guard exists. The new website would still be off unless its switch is also `on`, but a direct database call would work again.
- Dropping a guard trigger reopens that path immediately. This was executed on the disposable database.
- Promoting `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT` while the Paydora key is present reopens checkout and payout calls.
- Refunds and payout voids stay possible after the guard, on purpose, so an already accepted payment can be reversed. They are not a new deposit or a new payout.
- Coins, XP, and free wheel prizes are not these five cash switches. Cash wheel prizes are gated only in the new code, which is not deployed yet.
- Secret rotation, backup proof, lawyer review, and Paydora business approval are not part of this shutdown and remain open.

## Do not do these in the same release

- Do not set any real-value switch or database row to on.
- Do not run a live deposit, load, redeem, payout, refund, or identity approval.
- Do not apply the identity file or the stale-load file as part of the shutdown yes.
- Do not drop the guard triggers.
- Do not put `PAYDORA_API_KEY` back.
- Do not deploy before steps 3, 4, and 5 are verified.
- Do not contact the old Spinora project.
