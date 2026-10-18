# Database integration test results

Date: 17 October 2026

Status: NOT VERIFIED against a database

No disposable PostgreSQL or Supabase test database was running. The prepared SQL was not applied to project `zecitlewsynyioemsqna`. No production query changed data. No player balance, payment, payout, or identity row was written.

## What was executed

| Check | Command | Result | Limit |
| --- | --- | --- | --- |
| Webhook decisions, duplicate credit, and twelve overlapping callbacks | `node --import ./scripts/dev-only/register-ts-ext.mjs scripts/webhook-reconciliation.test.mjs` | Exit 0 | In-memory store, not Postgres |
| Twelve concurrent payout reservations | `scripts/payout-reservation.test.mjs` | Exit 0 | Existing in-memory stand-in |
| Deposit duplicate credit | `scripts/deposit-automation.test.mjs` | Exit 0 | In-memory ledger |
| Stale-load review marking | `scripts/stale-load-hold.test.mjs` | Exit 0 | Simulates the SQL rules. Does not execute SQL |
| Database guard text | `scripts/webhook-reconciliation.test.mjs` | Exit 0 | Confirms the new SQL defaults to off and does not turn a row on |
| KYC SQL text | `scripts/kyc-decision.test.mjs` | Exit 0 | Does not execute the function |
| Read-only game flags | `npx supabase db query --linked` on `zecitlewsynyioemsqna` | Exit 0 | Select only |

These results do not prove the live functions lock rows under concurrent database transactions. The existing payout reservation SQL was not re-executed.

## Prepared SQL that still needs approval

1. `supabase/migrations/20261017000500_kyc_decision_profile_guard.sql`
2. `supabase/migrations/20261017000200_hold_stale_game_loads_for_review.sql`
3. `supabase/migrations/20261017000600_real_value_db_guard.sql`

Apply them only after a separate written approval, and only to `zecitlewsynyioemsqna`. Compare the live `protect_profile_columns` function with the replacement before applying the identity file. The money-guard file adds triggers and does not replace the wallet formulas. Every control row starts off.
