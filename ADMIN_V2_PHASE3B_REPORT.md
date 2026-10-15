# Phase 3B backend reliability report

Date: 14 October 2026. Branch `admin-v2-development`. HEAD `55a999017407bd70682b7dd25c131c5c0c3c1172`. Phase 2G, 2H, and 3A remain uncommitted and were kept.

This pass did not commit, push, merge, deploy, run SQL, change environment variables, call a payment or game provider, send a message, publish content, or approve a real identity check.

## 1. Executive summary

The money functions were inspected and left unchanged. The identity decision is still two separate database writes, so a crash between them can leave the submission and the player profile out of agreement. That needs a database function and was not built.

Safe code changes in this pass:

- A failed identity profile update no longer claims the check was restored if the restore itself failed.
- A saved ID upload no longer claims full success when the profile status or the audit row failed.
- Pending identity files stored as a web address or a data address are no longer sent to the browser.
- A failed role assignment tries to put the previous roles back, and a missing role audit is not called a clean success.
- A failed ticket list says Unavailable instead of looking empty.
- A follow-up deposit total that hits its read cap says Unavailable instead of showing a short number.
- A mixed activity feed says that one feed failed.

Release stays **not ready**. The identity decision is not one database transaction. Financial audit failures can still follow a successful money move. “Players seen today” was not re-queried.

## 2. Confirmed remaining defects

| ID | Severity | File | Evidence | Production impact | Recommended correction |
| --- | --- | --- | --- | --- | --- |
| 3B-01 | HIGH | `src/lib/actions/kyc-actions.ts` `updateKYCStatus` | Submission update at the status write, then a separate profile update. There is no `BEGIN` or single RPC. | A crash after the first write can leave the identity record and the player profile on different statuses. | Apply the proposed `admin_decide_kyc` function below. Do not apply it until the owner approves it on a database copy. |
| 3B-02 | HIGH | `src/lib/actions/admin/payouts.ts` `payoutCashout` | Line that returns `error.message` from `admin_payout_cashout`. `writeAudit` is called after the debit and its result is ignored. | A failed debit can show raw database text. A successful debit can still say paid if the audit insert fails. | Keep the SQL. Map known balance errors to plain text in a later review. Return a warning when the audit insert fails, without reversing the debit. |
| 3B-03 | MEDIUM | `src/lib/actions/admin/users.ts` `adjustWalletAction`, `adjustBalanceAction`, `recordCashoutPayoutAction` | Each calls `writeAudit` after the wallet RPC and then returns success. | The wallet change stands even when the audit row is missing. The screen still says the adjustment worked. | In a later review, return “saved, but not written to the audit log” without undoing the wallet RPC. |
| 3B-04 | MEDIUM | `src/lib/actions/deposits.ts` `updateDepositStatus` | On update failure it returns `error.message`. The audit call after a successful reject is not checked. | Staff can see a raw database error. A saved reject can look fully audited when it is not. | Replace the raw error with a fixed sentence. Check the audit result. Do not change the Paydora credit rule. |
| 3B-05 | MEDIUM | `src/app/admin/page.tsx` players-seen query | `headCount` on `profiles.last_seen_at` since 00:00 UTC. The earlier signed-in dashboard showed Unavailable while other profile counts loaded. No index on `profiles.last_seen_at` exists under `supabase/migrations`. | The card stays Unavailable. It does not become 0. The live error text was not read in this pass. | Add the index proposed in section 13 on a database copy, then reload the dashboard. Do not replace the error with 0. |
| 3B-06 | MEDIUM | `src/lib/actions/kyc-actions.ts` `getAdminKYCSubmissions` | Pending rows whose `document_url` starts with `http` used to be returned as that address. The live rows were not read. | Anyone who already has an old public address can still open it. The admin page no longer repeats that address. | After owner approval, list path-only rows in the SQL editor, without downloading files, and move leftover public objects into the private bucket. |
| 3B-07 | LOW | `src/lib/actions/admin/users.ts` `setUserRolesAction` | Roles are deleted and then inserted. This pass restores the previous rows if the insert fails. Restore is still a second request, not one transaction. | If both the insert and the restore fail, the account can be left without roles. The screen says the change stopped halfway. | Move the replace into one database function later. |

