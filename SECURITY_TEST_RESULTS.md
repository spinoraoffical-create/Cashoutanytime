# Security test results

Date: 13 October 2026. No production database, no live Paydora call, and no signed-in browser session.

## Passed

| Check | Command | Result |
|---|---|---|
| Deposit status ownership | `node scripts/deposit-access.test.mjs` | passed |
| Rate-limit decision blocks errors and exhaustion | `node scripts/rate-limit.test.mjs` | passed |
| KYC type and size rules | `node scripts/kyc-upload.test.mjs` | passed |
| Admin list scope denies a bad scope and limits a store | `node scripts/admin-list-scope.test.mjs` | passed |
| Staff access source checks | `node scripts/staff-access.test.mjs` | passed |
| Restricted-state source checks | `node scripts/restricted-state.test.mjs` | passed |
| Chat bot uses the signed-in user | `node scripts/financial-trust.test.mjs` | passed |
| TypeScript | `npx tsc --noEmit` | exit 0 |

The rate-limit test covers a normal allow, a repeated-request denial (`allowed: false`), a database error, and an unreadable payload. Those are decision tests. They do not open 100 connections to Supabase.

The deposit test refuses another player's provider user, a mismatched payment intent, and a deposit with no owner at all.

The KYC test rejects HTML, a non-file string, and a file larger than 5 MB. It accepts a small PNG data URL. It does not upload a file.

## Not tested

- A signed-in store creator opening another store's player and clicking Pay.
- A signed-in player calling `/api/payments/paydora/status` for someone else's deposit id.
- A player calling an admin server action without a staff session. The actions still call `authorize` or `requireStaff` in source. NOT TESTED in a browser.
- Uploading an ID after the private bucket exists.
- Geographic restriction from a Washington, Idaho, Nevada, or Michigan IP. The payment routes still call `isRestrictedPaymentRequest` in source. NOT TESTED from those states.
- Supabase row-security policies on the live database.

## Authorization notes

Store and sub-creator cash-out payouts now go through `adminListScope`. Platform staff who already have `requests.manage` and are not a store can still pay. That matches the existing list rule.

Support actions still require `support.manage`. Settings still require `settings.manage`. This pass did not invent new roles.
