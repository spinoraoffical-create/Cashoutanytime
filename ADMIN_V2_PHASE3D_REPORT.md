# Phase 3D final backend release blockers

Date: 14 October 2026. Branch `admin-v2-development`. HEAD `55a999017407bd70682b7dd25c131c5c0c3c1172`. Earlier uncommitted work was kept.

This pass did not commit, push, merge, deploy, run SQL, change environment variables, call a provider, send a message, or publish content.

## 1. Executive summary

Paydora credit, refund, payout-void credit, and automatic settlement now record a missed audit row in the existing incident log and continue. A missed audit does not throw, so the webhook does not ask Paydora to retry a payment that already succeeded.

Ban, delete, and role changes that are already saved now show the same warning used for money actions. A real failure is still an error. The identity decision function and the players-seen index are prepared as migration files and were not applied. The app does not call the identity function.

Release stays **not ready** until those two files are approved on a database copy and the owner completes the checklist below on staging.

## 2. Confirmed bugs fixed

- A successful Paydora credit, refund, payout-void credit, or automatic settlement no longer ignores a failed audit write in silence. The money call still runs once.
- A saved ban, account delete, or role change is no longer presented as a clean success when the audit row is missing, and it is not presented as a failed save.
- Role save used to return an error after the roles were already replaced. It now returns success plus the audit warning.

## 3. Paydora audit handling

`writeAudit` returns false and does not throw. These callers now check that result:

| Path | File | After a successful money call |
| --- | --- | --- |
| `creditPaydoraDeposit` | `src/lib/payments/paydora-wallet.ts` | Logs `deposit.credit` and returns the credit result |
| Payout-void credit inside the same function | same file | Logs `deposit.payout_void` and returns the credit result |
| `reversePaydoraDeposit` | same file | Logs `deposit.refund` only when the reverse RPC reports `reversed` |
| `settleDepositSideEffects` | `src/lib/payments/auto-settle.ts` | Logs `deposit.auto_settle`, then still marks the webhook processed |

The log line is only the action name plus “audit row was not saved.” Amounts, account numbers, and document data are not written to that line. The credit, bonus, and refund amounts are unchanged. `alreadyApplied` still returns before a second `credit_paydora_deposit` call. The webhook still returns HTTP 500 `RETRY` when the credit or reverse itself throws. It does not return 500 because the audit insert failed.

## 4. KYC transaction review

`supabase/migrations/20261014000160_admin_decide_kyc.sql` matches the Phase 3C review and the current schema:

- `kyc_submissions.status` allows `pending`, `approved`, and `rejected`.
- `profiles.kyc_status` is added by earlier migrations and defaults to `unverified`.
- `audit_logs` uses `actor_id`, `action`, `entity_type`, `entity_id`, `before_data`, `after_data`, `ip_address`, and `user_agent`.
- The function requires `service_role`, checks that the actor exists in `auth.users`, locks the submission and the profile, raises if the profile is missing, and returns without a second audit row when the decision is already stored.
- Execute is revoked from `public`, `anon`, and `authenticated`, and granted only to `service_role`.
- The document address is not inserted.

`src/lib/actions/kyc-actions.ts` does not call `admin_decide_kyc`. Do not wire it until staging proves the function exists.

After that proof, the application change is: `updateKYCStatus` still calls `authorize("kyc.manage")` first, then calls the RPC once with the staff user id. If the RPC is missing, return a not-ready error and do not run the old two-update path in the same request. A repeat decision should rely on the function’s early return.

## 5. Security and privacy findings

Identity privacy checklist. Do not download files. Do not change the live bucket in this step.

- Confirm on a database copy that bucket `kyc-documents` has `public = false`. The file `20261013000140_kyc_private_bucket.sql` sets that. This pass did not query the live bucket.
- Count `kyc_submissions` rows whose `document_url` starts with `http` or `data:`. Do not print those addresses.
- New uploads store a private path. Pending private paths are signed for 120 seconds and only after `kyc.manage`. Approved and rejected rows do not get a link.
- The admin list clears `http` and `data:` values before they reach the browser. The database row is unchanged, so an old public address still works for someone who already has it.
- A repeated upload stores a new file and leaves the previous object in the bucket.
- Cleanup after owner approval: copy leftover public objects into the private bucket, replace the stored value with the private path, then remove the public object. Do not delete a file until the private path is confirmed.

Signed-in cash-out still accepts profile status `verified` or `approved`. That check was not weakened.

A failed store password reset still returns the provider message. That path was not rewritten.

## 6. Remaining issues

- The two new SQL files are not applied.
- The identity screen still uses two updates until the function is staged and then wired.
- Paydora webhook delivery can still retry when the credit itself fails. That is intentional.
- “Players seen today” still says Unavailable when the count fails. The missing index is a plausible cause: other profile counts in the same request use `created_at`, and no earlier migration indexes `last_seen_at`. The live error was not queried, so the index is not proven.
- This branch is not the known production commit. The work is uncommitted.

## 7. Test results

`scripts/phase3d-release-blockers.test.mjs` checks the audit log text, one credit attempt on a duplicate delivery, webhook retry staying on real errors, staff permission order, password failure before the audit write, the identity SQL contract, and the fact that the app does not call that SQL.

27 safe source tests passed, including that file and the previous financial-audit test. `scripts/auto-money.test.mjs` was not run. No provider was called.

## 8. Build results