## 3. Issues fixed safely

- Identity restore now checks the restore error. If the restore fails, the message says the identity record could not be put back. `updateKYCStatus` in `src/lib/actions/kyc-actions.ts`.
- ID upload returns an error when the profile status update fails for a reason other than a missing column, and when the submit audit row is not written. The file and the submission row are not deleted.
- Pending `http` and `data:` document addresses are cleared before the list is returned. Private storage paths are still signed for 120 seconds, and only after `kyc.manage`.
- Role assignment restores the previous `user_roles` rows when the new insert fails, and it does not report a clean success when the audit row is missing.
- `listAdminTickets` returns null on a real ticket-table error. `/admin/support` shows Unavailable.
- `getDashboardStats` returns null for a failed count, a missing count, or a coin read that hits the 5,000-row cap. Nothing in the app calls this helper.
- Follow-up fulfilled deposits throw when a page of 1,000 rows is still full at the 20,000-row cap. The player-page fallback does the same at 5,000 rows. `/admin/crm` shows Unavailable instead of a short total. A real zero still stays 0.
- A player-list count error is no longer turned into 0.
- Recent activity still shows the feeds that loaded, and it now says when one feed failed.

## 4. Issues deferred

- One identity transaction. Documented in section 13. Not created as a migration file.
- `profiles.last_seen_at` index. Documented in section 13. The live error was not queried.
- Financial audit-result checks and payout error text. Left for a separate money review.
- Store-management audit results in `src/lib/actions/agents.ts`. Password reset and account updates still return success after an ignored audit write.
- Offer audience still stops at 5,000 profiles.
- Ticket attachment links that last 365 days.
- Saved AI blog settings that still publish after confirmation.
- Visual leftovers from the Phase 3 audit.

## 5. KYC consistency findings

`updateKYCStatus` in `src/lib/actions/kyc-actions.ts`:

- It requires `kyc.manage`.
- It writes the submission status as `approved` or `rejected`.
- It writes the profile `kyc_status` as `verified` for an approval and `rejected` for a rejection. The cash-out route already accepts both `verified` and `approved`, so this pass did not rename the stored values.
- If the profile write fails, it writes the previous submission status back. If that second write fails, the new message says the record could not be put back. Severity MEDIUM. The two writes can still disagree if the process stops between them. Severity HIGH. Production impact: a player can be approved on one record and not on the other until someone looks. Recommended correction: the function in section 13.
- If both writes succeed and the audit insert fails, the function returns “The identity decision was saved, but it was not written to the audit log.” A retry writes the same statuses again and can add a second audit row. That is confusing, not a second balance change. A transaction with one audit insert would remove the duplicate.
- Player upload upserts one row per user. A retry replaces that row and stores a new private file. The old file remains in the bucket. The upload now refuses a success message when the profile update or the audit insert fails.

## 6. KYC privacy findings

- New uploads store a private path such as `userId/uuid.jpg` in `kyc-documents`. They do not store a public web address. `submitKYCDocument`.
- `supabase/migrations/20261013000140_kyc_private_bucket.sql` sets that bucket to `public = false` and adds no public read policy. This pass did not query the live bucket and did not change storage policies.
- `getAdminKYCSubmissions` calls `authorize("kyc.manage")` before signing. Signed links last 120 seconds. Approved and rejected rows still have their link cleared.
- Smallest safe fix applied: a pending `http` or `data:` value is cleared in the response. The database row is not edited. The browser does not receive that address. A person who already knows an old public address can still open it until the owner moves the file.
- No identity file was opened or downloaded.

## 7. Financial reliability findings

No financial file was modified. No payment was executed.

