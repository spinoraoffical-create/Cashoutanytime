# Fix report

Date: 13 October 2026. These changes are local. They were not pushed and not deployed. No production SQL was run. No payment, SMS, email, or Telegram message was sent.

## 1. Game-load timeout marked failed without a refund

- **Problem:** `clearStaleRequests` set a pending load to failed after two minutes and did not call `refund_game_load_wallet`. The wallet stayed debited, and a new load could start.
- **Evidence:** The function in `src/lib/actions/game-loads.ts` updated `status: "failed"` for `pending` and `processing` rows older than two minutes. `request_game_load` debits the wallet when the row is created. `refund_game_load_wallet` returns immediately when `wallet_refunded` or `game_api_debited` is already true.
- **Files changed:** `src/lib/actions/game-loads.ts`, `src/components/games/game-wallet-load-section.tsx`, `src/lib/game-automation/load-outcome.ts`, provider service catch blocks, `src/lib/game-automation/firekirin-service.ts`.
- **Solution:** The two-minute update is gone. A provider timeout or network error no longer refunds and no longer marks the row failed. The row stays pending with a review note and an incident id. A confirmed provider rejection can still refund once. A successful load is not refunded. A second refund is refused when `wallet_refunded` is already true.
- **Tests:** `node scripts/game-load-outcome.test.mjs` passed. `node scripts/financial-trust.test.mjs` passed.
- **Result:** CONFIRMED FIXED in application code for the two-minute path and the provider catch paths.
- **Remaining:** The database function `fail_stale_game_loads` still refunds and marks rows failed. `request_game_account_create` still calls it. That needs `supabase/migrations/20261013000130_hold_unknown_game_loads.sql`. REQUIRES OWNER APPROVAL. It was not applied. A player cancel of a pending load still refunds through `cancel_my_game_load`. That is unsafe when the provider result is unknown.

## 2. Rate limiter called the wrong database arguments

- **Problem:** The app sent `p_bucket`, `p_max_hits`, and expected `true` or `false`. The SQL function expects `p_bucket_key`, `p_action`, `p_max_attempts`, `p_window_seconds`, `p_block_seconds` and returns JSON. On that error, deposits and cash outs were allowed through.
- **Evidence:** `src/lib/rate-limit.ts` before the change, and `check_rate_limit` in `supabase/migrations/20261011000260_anti_spam_multi_account.sql`.
- **Files changed:** `src/lib/rate-limit.ts`, `src/lib/rate-limit-decision.ts`.
- **Solution:** The call uses the SQL argument names. `allowed` is read from the JSON. Any database error blocks the request.
- **Tests:** `node scripts/rate-limit.test.mjs` passed. The live database function was not called.
- **Result:** CONFIRMED FIXED in source. REQUIRES PRODUCTION VERIFICATION that `check_rate_limit` is the version from migration `20261011000260`. If that function is missing, deposits and cash outs now stop instead of going through.

## 3. Manual cash-out was not limited to a store's players

- **Problem:** `payoutCashout` checked `requests.manage` and then paid any player id.
- **Evidence:** `src/lib/actions/admin/payouts.ts` called `admin_payout_cashout` with no scope check.
- **Files changed:** `src/lib/actions/admin/payouts.ts`.
- **Solution:** It uses the same scope decision as the other admin lists. A store or sub-creator can pay only a player in that network. A missing scope denies the payout. A platform Super Admin can still pay players they are allowed to manage.
- **Tests:** `node scripts/admin-list-scope.test.mjs` passed. No signed-in store account was used.
- **Result:** CONFIRMED FIXED in source. REQUIRES PRODUCTION VERIFICATION with a store login.

## 4. New ID photos were saved as text

- **Problem:** `submitKYCDocument` stored the browser data URL in `kyc_submissions.document_url` with no size or type check.
- **Evidence:** `src/lib/actions/kyc-actions.ts` assigned `document_url: docDataUrl`.
- **Files changed:** `src/lib/actions/kyc-actions.ts`, `src/lib/kyc/upload-rules.ts`, `supabase/migrations/20261013000140_kyc_private_bucket.sql`.
- **Solution:** New uploads must be JPEG, PNG, WebP, or PDF, and at most 5 MB. The file is uploaded to the private `kyc-documents` bucket. The row stores the path. Reviewers receive a link that expires in 120 seconds. The photo is not written to the log. Old rows are not deleted. If the bucket does not exist, the upload is refused and nothing is saved as text.
- **Tests:** `node scripts/kyc-upload.test.mjs` passed. The bucket was not created.
- **Result:** CONFIRMED FIXED for new uploads in source. REQUIRES OWNER APPROVAL to run the bucket migration. Until then, new ID uploads fail with a storage message. Old photos remain in the table.

## 5. Deposit status could be read without proving ownership

- **Problem:** If Paydora omitted `userName`, the status route returned amount and status to any signed-in player.
- **Evidence:** `src/app/api/payments/paydora/status/route.ts` only rejected a mismatched `userName`.
- **Files changed:** `src/app/api/payments/paydora/status/route.ts`, `src/lib/payments/deposit-access.ts`.
- **Solution:** The route returns the deposit only when the Paydora user or the saved payment intent belongs to the signed-in player. A missing owner is a 404. The route still does not credit a wallet.
- **Tests:** `node scripts/deposit-access.test.mjs` passed. Paydora was not called.
- **Result:** CONFIRMED FIXED in source.

## Checked and not changed

- **NOWPayments:** NOT REPRODUCED. There is no NOWPayments code in `src`.
- **Paydora payout unknown status:** The payout route already refuses to fail a payout when the provider outcome is not a clear rejection. `scripts/payout-reservation.test.mjs` passed. No payout was sent.
- **Duplicate deposit credit:** `paydora_processed_events.payment_id` is still the primary key. NOT TESTED against a live webhook.
- **Newsletter, Telegram, AI blog schedules:** Still only the daily SEO job is in `vercel.json`. No new cron was added. No message was sent.
- **Wallet formulas:** Not rewritten.

## Monitoring

Failed rate-limit checks, unknown game loads, and KYC storage errors write a short `inc_...` id to the server log. The id does not include passwords, keys, document bytes, or payment credentials. There is still no pager. An admin has to read the host logs or the Automation page.
