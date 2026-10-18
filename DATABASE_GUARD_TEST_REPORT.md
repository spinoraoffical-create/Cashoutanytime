# Database guard test report

Date: 18 October 2026

Verdict: VERIFIED IN ISOLATED TEST

The three prepared SQL files were executed on a disposable Postgres 15 database. All 25 checks passed. Nothing was applied to the live Sweepstakes Hub database `zecitlewsynyioemsqna`. The old Spinora project was not contacted.

This was not a copy of production. A follow-up read of live constraints was not repeated. Do not treat this result as permission to run the files on the live database.

## What ran

A local Docker Postgres 15 database was created only for this test. The website database was not used. The container was deleted after the checks finished.

The fixture was rebuilt from the current repository functions and from columns already seen on the live database:

- Profiles, game-load requests, payment events, the wallet ledger, identity submissions, and audit rows
- The current game-load and redeem functions
- The current deposit credit, deposit reversal, payout debit, and payout-void credit functions
- The old identity function, so the known approval failure could be reproduced before the new file was applied
- The wallet transaction table the load function writes, so a blocked load had to reach the new guard instead of failing for a missing table

Vanilla Postgres does not have the Supabase roles `anon`, `authenticated`, and `service_role`. Those roles were created in the disposable database so the grant and revoke statements could run. That setup difference is not a production failure.

## Results

| Check | Result |
| --- | --- |
| Five control rows are created and start off | PASS |
| A direct game load raises `real value off`, does not debit, and writes no request | PASS |
| A direct redeem raises `real value off` and writes no request | PASS |
| Changing a refunded load back to not refunded is blocked while loads are off | PASS |
| A zero-amount account request still inserts | PASS |
| A deposit credit is blocked while deposits are off, and the balance stays unchanged | PASS |
| A payout debit is blocked while payouts are off, and the cash-out balance stays unchanged | PASS |
| A ledger adjustment is blocked while adjustments are off | PASS |
| The same deposit credits once, then the duplicate is ignored | PASS |
| A refund still works while deposits are off, and a second refund does not repeat | PASS |
| A payout void still works while deposits are off, and a second void does not repeat | PASS |
| The same payout debits once, then the duplicate is ignored | PASS |
| Changing a username still works, and the balance and role stay unchanged | PASS |
| Reading profiles is not blocked | PASS |
| A signed-in player cannot turn the control rows on | PASS |
| The old identity function raises `column protected` and leaves the submission pending | PASS |
| Approval saves the decision, does not change the balance or role, and writes one audit row | PASS |
| Approving the same submission again does not write a second audit row | PASS |
| Rejection saves both the submission and the profile | PASS |
| A signed-in player cannot run the identity function | PASS |
| The identity-only flag cannot change a balance or a staff role | PASS |
| A stale load is marked once, stays open, is not refunded, and a completed row is left alone | PASS |
| Running the guard file again does not turn an enabled row off | PASS |
| Dropping the game-load trigger lets a direct load debit again | PASS |
| Running the guard file again closes that direct debit | PASS |

## The ten required questions

1. Direct `request_game_load` and `request_game_redeem` calls cannot bypass disabled controls. Verified. The earlier wallet debit is rolled back with the blocked request. A refunded load also cannot be charged again by clearing the refund flag.

2. Existing payment and wallet accounting still behaves correctly when the matching control is on. A deposit credit and a payout debit updated the expected balance. When the control was off, the same functions stopped and the balance did not change.

3. Duplicate credits, refunds, and payouts remain protected. The second call was reported as a duplicate and did not move money again.

4. Authorized reversals and payout voids still work while deposits are off. Both moved the expected balance once. Repeating them did not move money again.

5. The guard does not block unrelated profile updates or normal reads. A username change succeeded. Profile reads succeeded.

6. The identity flag cannot modify wallet balances or staff roles. Both attempts raised `column protected`, and the balance and role stayed unchanged.

7. Identity approval and rejection are atomic and authorized on this fixture. The old function rolled the whole decision back. The new function saved approval once and saved rejection on both rows. A player could not run it.

8. Stale game loads are marked for review without refunds or retries. The open row stayed pending, the note said not to refund, the wallet did not change, and a second pass marked nothing. No provider was called.

9. Compatibility with the current production schema is partial. See the next section.

10. The tested order and the reapply path are safe on the fixture. Dropping the load trigger is not a safe rollback, because the direct debit works again immediately.

## Production schema

These live columns were read earlier and were not queried again:

- `profiles`: `bonus_wallet`, `cashout_wallet`, `id`, `kyc_status`, `role`, `updated_at`, `wallet_balance`
- `game_load_requests`: `admin_notes`, `amount`, `game_api_debited`, `game_slug`, `id`, `load_type`, `status`, `updated_at`, `user_id`, `wallet_refunded`
- `kyc_submissions`: `id`, `status`, `updated_at`, `user_id`
- `paydora_processed_events`: `amount`, `direction`, `payment_id`, `unpaid_remainder`, `user_id`
- `wallet_ledger`: `amount`, `id`, `kind`, `user_id`
- `audit_logs`: `action`, `actor_id`, `entity_id`, `entity_type`, `id`

The guard file adds its own table and triggers. It does not add columns to those tables and does not rewrite the wallet functions. On the fixture it applied cleanly to tables with those shapes.

These production details were not re-read, so they stay NOT VERIFIED:

- The live `wallet_ledger` kind check, `wallet_type`, and `balance_after`
- Whether live `audit_logs` has `before_data`, `after_data`, `ip_address`, and `user_agent`
- Whether every live function body matches the repository copy used in the fixture
- Backups or point-in-time recovery

The identity file writes those audit fields. If the live audit table does not have them, approval would fail at runtime. That is why the identity file still needs its own approval and a column check before anyone runs it.

## Order and rollback

The safe test order was:

1. Apply `supabase/migrations/20261017000600_real_value_db_guard.sql` while the old identity function is still in place.
2. Apply `supabase/migrations/20261017000500_kyc_decision_profile_guard.sql`.
3. Apply `supabase/migrations/20261017000200_hold_stale_game_loads_for_review.sql`.

Running the guard file a second time did not turn a row on and did not turn an enabled row off. If a row is ever enabled by mistake, the repair is an explicit update to `enabled = false`. Re-running the file will not repair it.

Dropping `trg_real_value_game_load` immediately allowed a direct load to debit the wallet. Running the guard file again restored the block. That drop is a proven way to reopen money movement. It is not the rollback for a browsing problem.

Zero-amount account requests still insert while game loads are off. That does not debit the wallet. A later worker could still try to create a game account if the provider is not paused.

## What this does not prove

- The files have not been applied to `zecitlewsynyioemsqna`.
- No live deposit, load, redeem, payout, or identity decision was attempted.
- Paydora callbacks, game-provider transfers, backups, and the legal review remain NOT VERIFIED.
- The live website is still the old deployment and can still move money until the shutdown steps below are approved and completed.