- `payoutCashout` authorizes `requests.manage`, checks network scope, then calls `admin_payout_cashout`. The SQL still raises on insufficient balance. The TypeScript returns `error.message`. Audit is after the debit and is not checked. Severity HIGH for the raw error and the silent audit miss. Do not reverse a debit to repair a missing audit row.
- `src/app/api/payments/paydora/payout/route.ts` reserves with `reserve_paydora_payout`, refuses a `refund:` idempotency key, returns the existing payout when the status is already submitted or paid, and uses `begin_paydora_provider_attempt` so a second request does not call the provider again. A clear provider rejection calls `fail_paydora_payout`. An ambiguous or timeout result stays pending and is not refunded by this route.
- `creditPaydoraDeposit` uses `credit_paydora_deposit` and treats an existing marker as a duplicate. The webhook returns HTTP 500 on failure so Paydora can retry. A retry of an already credited deposit does not credit again. `settleDepositSideEffects` upserts the bonus ledger and commission with `ignoreDuplicates`, and game-load inserts use a `source_key`.
- `reversePaydoraDeposit` uses the saved final credit from `deposit_bonus_ledger`, not a second bonus calculation. The webhook refund path calls it. Audit is written only when `reversed` is true, and that audit result is ignored.
- Wallet adjustments in `src/lib/actions/admin/users.ts` authorize first, call `credit_wallet`, `debit_wallet`, `grant_coins`, or `grant_xp`, and map insufficient-balance text to a plain sentence. They still report success if the later audit write fails.
- `updateDepositStatus` refuses to mark a deposit completed in the admin action. Completion stays on the Paydora confirmation path. Reject still returns the raw database message.

Suspected defects are 3B-02, 3B-03, and 3B-04. They were not patched in this pass.

## 8. Game-load reliability findings

No provider client was called. No game-load SQL was edited.

- Staff Complete and Failed go through `adminUpdateGameLoadStatus` to `finishGameLoad`, which calls `complete_game_load`. That function locks the pending or processing row. A failed `load` or `reload` calls `refund_game_load_wallet`.
- `refund_game_load_wallet` in `supabase/migrations/20261011000280_refund_wallet_refunded_column.sql` returns without a second credit when `wallet_refunded` is already true or `game_api_debited` is true. That is the existing double-refund stop.
- Staff Cancel calls `cancel_game_load_service` in `supabase/migrations/20261013000150_hold_pending_game_load_cancel.sql`. For `load` and `reload` it raises “A person has to confirm this game load before the wallet can change” and does not refund by itself.
- Fire Kirin `failRequest` refunds only when the caller asks for a refund and the outcome is not classified as unknown. An unknown provider result updates the error text and leaves the status pending or processing.
- These safeguards are still in the source. They were not changed.

## 9. Audit logging findings

`writeAudit` in `src/lib/actions/admin/core.ts` returns false when the admin client is missing, the insert returns an error, or the write throws.

Checked, and still ignored after the main write:

- Cash-out debit: `payoutCashout`. Do not change in this pass.
- Wallet and coin adjustments: `adjustWalletAction`, `adjustBalanceAction`, `recordCashoutPayoutAction`. Do not change in this pass.
- Deposit reject: `updateDepositStatus`. Do not change in this pass.
- Deposit credit and refund: `creditPaydoraDeposit`, `reversePaydoraDeposit`. Do not change in this pass.
- Store actions: `src/lib/actions/agents.ts` around the `writeAudit` calls after create, password, and status changes.
- Game-load staff status: `adminUpdateGameLoadStatus` does not write an audit row at all.

Checked, and now reported:

- Identity approve, reject, and submit.
- Role replacement in `setUserRolesAction`.

Recommended correction for the deferred actions: after the money or store write has succeeded, if `writeAudit` returns false, return a message that the change was saved and the audit row was not. Do not undo the money write.

## 10. Reporting accuracy findings

- Players seen today: the query is a count of `profiles.last_seen_at` from 00:00 UTC. `headCount` returns null on error, and the card says Unavailable. The earlier dashboard showed Unavailable while new-player counts loaded. This pass did not query production, so the exact database error remains unverified. There is no `last_seen_at` index in `supabase/migrations`. A failed count was not replaced with 0.
- CRM totals: the platform RPC `admin_crm_overview_stats` is still used when it succeeds. The TypeScript fallback no longer returns a fulfilled total after a full 20,000-row page. The parent-scoped total uses the same cap and the same parent id list as before. An empty parent list still returns zeros and does not read every profile.
- Recent activity: a total failure still says Unavailable. A partial failure now says one feed could not be loaded and shows only the feeds that loaded.
- Store and sub-creator home counts were left on `scope.parentIds`. A sub-creator commission still uses that sub-creator’s own id.
- The unused `getDashboardStats` helper no longer turns a failed count into 0.
- The ticket list no longer turns a failed read into an empty list.

