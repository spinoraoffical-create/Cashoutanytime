# Admin v2 payout security hardening

Date: 13 October 2026. This pass hardens the read-only payout activity page. Payment routes, wallet math, payout reservation, refunds, migrations, row security, staff permissions, and financial database functions were not edited. Nothing was deployed, committed, or written to the database.

## 1. Files changed

- `src/lib/admin/payout-operations-guard.ts` — access plan and display allowlists
- `src/lib/admin/payout-operations.ts` — scope is resolved before the payout table is read
- `src/app/admin/payout-operations/page.tsx` — list uses that plan, and lookup failures show an error
- `src/app/admin/payout-operations/[id]/page.tsx` — detail uses the same plan before loading one record
- `scripts/payout-operations-security.test.mjs` — access, network, and allowlist checks
- `scripts/payout-operations-ui.test.mjs` — updated for the shared scope check
- `ADMIN_V2_PAYOUT_SECURITY_HARDENING.md` — this report

## 2. Authorization checks

The permission model is unchanged. `adminListScope` still decides access the same way as Cash outs:

- A missing or unavailable scope is deny.
- A store or sub session is network scope, and that wins over `requests.manage`.
- A Super Admin whose scope is platform, and a staff account with `requests.manage` that is not a store or sub, still receive the full list.
- Every other case is deny.

Both pages call `resolvePayoutReadPlan()` before `loadPayoutOperations` or `loadPayoutOperation`. Deny redirects to `/admin` and does not read `paydora_payout_requests`. A network session first loads up to 1,000 profile ids whose `parent_agent_id` is in that account's parent ids. The payout query then includes those player ids. A store parent id is not used as a payout user id.

An out-of-network detail id returns not found. The detail page no longer loads the payout row and checks the parent afterward.

## 3. Security improvements

- A failed network profile lookup returns: "The player list for this network could not be loaded. No payout records were opened." The payout table is not queried.
- A network with zero matching players shows "No payout records" and does not query the payout table.
- Neither case falls back to an unrestricted payout query.
- Returned network rows are filtered again to the resolved player ids before they are rendered.
- `destination_key`, `idempotency_key`, `provider_reference_id`, and `provider_withdrawal_id` are not selected.
- Provider references have an empty allowlist. The detail page says "Not shown" and does not render the stored value.
- Provider status is shown only when it is exactly `submitted` or `paid`.
- Hold notes are shown only when they are one of the three sentences written by the payout route: "Risk review", "Above the automatic cash-out limit", and "Automatic cash out is off until a limit is set".
- Method is shown only for `card`, `chime`, `cashapp`, `googlepay`, and `applepay`, using a fixed label.
- Payout status is shown only for the six stored statuses.
- The page still has no retry, refund, or payout button.
- Submitted does not mean paid. Failed does not mean refunded. Manual review requires investigation before any further money action.

## 4. Tests passed

- `node scripts/payout-operations-security.test.mjs` — passed
- `node scripts/payout-operations-ui.test.mjs` — passed
- `node scripts/staff-access.test.mjs` — passed
- `node scripts/payout-reservation.test.mjs` — passed
- `npx tsc --noEmit` — exit 0
- `npx next build` — exit 0

The security test covers deny for an account without `requests.manage`, full-list access for platform staff, store ids limited to the looked-up players, sub-creator ids limited to that sub network, an empty network, a failed lookup, and hidden provider secrets, unapproved notes, and unknown methods.

## 5. Tests failed

None of the checks in section 4 failed.

## 6. Remaining risks

- Payout rows are still read with the service role after the app check, because signed-in users have no select grant on `paydora_payout_requests`. Platform staff with `requests.manage` still see every row. That access was not widened.
- A store or sub network larger than 1,000 players can miss players beyond that lookup. Those records stay hidden. They are not replaced with every payout.
- A provider reference that is a normal payment id is also hidden, because this app does not have a confirmed-safe format for that field.
- Provider statuses other than `submitted` and `paid` are hidden, including a legitimate provider word this code does not write.
- A hold note that is not one of the three approved sentences is hidden.
- Name search inside a network still depends on the profile query staying inside the resolved player ids. The payout query uses that intersection, and rows outside it are dropped before render.

## 7. Unverified behavior

- A signed-in browser session was not used. Redirects, store isolation, and the error state were not clicked through on the site.
- The production site was not deployed.
- No SQL was run, and no live payout row was opened.
- A network larger than 1,000 players was not exercised.
