# KYC function integration

Date: 14 October 2026. Branch `admin-v2-development`. HEAD `55a999017407bd70682b7dd25c131c5c0c3c1172`.

The owner confirmed that `20261014000160_admin_decide_kyc.sql` and `20261014000170_profiles_last_seen_at_index.sql` are already applied on the existing Supabase project. This pass did not run either file again.

This pass did not commit, push, merge, deploy, change environment variables, change a player record, approve or reject an identity submission, or call a payment or game provider.

## 1. What changed

`updateKYCStatus` in `src/lib/actions/kyc-actions.ts` now decides an identity check with one `admin_decide_kyc` call.

The order is:

1. `authorize("kyc.manage")` still runs first. A staff member without that permission gets the existing permission error.
2. The submission is loaded by row id, then by player id. The review screen still passes the player id, so that lookup stays.
3. The service-role client calls `admin_decide_kyc` once with the submission row id, the requested status, the staff user id, the client IP, and the user agent.
4. A missing function returns `Identity review is not ready on this server.` The old submission update and profile update are gone from this function. There is no fallback.
5. Any other database error returns a short save error. A missing profile uses `The identity status could not be saved. The check was left as it was.` The function rolls that attempt back, so the submission status stays as it was.
6. On success, the same dashboard, wallet, games, and identity paths are revalidated.

Player upload, private document paths, and the 120-second signed URL for a pending check are unchanged. Player status still reads `profiles.kyc_status` and shows `verified` as approved.

## 2. Status mapping

The screen still sends `approved` or `rejected`. That value is `p_status`.

Inside the applied function, `approved` sets `profiles.kyc_status` to `verified`, and `rejected` sets it to `rejected`. The application no longer writes those two columns itself.

## 3. Duplicate decisions

The applied function returns immediately when the submission status and the profile status already match the request. That return happens before the audit insert, so a repeated approve or reject does not add a second audit row.

The application calls the function once and does not call `writeAudit` for this decision. The audit row is the insert inside the function. A failed insert rolls both status writes back, so a saved decision and a missing audit row cannot diverge on this path.

## 4. Unavailable function

`identityRpcUnavailable` treats PostgREST code `PGRST202`, and a schema-cache message that names `admin_decide_kyc`, as a missing function. The action then returns the not-ready error and stops. It does not update `kyc_submissions` or `profiles`.

## 5. Players seen today

The dashboard query is unchanged. It counts `profiles.last_seen_at` from 00:00 UTC. `headCount` returns null when that query errors, and the card says Unavailable. A real zero stays 0.

The owner applied the column and index. This pass did not query the live table and did not run the SQL again.

`pingSitePresence` updates `last_seen_at` and `is_online` in the same request. No file under `supabase/migrations` adds `is_online`. If that column is absent, the whole heartbeat is rejected and `last_seen_at` stays empty, so the count can stay 0 after the new column exists. Chat and admin user lookups also select `is_online`. This pass did not change the heartbeat and did not add a column. Confirm `is_online` in the table editor before expecting visits to fill Players seen today.

## 6. Tests and build

- 27 safe source tests passed, including `scripts/kyc-upload.test.mjs`, `scripts/phase3d-release-blockers.test.mjs`, and `scripts/financial-trust.test.mjs`.
- `scripts/auto-money.test.mjs` was not run.
- `npx tsc --noEmit` exited 0.
- Isolated `npx next build` exited 0. Next.js 15.5.19, about 6.7 minutes, in `final-file-main/kyc-integration-build`.
- That folder was removed. Project `node_modules` and `.env.local` remain. The development server was not stopped.
- The existing workspace-root, Edge Runtime, image, and hook warnings remained.

The updated tests require one `admin_decide_kyc` call after `authorize("kyc.manage")`, `p_status: newStatus`, the not-ready error, and no `writeAudit` or `.update(` in the decision function. They still require the function’s `approved` to `verified` mapping and its early return before a second audit insert.

## 7. Files modified

- `src/lib/actions/kyc-actions.ts`
- `scripts/kyc-upload.test.mjs`
- `scripts/phase3d-release-blockers.test.mjs`
- `ADMIN_V2_KYC_INTEGRATION_REPORT.md`

The dashboard page and `src/lib/actions/presence.ts` were not edited. Earlier Admin 2.0 changes remain in the working tree.

## 8. Remaining limits

- The public site does not have this change until a later deploy. This pass did not deploy.
- Identity approve and reject on the local app now call the live function. This pass did not press either button.
- Players seen today still depends on `last_seen_at` being present and on heartbeats succeeding. `is_online` is a separate confirmation.
- A failed store password reset can still show the provider message. That path was not part of this change.

## Final safety check

- Both SQL files were left untouched and were not executed.
- No identity submission was approved or rejected.
- No balance, transaction, or game load was changed.
- No provider was called.
- No commit, push, merge, or deployment occurred.
