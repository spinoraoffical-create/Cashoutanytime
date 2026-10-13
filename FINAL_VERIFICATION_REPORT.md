# Final verification report

Date: 13 October 2026. Starting point: `c849bc81ad7e04e20bae20bf5564ff723c133e6a`.

No production SQL was run. No payout was sent. Nothing was deployed or pushed. Wallet formulas were not changed.

## Confirmed findings

### Wallet page and the auto-money test

The wallet page is the intended add-money screen. Commit `e206862` put the Paydora form on that page so the Add money button opens it there. `/dashboard/deposit` still uses the same form as a full page.

`DepositPageClient` has an `embedded` mode. The wallet page renders `<DepositPageClient embedded games={games} />` inside the section `id="add-money"`. In that mode the form does not draw its own page heading. The deposit route renders `<DepositPageClient games={games} />` and keeps the heading.

The old test required the wallet file to omit `DepositPageClient`. That check described an older page. The application is the current design, so the test now checks the embedded wallet form, the full deposit page, and the embedded heading rule.

The same test also required the admin menu to omit `/admin/requests` and `/admin/failed-loads`. The control center includes both tools, each gated by `requests.manage`. The test now requires those links and that permission. Removing the permission fails the test.

### Cash-out debit in source

The latest definition is `debit_paydora_payout` in `supabase/migrations/20261008000190_auto_money.sql`.

- It subtracts `cashout_wallet` only when `cashout_wallet >=` the amount.
- It does not mention `wallet_balance`.
- It inserts `paydora_processed_events` with `payment_id` set to the payout key before the balance changes. `payment_id` is the primary key from `20261004000100_paydora_security_hardening.sql`.
- A second debit of the same key hits `unique_violation` and returns `debited: false, duplicate: true`. That exception rolls back the balance change inside the function.
- It writes a `wallet_transactions` row with wallet type `cashout`, type `debit`, and source `withdrawal`.
- A key starting with `refund:` is rejected.
- Execute is revoked from `PUBLIC`, `anon`, and `authenticated`, and granted to `service_role`.

An older copy in `20261004000100_paydora_security_hardening.sql` subtracts `wallet_balance` and records wallet type `current`. Later reservation SQL calls `debit_paydora_payout` and does not replace it. The later file is the one the app expects.

The live function text was **NOT VERIFIED**. This run did not call the function. A read of the public API catalog returned HTTP 401, so the live function names were not reconfirmed either.

### KYC storage

Source behavior:

- New uploads require a signed-in player, then `checkKycDataUrl` allows only JPEG, PNG, WebP, and PDF, up to 5 MB.
- The file is stored in the private bucket `kyc-documents` at `{player id}/{random id}.{ext}`. The row stores that path. The photo is not stored in the table.
- If the bucket upload fails, the action stops and does not save a data URL.
- Players can read their own `kyc_submissions` row. Direct insert by a signed-in player is denied (`WITH CHECK (false)`). There is no player update or delete policy, so those actions are denied.
- Download uses a 120-second signed URL, and only after `authorize("kyc.manage")`. The code does not call `getPublicUrl` for these files.
- The admin page uses `requirePermission("kyc.manage")`. Approving or rejecting uses the same permission before any write.
- `kyc.manage` is not in the role seed. Super Admin passes because super-admin checks skip the named permission. A normal admin does not have `kyc.manage`.

The Identity check menu item used `cms.manage`, so content staff could see a link the page then refused. The menu item now uses `kyc.manage`, matching the page and the review actions. Super Admin still sees it.

Live bucket check on `muetgtzcbecsqigtpfyn.supabase.co`:

- Service read: HTTP 200, `public` false, size limit 5242880, mime types JPEG, PNG, WebP, and PDF.
- Anonymous bucket read: HTTP 400, message `Bucket not found`.
- Anonymous public object URL: HTTP 400, message `Bucket not found`.

Live `storage.objects` policies and live `kyc_submissions` policies were **NOT VERIFIED**. No customer files were listed.

## Files changed

- `scripts/auto-money.test.mjs` — wallet embed, deposit page, debit-function, and admin-menu checks.
- `scripts/kyc-upload.test.mjs` — upload path, signed URL, permission, bucket, and row-security checks.
- `src/lib/admin/nav.ts` — Identity check requires `kyc.manage`.
- `FINAL_VERIFICATION_REPORT.md` — this report.

No migration was added.

## Tests passed

All of these exited 0:

- `scripts/auto-money.test.mjs`
- `scripts/kyc-upload.test.mjs`
- `scripts/payout-reservation.test.mjs`
- `scripts/financial-trust.test.mjs`
- `scripts/deposit-access.test.mjs`
- `scripts/staff-access.test.mjs`
- `scripts/rate-limit.test.mjs`
- `scripts/game-load-outcome.test.mjs`
- `scripts/deposit-automation.test.mjs`
- `scripts/newsletter-consent.test.mjs`
- `scripts/blog-links.test.mjs`
- `scripts/offers.test.mjs`
- `scripts/chat-thread.test.mjs`
- `scripts/live-game-balances.test.mjs`
- `scripts/whole-coin.test.mjs`
- `scripts/player-transactions.test.mjs`
- `scripts/restricted-state.test.mjs`
- `scripts/admin-list-scope.test.mjs`
- `scripts/firekirin-api.test.mjs`
- `scripts/automation-health.test.mjs`
- `npx tsc --noEmit`
- `npx next build` (existing image and hook warnings, exit 0)

## Tests failed

None in this run.

## Remaining launch blockers

1. The live `debit_paydora_payout` body is **NOT VERIFIED**. Confirm it updates `cashout_wallet`.
2. One small cash-out on a test player is still required. A second click must not pay twice. A timeout must not become a second payment.
3. Live KYC storage policies and submission policies are **NOT VERIFIED**.
4. Confirm that only Super Admin should review ID photos. Regular admins cannot, because `kyc.manage` is not seeded.

**NOT VERIFIED FOR REAL-MONEY PRODUCTION LAUNCH.**

## Required manual verification

Run this read-only query in the Supabase SQL editor. Do not change data.

```sql
SELECT p.proname, p.prosrc
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'debit_paydora_payout';
```

The body should contain `cashout_wallet` and should not contain `wallet_balance`.

Then list policies without changing them:

```sql
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE (schemaname = 'storage' AND tablename = 'objects' AND qual ILIKE '%kyc-documents%')
   OR (schemaname = 'public' AND tablename = 'kyc_submissions')
ORDER BY tablename, policyname;
```

Expected submission policies: a player can select only `user_id = auth.uid()`, and a player insert is denied. There should be no public read policy on `kyc-documents` objects.
