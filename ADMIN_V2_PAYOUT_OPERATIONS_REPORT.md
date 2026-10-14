# Admin v2 payout operations report

Date: 13 October 2026. This phase adds a read-only payout activity page and removes duplicate dashboard counts. Wallet balances, payout reservations, payment API routes, refund logic, Paydora, NOWPayments, migrations, SQL functions, row security, authentication, and staff permissions were not edited. Nothing was deployed, committed, or written to the database. No payment was sent.

## 1. Existing payout schema

Table: `public.paydora_payout_requests`, created in `supabase/migrations/20261011000270_paydora_payout_reservation.sql`.

| Column | Type | Shown on the new page |
| --- | --- | --- |
| `id` | UUID primary key | Yes |
| `user_id` | UUID, references `auth.users` | Yes, as the player name and email from `profiles` |
| `amount` | NUMERIC(12,2), must be greater than 0 | Yes |
| `method` | TEXT | Yes, on the detail view |
| `destination_key` | TEXT, hash of the destination | No |
| `idempotency_key` | TEXT, unique | No |
| `status` | TEXT | Yes |
| `provider_withdrawal_id` | TEXT, nullable | Yes, after a secret-pattern check |
| `provider_reference_id` | TEXT, nullable | Yes, after a secret-pattern check |
| `provider_status` | TEXT, nullable | Yes, after a secret-pattern check |
| `hold_reason` | TEXT, nullable | Yes, as the note, after a secret-pattern check |
| `provider_attempt_at` | TIMESTAMPTZ, nullable | No |
| `created_at` | TIMESTAMPTZ | Yes |
| `updated_at` | TIMESTAMPTZ | Yes |

The status check allows only `requested`, `reserved`, `submitted`, `paid`, `failed`, and `manual_review`. The page filters use that same list.

## 2. Data source

The list and detail views read `paydora_payout_requests` through the existing service-role admin client. The select list is `id, user_id, amount, method, status, provider_withdrawal_id, provider_reference_id, provider_status, hold_reason, created_at, updated_at`.

Player names come from `profiles` for the user ids already on those payout rows. A store or sub list first loads up to 1,000 profiles whose `parent_agent_id` is in that account's parent ids, then keeps only payout rows for those players.

Search matches a payout id when the text is a UUID, or a player email or full name. Status filters use the six stored statuses. The list is 20 rows per page, ordered by `updated_at` descending.

`destination_key` and `idempotency_key` are not selected. Notes and provider fields are dropped when the text matches a live-key, API-key, bearer, secret, or password pattern, and remaining text is limited to 180 characters.

## 3. Authorization model

Row security is enabled. `PUBLIC`, `anon`, and `authenticated` have no table privileges. `service_role` has the table grant. The reservation functions stay `service_role` only. No policy, grant, or permission key was added.

The page uses the same `adminListScope` decision as `/admin/payouts`:

- A missing or unavailable scope redirects to `/admin`.
- A store or sub session sees only players whose parent is in that network. This wins over a staff permission.
- A Super Admin whose scope is platform sees every payout row.
- A staff account that is confirmed not to be a store or sub, and that has `requests.manage`, sees every payout row.
- Any other case redirects to `/admin`.

The menu item also requires `requests.manage`. Hiding the menu is not the access check. Both the list page and the detail page call `adminListScope` and redirect when the decision is deny. A store or sub detail view loads the player's `parent_agent_id` and returns not found when that parent is outside the network. An unknown id and an out-of-scope id both return not found.

The Financial center card for this page is on the platform tool list. Store and sub tool lists were left as deposits and failed loads.

## 4. New UI functionality

`/admin/payout-operations` shows the request id, player, amount, status badge, created time, and last update. Search, the six status filters, pagination, an empty state, and an error state are on the list.

`/admin/payout-operations/[id]` shows the same fields plus method, provider reference, provider withdrawal id, provider status, and the stored note. It also links to the existing player profile. There is a loading skeleton.

Plain-language status text:

- Requested: the request is saved. A provider payment is not confirmed.
- Reserved: the request is reserved. A provider payment is not confirmed.
- Submitted: sent to the provider. The final outcome is not confirmed yet.
- Paid: the provider payment is confirmed.
- Manual review: a person needs to investigate this before any further money action.
- Failed: the system recorded a failure. A failed status does not by itself show that a refund was posted.

The page has no retry, refund, mark-paid, or balance-adjustment control.

Dashboard cleanup left the existing counts in one place. The top row keeps deposits completed today, cash-out debits today, and players seen today. Held cash outs, new identity checks, and failed game loads stay in the attention row. The failed-webhook count stays on the Super Admin system-health line. The second copy of that webhook count was removed from the attention row. The remaining metric queries were not rewritten.

## 5. Files changed

- `src/lib/admin/payout-operations.ts` — read-only loader and status explanations
- `src/app/admin/payout-operations/page.tsx` — list, search, filters, pagination
- `src/app/admin/payout-operations/loading.tsx` — loading state
- `src/app/admin/payout-operations/[id]/page.tsx` — detail view
- `src/lib/admin/nav.ts` — Payout activity menu item
- `src/app/admin/money/page.tsx` — platform link to the read-only page
- `src/components/admin/ui/admin-status-badge.tsx` — requested, reserved, and manual review tones
- `src/app/admin/page.tsx` — duplicate dashboard counts removed
- `scripts/payout-operations-ui.test.mjs` — source and navigation checks
- `ADMIN_V2_PAYOUT_OPERATIONS_REPORT.md` — this report

## 6. Tests passed

- `npx tsc --noEmit` — exit 0
- `node scripts/payout-operations-ui.test.mjs` — passed
- `node scripts/payout-reservation.test.mjs` — passed
- `node scripts/staff-access.test.mjs` — passed
- `node scripts/admin-nav-v2.test.mjs` — passed
- `npx next build` — exit 0

The payout UI test checks that both pages call `adminListScope` and redirect to `/admin`, that the select list omits `destination_key` and `idempotency_key`, that the pages do not call payout, reserve, or fail functions, and that a manager with `cms.manage` and `analytics.read` does not receive the menu item. A staff account with `requests.manage` does.

## 7. Tests failed

None of the checks in section 6 failed.

## 8. Unverified behavior

- Signed-in browser use of the list, filters, detail view, and redirect is not verified. A live session was not opened.
- The production site was not deployed, so `https://www.sweeptakehub.com` does not include this page.
- No SQL was run. The live row count and the live `debit_paydora_payout` function body were not read.
- A store network larger than 1,000 players was not exercised. The list uses the first 1,000 matching profiles. The detail view checks that one player's parent directly.

## 9. Remaining security concerns

- The new page reads with the service role after the app-level scope check, because authenticated users have no select grant on `paydora_payout_requests`. That matches the existing reservation design. A bug in the scope check would be able to read rows the signed-in role should not see. The page fails closed when the scope is missing, and an empty network filter uses an unmatched id so it does not return every row.
- If the network profile lookup fails, the list becomes empty instead of showing an error. It does not fall open to every payout.
- Provider reference fields are displayed when they do not match the secret-pattern check. A provider value that hides a credential in an unexpected format would still be shown, truncated to 180 characters.
- `hold_reason` is shown when it passes that same check. The payout route writes short operational sentences such as risk review and automatic cash-out limit text.
- Staff with `requests.manage` who are not a store or sub can see every payout row. That is the existing cash-out page rule. It was not widened, and it was not narrowed.
- A failed payout record still does not, by itself, prove that a refund was posted. This page does not add a refund or retry action.