- `npx tsc --noEmit` — exit 0.
- Isolated `npx next build` — exit 0, Next.js 15.5.19, about 6.8 minutes, in `final-file-main/phase3d-build`.
- That folder was removed. Project `node_modules` and `.env.local` remain. The development server was not stopped.
- Existing image, hook, workspace-root, and Edge Runtime warnings remained.

## 9. Files modified

This phase:

- `src/lib/admin/audit-result.ts`
- `src/lib/payments/paydora-wallet.ts`
- `src/lib/payments/auto-settle.ts`
- `src/lib/actions/admin/users.ts`
- `src/components/admin/user-management-panel.tsx`
- `src/components/admin/confirm-action-button.tsx`
- `scripts/phase3d-release-blockers.test.mjs`
- `supabase/migrations/20261014000160_admin_decide_kyc.sql`
- `supabase/migrations/20261014000170_profiles_last_seen_at_index.sql`
- `ADMIN_V2_PHASE3D_REPORT.md`

## 10. Proposed migrations

Not applied.

| File | What it does | Rollback |
| --- | --- | --- |
| `20261014000160_admin_decide_kyc.sql` | One identity decision and one audit row | `DROP FUNCTION IF EXISTS public.admin_decide_kyc(uuid, text, uuid, text, text);` |
| `20261014000170_profiles_last_seen_at_index.sql` | Index on `profiles.last_seen_at` | `DROP INDEX IF EXISTS public.profiles_last_seen_at_idx;` |

Run them only on a database copy, in that order, after reading the file headers. Do not run them on production from this pass.

## 11. Deployment checklist

Use a staging copy. Do not use a customer’s real money, identity photo, or phone. A safe test account is a new player created on staging, plus one store account and one Super Admin. Expected balances start at zero. Mark paid and wallet adjustments on staging should use a $1 test credit that can be reversed on that copy only.

### Player side

| Area | What to do | Expected result |
| --- | --- | --- |
| Signup and login | Create the test player with terms and offers checked | Account exists. Offers stay off if the offers box is cleared. |
| Profile | Open the profile and save a display name | Name saves. No balance changes. |
| KYC submission | Upload a sample image that is not a real ID | Row is pending. Stored value is a private path, not a web address. |
| Game catalog | Open the public game list | Games marked inactive stay hidden. No load is sent. |
| Game loads | Do not complete a provider load | Pending rows stay pending. Do not press Complete or Failed. |
| Deposits | Start a Paydora checkout only if staging keys are isolated | Wallet credit happens only after a staging webhook. A second webhook does not credit twice. |
| Withdrawals | Request a $1 cash-out on the test balance | Reservation is one row. An insufficient balance shows the plain balance message. |
| Support chat | Send “staging test” to support | Ticket or chat is stored. No customer campaign is sent. |
| Rewards and offers | Open rewards and the offer screen | Do not press Send. Eligible counts can be zero. |

### Admin side

| Area | What to do | Expected result |
| --- | --- | --- |
| Dashboard | Open `/admin` as Super Admin | Failed counts say Unavailable, not 0. Do not treat “Players seen today” as zero if it says Unavailable. |
| Player CRM | Open follow-up for the test store | Totals stay inside that store. An oversized total says Unavailable. |
| Financial Center | Open deposits, cash-outs, and payout operations | Read-only pages do not send or refund. Mark paid on the $1 test row warns if the audit row is missing and does not debit again. |
| Game Center | Open game loads | Complete and Failed are not pressed. |
| Store management | Open sub-creators as Super Admin | Creating, editing, or resetting a password on a staging agent shows a warning if the audit row is missing. The login is not created twice. |
| KYC review | Open the sample pending row | Approve is not pressed until the identity SQL is applied on that copy and the app is wired in a later change. |
| Marketing | Open offers, newsletters, and AI blog | Do not send, publish, or broadcast. |
| CMS | Open pages, FAQ, reviews, and city pages | A new FAQ stays unpublished until the switch is turned on. Do not press Generate all states. |
| Support | Open tickets | A failed list says Unavailable. Do not reply to a real customer. |
| Security | Open security and fraud as Super Admin | No customer is banned except the staging test account, and that ban shows the audit warning if the log insert fails. |
| Roles and permissions | Change roles only on the staging test account | A failed save stays an error. A saved change with a missing audit row is a warning, not a failure. |

### Environment isolation

- Staging uses its own Supabase project and its own Paydora keys.
- Production `PAYDORA_WEBHOOK_SECRET`, service role key, and site URL stay untouched.
- Do not point the staging webhook at production.
- Apply the two SQL files on the staging database only after this checklist is accepted.
- Deploy the app only after staging checks pass. Production is still the known Phase 2D commit until the owner asks for that deploy.

## 12. Rollback plan

- App rollback: do not deploy this branch. The current production commit stays in place.
- If the identity function was applied on a copy and must be removed: run the drop function statement in section 10. Existing identity rows stay as they are.
- If the index was applied and must be removed: drop `profiles_last_seen_at_idx`. Counts keep their current meaning.
- Do not reverse a staging debit only because an audit warning appeared. The warning means the money change is already saved.
- Do not delete identity files as a rollback.

## 13. Release readiness

**Not ready for production.**

The code-level audit warnings for Paydora and the listed admin actions are in the working tree. The identity function and the players-seen index are files only. Staging validation and an explicit owner deploy are still required.

## Final safety check

- Branch remains `admin-v2-development` at `55a999017407bd70682b7dd25c131c5c0c3c1172`.
- Phase 2G, 2H, 3A, 3B, and 3C changes are still present.
- No production data was changed.
- No SQL was executed.
- No provider was called.
- No commit, push, or deployment occurred.
