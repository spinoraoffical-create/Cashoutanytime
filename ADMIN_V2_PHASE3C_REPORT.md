# Phase 3C financial audit reliability

Date: 14 October 2026. Branch `admin-v2-development`. HEAD `55a999017407bd70682b7dd25c131c5c0c3c1172`. Phase 2G, 2H, 3A, and 3B changes were kept.

This pass did not commit, push, merge, deploy, run SQL, change environment variables, call a payment or game provider, send a message, or publish content. Wallet math, payout reservation, refund behavior, permissions, and RLS were not changed.

## Files modified

This phase:

- `src/lib/admin/audit-result.ts`
- `src/lib/actions/admin/core.ts`
- `src/lib/actions/admin/payouts.ts`
- `src/lib/actions/admin/users.ts`
- `src/lib/actions/deposits.ts`
- `src/lib/actions/agents.ts`
- `src/components/admin/payout-form.tsx`
- `src/components/admin/deposit-actions.tsx`
- `src/components/admin/user-management-panel.tsx`
- `src/components/admin/sub-creators-manager.tsx`
- `src/components/admin/network-players.tsx`
- `scripts/financial-audit-result.test.mjs`
- `ADMIN_V2_PHASE3C_REPORT.md`

## Financial audit fixes

`writeAudit` already returns false when the audit row is not saved. These money operations used to ignore that result and report a clean success. Each one still runs the same mutation once. None of them calls the money function again, and none reverses a debit because the audit insert failed.

| Operation | File | Money call, unchanged | When the audit insert fails |
| --- | --- | --- | --- |
| Mark paid | `payoutCashout` | `admin_payout_cashout` once | `{ ok: true, auditWarning }` |
| Wallet credit or debit | `adjustWalletAction` | `credit_wallet` or `debit_wallet` once | `{ ok: true, auditWarning }` |
| Coins or XP adjustment | `adjustBalanceAction` | `grant_coins` or `grant_xp` once | `{ ok: true, auditWarning }` |
| Profile cash-out record | `recordCashoutPayoutAction` | `admin_payout_cashout` once | `{ ok: true, auditWarning }` |
| Deposit reject or processing | `updateDepositStatus` | one status update | `{ success: true, auditWarning }` |

The warning is: “Saved, but not written to the audit log. The change was not undone.”

The screen now separates the three results:

- Failed: a red error. The money call did not succeed, or the operator was not allowed to make it.
- Succeeded: a green success message. The money call and the audit row both succeeded.
- Succeeded without an audit row: a warning. The form or dialog still closes so the operator is not invited to submit the same debit again.

`ok: false` is not used for a saved money change.

Ban, delete, and role changes in `users.ts` are not money operations. Ban and delete still ignore a failed audit write. Role changes already return an error after the roles are saved, which is a different rule from this money warning.

Paydora credit, Paydora refund, and automatic deposit settlement still ignore a failed audit write. Those files were outside this pass and were not edited.

## Store audit fixes

These store actions now use the same warning after the existing write. Account creation, password reset, and the permission checks were not rewritten.

- `createAgentAction`
- `setAgentActiveAction` and `setAgentsActiveAction`
- `updateAgentAction`
- `resetAgentPasswordAction`
- `movePlayerAction`

A failed password update still returns the provider message, because that failure path was left as it was. A password that was saved, with a missing audit row, shows the warning instead of a second reset prompt.

## Error handling improvements

`payoutCashout` no longer returns the database text.

- An insufficient-balance error still says: “The cash-out balance is too low for that amount.”
- Every other payout database error says: “The cash-out could not be recorded.”
- The `admin_payout_cashout` call is unchanged.

Deposit reject still cannot mark a Paydora deposit completed. That sentence is unchanged: “The wallet is credited when Paydora confirms the payment.” A failed deposit read or status save now says the deposit could not be loaded, or the status could not be saved. The audit result is checked after the status update. Crediting and refund functions were not edited.

## Tests and build results

`scripts/financial-audit-result.test.mjs` checks, without calling a provider or the database:

- A saved change plus a saved audit row has no warning.
- A saved change plus a failed audit stays successful and shows the warning.
- A failed change stays a failure and does not show the warning.
- One attempt calls the mutation counter once. The audit helper does not call it again.
- A raw function-name error is replaced. The insufficient-balance wording is kept.
- Source order: each money call appears once, before `writeAudit`, and the payout file does not return `error.message`.

26 safe source tests passed, including that new file and the previous 25. `scripts/auto-money.test.mjs` was not run.

