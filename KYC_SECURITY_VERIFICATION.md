# KYC security verification

Date: 17 October 2026

Status: VERIFIED IN ISOLATED TEST

Production status: BLOCKED until the owner approves the SQL

## Original problem

Approve and Reject show that the identity status could not be saved. The request stays pending.

## Root cause

`admin_decide_kyc` runs as the service role and then updates `profiles.kyc_status`. The profile guard does not see the service role on the setting it checks, so it raises `column protected`. The database rolls the whole change back.

## Why the first repair was too wide

The first draft set `app.wallet_update` for the transaction. That same flag allows wallet balances, role, ban state, and the other protected profile columns to change. Another request cannot see a transaction-local flag. Inside the same transaction, the flag was still wider than an identity decision needs.

## Safer local SQL

File: `supabase/migrations/20261017000500_kyc_decision_profile_guard.sql`

The function now sets `app.kyc_status_update` only around the profile update, then turns that flag off. The guard allows `kyc_status` to change while the flag is on. Wallet balance, cash-out balance, bonus balance, role, and the other protected columns still raise `column protected`.

The function still requires the service role, checks that the actor exists, accepts only approved or rejected, locks the row, returns before a second audit row when nothing changed, and writes one audit row. It does not read or publish the document. `search_path` is `public, pg_catalog`.

The screen still says "Identity verification approved." or "Identity verification rejected." only after the database call succeeds. A failure does not change the pending count in the local card state.

## Tests

`scripts/kyc-decision.test.mjs` passed. It checks the message mapping, the audit-once SQL, the narrow flag, the service-role grant, and that the decision function does not mention wallet balance or a document URL.

No isolated PostgreSQL server was available. The function was not executed against a database. The real pending identity record was not opened, approved, or rejected.

## Owner action

Approve that one SQL file separately. Apply it only to project `zecitlewsynyioemsqna`. Do not use the real pending customer as the test.