## 11. Tests and build results

25 safe source tests passed, exit 0. `scripts/auto-money.test.mjs` was not run. No test was edited to force a pass.

- `npx tsc --noEmit` — exit 0.
- Isolated `npx next build` — exit 0, Next.js 15.5.19, about 5.0 minutes.
- The development server was not stopped. The isolated directory and its copied environment file were removed. Project `node_modules` and `.env.local` are still present.
- Existing image, hook, workspace-root, and Edge Runtime warnings remained.

## 12. Files modified

This phase:

- `src/lib/actions/kyc-actions.ts`
- `src/lib/actions/admin/users.ts`
- `src/lib/support/ticket-store.ts`
- `src/lib/data/admin-stats.ts`
- `src/lib/data/admin-crm.ts`
- `src/app/admin/page.tsx`
- `src/app/admin/crm/page.tsx`
- `src/app/admin/support/page.tsx`
- `ADMIN_V2_PHASE3B_REPORT.md`

Phase 2G, 2H, and 3A files were not reverted. `eng.traineddata` stays untracked.

## 13. Required database changes

Not created and not applied. Run only on a database copy after the owner approves.

Identity decision, one transaction. Rollback is `DROP FUNCTION IF EXISTS public.admin_decide_kyc(uuid, text, uuid);`. The app should call this only after a separate review. Do not drop the current tables.

```sql
CREATE OR REPLACE FUNCTION public.admin_decide_kyc(
  p_submission_id uuid,
  p_status text,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.kyc_submissions;
  v_profile text;
BEGIN
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid identity status';
  END IF;

  SELECT * INTO v_row
  FROM public.kyc_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'identity check not found';
  END IF;

  v_profile := CASE WHEN p_status = 'approved' THEN 'verified' ELSE 'rejected' END;

  UPDATE public.kyc_submissions
  SET status = p_status, updated_at = now()
  WHERE id = v_row.id;

  UPDATE public.profiles
  SET kyc_status = v_profile, updated_at = now()
  WHERE id = v_row.user_id;

  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data
  ) VALUES (
    p_actor,
    CASE WHEN p_status = 'approved' THEN 'kyc.approve' ELSE 'kyc.reject' END,
    'kyc_submission',
    v_row.user_id::text,
    jsonb_build_object('status', v_row.status),
    jsonb_build_object('status', p_status)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_decide_kyc(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_decide_kyc(uuid, text, uuid) TO service_role;
```

Players-seen index. Rollback is `DROP INDEX IF EXISTS public.profiles_last_seen_at_idx;`. This does not change a count formula.

```sql
CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx
  ON public.profiles (last_seen_at);
```

Confirm the `audit_logs` column names on the copy before running the identity function. This report did not query that table.

## 14. Remaining production risks

- The identity decision can still split across two rows until the function above is reviewed and wired in.
- A cash-out debit, wallet adjustment, deposit reject, and store change can still report success when the audit insert fails.
- `payoutCashout` can still show the database error text.
- Staff Failed on a load or reload still follows `complete_game_load`, which refunds once when the wallet was not already refunded and the game API was not marked debited. That is the existing rule, not a new refund path.
- Old public identity addresses, if any exist, still work for someone who has the address.
- “Players seen today” can stay Unavailable until the index is confirmed on a copy.
- A follow-up total above the page cap now shows Unavailable instead of a short dollar figure.
- This branch is not the known production commit.

## 15. Release readiness decision

**Not ready.**

The safe reporting and identity-message fixes are in the working tree. The release blockers that need a database function, a money review, or a live read of “Players seen today” are still open. Wait for the owner before any staging deploy.

## Final safety check

- Branch remains `admin-v2-development`.
- HEAD remains `55a999017407bd70682b7dd25c131c5c0c3c1172`.
- Phase 2G changes are still present.
- Phase 2H changes are still present.
- Phase 3A changes are still present.
- No production database change was made.
- No financial SQL file was modified.
- No provider call was made.
- No email, SMS, or Telegram message was sent.
- No content was published.
- No commit was created.
- No push occurred.
- No deployment occurred.