- `npx tsc --noEmit` — exit 0 after the deposit warning type was narrowed.
- Isolated `npx next build` — exit 0, Next.js 15.5.19, about 11.4 minutes, inside `final-file-main/phase3c-build`.
- That folder, including its copied environment file, was removed. Project `node_modules` and `.env.local` are still present.
- The development server was not stopped.
- Existing image, hook, workspace-root, and Edge Runtime warnings remained.

## KYC migration review

The Phase 3B `admin_decide_kyc` sketch was not created and was not run. Compared with the current source:

- `audit_logs` columns in `supabase/migrations/20260613000009_support_cms_catalog.sql` are `actor_id`, `action`, `entity_type`, `entity_id`, `before_data`, `after_data`, `ip_address`, `user_agent`, and `created_at`. `entity_id` is text. `actor_id` references `auth.users` and becomes null if that user is deleted.
- The insert policy in `20260613000011_rls.sql` allows a staff insert only when `actor_id` equals `auth.uid()`. A service-role call often has no `auth.uid()`, so the app insert uses the service role and bypasses that policy. A `SECURITY DEFINER` function owned by the database owner also bypasses row security.
- The Phase 3B sketch grants execute only to `service_role`, which is right, but it does not check the role inside the function. If a later grant gives execute to `authenticated`, any signed-in user could approve an identity check.
- The sketch does not prove the actor exists before the insert.
- It updates `profiles` even when no profile row exists, then still writes the audit row. The submission change would remain committed.
- A retry of the same decision inserts another audit row.
- It cannot see the browser IP or user agent unless those values are passed in.
- Submission status must stay `approved` or `rejected` because of the check constraint. Profile status stays `verified` or `rejected`, which is what cash-out already accepts. The sketch got that vocabulary right. It correctly omits the document address.

Corrected proposal, report only. Rollback: `DROP FUNCTION IF EXISTS public.admin_decide_kyc(uuid, text, uuid, text, text);`

```sql
CREATE OR REPLACE FUNCTION public.admin_decide_kyc(
  p_submission_id uuid,
  p_status text,
  p_actor uuid,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.kyc_submissions;
  v_profile_status text;
  v_current_profile text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_actor) THEN
    RAISE EXCEPTION 'actor not found';
  END IF;
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

  v_profile_status := CASE WHEN p_status = 'approved' THEN 'verified' ELSE 'rejected' END;

  SELECT kyc_status INTO v_current_profile
  FROM public.profiles
  WHERE id = v_row.user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'player profile not found';
  END IF;

  IF v_row.status = p_status AND v_current_profile = v_profile_status THEN
    RETURN;
  END IF;

  UPDATE public.kyc_submissions
  SET status = p_status, updated_at = now()
  WHERE id = v_row.id;

  UPDATE public.profiles
  SET kyc_status = v_profile_status, updated_at = now()
  WHERE id = v_row.user_id;

  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data, ip_address, user_agent
  ) VALUES (
    p_actor,
    CASE WHEN p_status = 'approved' THEN 'kyc.approve' ELSE 'kyc.reject' END,
    'kyc_submission',
    v_row.user_id::text,
    jsonb_build_object('status', v_row.status),
    jsonb_build_object('status', p_status),
    p_ip,
    p_user_agent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_decide_kyc(uuid, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_decide_kyc(uuid, text, uuid, text, text) TO service_role;
```

The app must still call `authorize("kyc.manage")` before this function. The function is one transaction: a missing profile or a failed audit insert rolls the status writes back. A repeat of the same decision does not add a second audit row. Do not apply this until the owner approves it on a database copy. Confirm `profiles.kyc_status` exists on that copy first.

## Remaining backend blockers

- Identity approve and reject in the app are still two writes. The function above is not wired in.
- Paydora credit, Paydora refund, and automatic settlement can still report success when their audit insert fails.
- Ban and delete can still report success when their audit insert fails.
- A failed password reset can still show the provider error text.
- “Players seen today” can stay Unavailable. The index was not created.
- This branch is not the known production commit.

## Production impact

Operators who mark a cash-out paid, adjust a wallet, reject a deposit, or save a store change will see a warning when the audit row is missing. The balance, deposit status, or store record stays saved. They will not see a failure for a debit that already happened, and the screen will not ask them to run that debit again. Payout errors other than insufficient balance no longer include SQL text. No live balance was changed by this pass.

## Release readiness

**Not ready.** The audit warning is in place for the money and store actions listed above. The identity transaction, Paydora audit warnings, and the players-seen count are still open. Wait for the owner before any staging deploy.

## Final safety check

- Branch remains `admin-v2-development`.
- HEAD remains `55a999017407bd70682b7dd25c131c5c0c3c1172`.
- Phase 2G, 2H, 3A, and 3B changes are still present.
- No SQL was executed.
- No migration file was created.
- No provider was called.
- No production record was changed by this pass.
- No commit, push, merge, or deployment occurred.
