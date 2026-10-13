# Cashoutanytime audit

Date: 13 October 2026  
Scope: read-only review of the code in this project, plus the local test scripts that only read files.  
Not done: no code changes, no database changes, no production queries, no payments, no emails, no SMS, and no secrets printed.

This report is written so the owner can read the summary. Each finding below also has the file, the severity, and what a developer should do.

## How to read the results

- **Confirmed bug.** The code itself shows the problem. A developer can see it without opening the live database.
- **Possible risk.** The code can go wrong if a setting, a SQL file, or a live key is missing. This audit did not open the live database, so those items are listed as checks, not as proven live failures.

## Plain-English summary

Deposits are protected against paying the same Paydora payment twice. Cash-out requests from a player are tied to the person who is signed in, and they require an approved ID. The admin area asks for a staff login.

Three problems should be fixed or checked before you treat the site as finished:

1. If a game load sits unfinished for about two minutes, the site can mark it failed and keep the money that was already taken from the player’s wallet.
2. The spam limits in the app do not match the database function, so a burst of deposit or login attempts is not reliably stopped by this app.
3. Cash outs, marketing email, and the newsletter page depend on SQL and keys that must be confirmed in Supabase and Vercel. This audit did not re-open those live settings.

## What is in good shape

- A Paydora deposit webhook is rejected when the signature is wrong, and it is rejected when the webhook secret is missing. File: `src/app/api/payments/paydora/webhook/route.ts`.
- The same Paydora payment id is stored once. A second credit for that id is treated as a duplicate. File: `supabase/migrations/20261004000100_paydora_security_hardening.sql`.
- A player cash-out uses the signed-in user, checks the ID status, and asks the database to reserve the money before Paydora is called. File: `src/app/api/payments/paydora/payout/route.ts`.
- A game load uses the signed-in player and that player’s own game username. It does not trust a user id sent in the request body. File: `src/lib/actions/game-loads.ts`.
- Direct edits to wallet columns from a normal save are put back by `protect_wallet_columns`. File: `supabase/migrations/20260720000500_redeem_kyc_wallet_trigger.sql`.
- Scheduled routes refuse to run when `CRON_SECRET` is missing. File: `src/lib/cron/auth.ts`.
- A scheduled email is skipped unless that person still has email notices turned on. File: `src/lib/email/newsletter-consent.ts`.
- Offer email and SMS are sent only when `email_promotions` or `sms_marketing` is exactly on. File: `src/lib/offers/send.ts`.
- Admin pages go through `requireStaff()`. A fake visit is not enough. File: `src/components/admin/admin-layout-gate.tsx`.
- Store creators and sub-creators are not treated as global staff by `is_staff()`, so the normal database rule does not let them read every player. File: `supabase/migrations/20261004000100_paydora_security_hardening.sql`.

---

## Confirmed bugs

### 1. A timed-out game load can keep the player’s money

- **Severity:** Critical
- **Kind:** Confirmed bug
- **File:** `src/lib/actions/game-loads.ts` (`clearStaleRequests`, about lines 155–169)
- **Also see:** `supabase/migrations/20261008000160_financial_trust.sql` (`request_game_load` deducts the wallet when the request is created) and `supabase/migrations/20261008000200_refund_load_and_reload.sql` (`refund_game_load_wallet` is the safe refund)
- **Problem:** Creating a load takes the money out of the wallet immediately. If that load is still pending after two minutes, `clearStaleRequests` marks the row failed with a normal table update. That update does not call `refund_game_load_wallet`. The proper timeout function, `fail_stale_game_loads`, does call the refund. This shortcut skips it.
- **Evidence:** `request_game_load` runs `UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount` before the row is inserted. `clearStaleRequests` then sets `status: "failed"` with the service-role client. `refund_game_load_wallet` returns the money only when the game provider was not already paid (`game_api_debited` is false) and the row was not already refunded.
- **How to reproduce safely:** On a disposable database, create a load for a test player, do not complete it, wait two minutes, start another load for the same game, and compare the wallet before and after. Do not do this on a real player.
- **Recommended solution:** Mark the old row failed by calling `refund_game_load_wallet` first, or by calling `fail_stale_game_loads`. Do not set `failed` with a plain update for a load that already took wallet money.
- **Risk of changing the code:** Calling the refund twice is safe only because the refund function stops when `wallet_refunded` is already true. Calling it after the game provider was paid (`game_api_debited` is true) is also refused by that function. A wrong handmade credit could pay the player twice.

### 2. The app’s spam limit does not match the database function

- **Severity:** High
- **Kind:** Confirmed bug
- **Files:** `src/lib/rate-limit.ts`; `supabase/migrations/20261011000260_anti_spam_multi_account.sql`
- **Problem:** The app calls `check_rate_limit` with `p_bucket`, `p_max_hits`, and `p_window_seconds`, and it expects `true` or `false`. The SQL function is named with `p_bucket_key`, `p_action`, `p_max_attempts`, `p_window_seconds`, and `p_block_seconds`, and it returns a JSON object. When that call fails, deposits, login codes, and cash-out attempts are allowed through. Only game loads and broadcasts stay blocked when the limiter is down.
- **Evidence:** `FAIL_CLOSED_ACTIONS` contains only `gameLoad` and `broadcast`. The comment in `rate-limit.ts` says deposits stay open when the limiter function is missing.
- **How to reproduce safely:** On a disposable database, call the app limiter and the SQL function with the same arguments the app sends. The SQL call should error. Then try several deposit checkouts in one minute. Do not use a real card.
- **Recommended solution:** Call the SQL function with the argument names and the action type it expects, and treat the JSON `allowed` field as the answer. Keep deposits blocked when the limiter cannot be checked, or document a Paydora-side limit that you accept instead.
- **Risk of changing the code:** A too-strict limiter can block real players from paying. Test the new call on a disposable database before production.

### 3. A staff member with the money permission can pay any player’s cash-out

- **Severity:** High
- **Kind:** Confirmed bug
- **File:** `src/lib/actions/admin/payouts.ts` (`payoutCashout`)
- **Problem:** The action checks `requests.manage` and then pays whatever player id is in the form. It does not check that the player belongs to that staff member. The database call uses the service role, so the database does not apply a store boundary either.
- **Evidence:** The seed grants `requests.manage` to `super_admin` and `admin` only (`supabase/migrations/20260614000020_games_requests.sql`). Store creators and sub-creators are not in that grant. Anyone who later receives the admin role can pay any player.
- **How to reproduce safely:** On a disposable database, sign in as a test admin who is not the owner of a test player, and submit the payout form with that player’s id and a one-cent amount. Confirm the cash-out balance moves. Do not do this on live players.
- **Recommended solution:** For a store or sub-creator, refuse the payout unless `playerInScope` is true. For platform admins, keep a second confirmation and the existing audit row.
- **Risk of changing the code:** A too-narrow check can stop the owner from paying a real cash-out. The SQL function `admin_payout_cashout` still has to be the only place that changes the balance.

### 4. ID photos are saved as a long text field

- **Severity:** High
- **Kind:** Confirmed bug
- **File:** `src/lib/actions/kyc-actions.ts` (`submitKYCDocument`)
- **Problem:** The uploaded ID is saved in `kyc_submissions.document_url` as the raw data from the browser. There is no size limit and no file-type check in this function. The profile only stores the file name, which is better, but the full image still sits in the table.
- **Evidence:** `document_url: docDataUrl` is written with the service role. Row security lets a player read only their own row (`user_id = auth.uid()`). Other players cannot read it through the normal rules. Staff using the service role can read every row. Database backups will contain the photos.
- **How to reproduce safely:** Submit a tiny test image on a disposable account and read that one row. Do not download or copy a real player’s ID.
- **Recommended solution:** Store the file in a private Storage bucket, save only the path, and show admins a short-lived signed link. Reject files over a set size and accept only JPEG, PNG, and PDF.
- **Risk of changing the code:** Existing rows still contain the old text. A migration must keep those photos readable until they are moved. A public bucket would make the problem worse.

### 5. Only one background job is scheduled

- **Severity:** Medium
- **Kind:** Confirmed bug in the deploy config
- **File:** `vercel.json`
- **Problem:** The only Vercel schedule is `/api/cron/seo-index` once a day. These routes exist and are protected by `CRON_SECRET`, but they are not on that schedule: newsletter send, Telegram promo, Telegram auto-post, AI blog, AI self-check, and auto-post.
- **Evidence:** `vercel.json` has one cron. Each route calls `verifyCronRequest` and returns 503 when the secret is missing.
- **How to reproduce safely:** Open the Vercel project’s cron list and compare it with `src/app/api/cron`. Do not trigger a route.
- **Recommended solution:** Add a schedule only for the jobs you want to run. Leave the others unscheduled until the matching provider key is set.
- **Risk of changing the code:** Turning on the AI blog or Telegram cron will publish posts and channel messages. Do that only after you want those messages to go out.

### 6. AI blog and Telegram switches start out on

- **Severity:** Medium
- **Kind:** Confirmed in the SQL defaults
- **File:** `supabase/migrations/20260720000300_kyc_and_ai_system.sql`
- **Problem:** New setting rows default to `is_enabled = true`, `auto_publish = true`, `auto_telegram_broadcast = true`, and `autopilot_enabled = true`. They do not run by themselves while they are missing from `vercel.json`. An outside scheduler that already calls those routes would publish.
- **How to reproduce safely:** Read the setting row on a disposable database. Do not click Test Run.
- **Recommended solution:** Default new rows to off. Turn a job on only from the admin screen.
- **Risk of changing the code:** A default of off stops posts you may already expect. Check the live row before changing it.

### 7. The admin database client can fall back to the public key

- **Severity:** Medium
- **Kind:** Confirmed code path
- **File:** `src/lib/supabase/admin.ts`
- **Problem:** If the service-role key is missing, `createAdminClient` uses the public anon key instead. Admin actions would then run with a normal visitor key. Row security would block most writes, but any table without a policy would be exposed to that weaker key.
- **How to reproduce safely:** In a local env file with the service key removed, call an admin page and confirm it fails closed. Do not remove the production key.
- **Recommended solution:** Return null when the service-role key is missing. Do not substitute the anon key.
- **Risk of changing the code:** Local tools that depended on the fallback will start failing. That is the safer failure.

### 8. The reports page and the overview do not invent dollars, but there is no error tracker

- **Severity:** Medium
- **Kind:** Confirmed gap
- **Files:** `src/app/admin/analytics/page.tsx`; `src/lib/actions/admin/core.ts` (`writeAudit`)
- **Problem:** There is no Sentry or similar error service in the app. Failures are written with `console.error`. If the audit log insert fails, the money change still finishes and the missed audit row is ignored.
- **How to reproduce safely:** Search the repo for `Sentry`. It is not wired up. Read `writeAudit`: the `catch` block is empty.
- **Recommended solution:** Send payment, wallet, and webhook errors to one log you can open without SSH. Keep the audit insert, and record when it fails.
- **Risk of changing the code:** A log tool that records request bodies can store card or ID data. Log the event name and the id only.

### 9. The local money test fails, and the next checks in that file are also out of date

- **Severity:** Low for the test, High as a pointer at bug 1
- **Kind:** Confirmed test failure
- **File:** `scripts/auto-money.test.mjs` line 58
- **Problem:** The test requires `src/lib/actions/game-loads.ts` not to contain `status: "failed"`. The file does contain that text, in `clearStaleRequests` and again when a stuck account request is replaced. The test stops there. The same file also requires the admin menu not to link `/admin/requests` or `/admin/failed-loads`. The current menu links both, so those checks would fail next.
- **Evidence:** Test run on 13 October 2026. Exit code 1. Message: `true !== false` at line 58. Fourteen other local scripts passed. Details are in `TEST_RESULTS.md`.
- **Recommended solution:** After bug 1 is fixed, update the test so a refunding failure path is allowed, and so the current menu links are allowed.
- **Risk of changing the code:** Weakening the test without fixing the refund would hide the money bug.

---

## Possible risks (not re-checked on the live database)

### 10. Player cash outs stay off until one SQL file is applied

- **Severity:** High if the file was never run
- **Kind:** Possible risk
- **Files:** `src/app/api/payments/paydora/payout/route.ts`; `supabase/migrations/20261011000270_paydora_payout_reservation.sql`
- **Problem:** The cash-out route calls `reserve_paydora_payout`. If that function is not in the live database, the route returns an error and does not pay. That is a safe failure, and it also means players cannot cash out.
- **How to check safely:** In the Supabase SQL editor, ask whether the function exists. Do not run the file again if it is already there.
- **Recommended solution:** Apply that file once if the function is missing. Then try a one-dollar cash-out on a test account.
- **Risk of changing the code:** Re-running a non-idempotent part of the file can error or change payout rules. Read the file before pasting it.

### 11. Marketing email fails closed when the Resend key is missing

- **Severity:** High for email launch
- **Kind:** Confirmed in code. The live key was not opened in this audit.
- **Files:** `src/lib/email/newsletter-batch.ts` (the send path sets the campaign failed when `RESEND_API_KEY` is missing)
- **Problem:** A campaign cannot leave the building without that key. A previous campaign was reported as failed with the text that the key is not configured. This audit did not read Vercel’s secret list.
- **How to check safely:** In Vercel, confirm the name `RESEND_API_KEY` is set for Production. Do not copy the value into chat. Send one test to a staff inbox only.
- **Recommended solution:** Add the key and a from-address on a domain Resend has verified. Put the failed 77-person campaign back to draft only after that, and only if you still want it sent.
- **Risk of changing the code:** None, if you only add the key. Resetting the old campaign without the key will fail again.

### 12. The newsletter tables may still be missing a permission grant

- **Severity:** Medium
- **Kind:** Possible risk
- **File:** `supabase/migrations/20261012000120_newsletter_tables.sql`
- **Problem:** The file ends with grants for `service_role` on the two newsletter tables. If those two lines were not run, the newsletters page cannot read the tables and shows a setup error.
- **How to check safely:** Open the newsletters page while signed in as Super Admin. If it loads campaigns, the grant is in place.
- **Recommended solution:** Run only the two `GRANT` lines if the page still complains.
- **Risk of changing the code:** Re-running the whole file is unnecessary if the tables already exist. The grants themselves are safe to repeat.

### 13. Signup codes may still be 8 digits in Supabase

- **Severity:** Medium
- **Kind:** Possible risk
- **File:** the signup form expects 6 digits
- **Problem:** The site form accepts a 6-digit code. The hosted Supabase email setting is a dashboard value, not a file in this repo. If the dashboard still says 8, players will get a code the form rejects.
- **How to check safely:** Supabase Dashboard → Authentication → Email → OTP length. Set it to 6 if it is 8. Use a test inbox.
- **Risk of changing the code:** Changing only the form to 8 digits would disagree with the email template you wanted at 6.

### 14. Page blocking does not cover every API

- **Severity:** Medium
- **Kind:** Confirmed for the middleware matcher. Payment routes have their own check.
- **Files:** `src/middleware.ts`; `src/lib/compliance/restricted-state.ts`
- **Problem:** Pages in Washington, Idaho, Nevada, and Michigan are redirected to `/restricted`. The middleware skips paths that start with `/api`. Deposit and cash-out APIs repeat the state check. Chat and other APIs do not. State codes are not trimmed, so `WA, ID` with a space would not match `ID`.
- **How to reproduce safely:** Compare response codes for `/api/chat/live-bot` and `/api/payments/paydora/create` with a test header. Do not use this to bypass a real legal restriction.
- **Recommended solution:** Use the same state check on every money and account API. Trim and uppercase the state list.
- **Risk of changing the code:** A header the host does not overwrite could be spoofed. Keep using Vercel’s `x-vercel-ip-country` headers, which the host sets.

### 15. The public WhatsApp link can still be a placeholder

- **Severity:** Low
- **Kind:** Confirmed fallback
- **File:** `src/lib/constants.ts`
- **Problem:** If `NEXT_PUBLIC_WHATSAPP_URL` is empty, the public link is `https://wa.me/1234567890`.
- **Recommended solution:** Set the real business link in Vercel, or hide the button when it is empty.
- **Risk of changing the code:** Low. Do not invent a second sender.

### 16. The games screen shows a webhook address that has no route

- **Severity:** Low
- **Kind:** Confirmed missing route
- **File:** `src/app/admin/games/page.tsx` builds `/api/webhooks/game/<slug>`. There is no matching file under `src/app/api/webhooks`.
- **Problem:** A game portal that posts to that address gets a 404. It does not move money by itself. Paydora’s real webhook is `/api/payments/paydora/webhook`.
- **Recommended solution:** Remove the displayed URL until a real handler exists, or add a handler that checks a secret and does not credit a wallet by itself.
- **Risk of changing the code:** A new handler that credits a wallet from an unsigned body would be dangerous. Do not add that.

### 17. Support staff can read every profile through the database rules

- **Severity:** Medium
- **Kind:** Confirmed policy, accepted for platform staff
- **File:** `supabase/migrations/20261004000100_paydora_security_hardening.sql`
- **Problem:** `profiles` can be read when the row is yours or when `is_staff()` is true. That includes admin, manager, support, and moderator. It does not include store creator or sub-creator. A support login can therefore read player emails and balances from the database API even on a screen that hides them.
- **Recommended solution:** Leave this if support must look up players. Add an audit row when a support user opens a wallet. Do not give store creators `is_staff()`.
- **Risk of changing the code:** Tightening the policy can blank the admin player list for legitimate staff.

### 18. Two clicks can open two checkouts

- **Severity:** Low
- **Kind:** Confirmed behavior, not a double credit of one payment
- **File:** `src/app/api/payments/paydora/create/route.ts`
- **Problem:** The Paydora idempotency key includes the current time, so two fast clicks become two payment sessions. Each paid session has its own id and can credit once. The same id cannot credit twice.
- **Recommended solution:** Use a key that stays the same for the same player, amount, and game for a few minutes.
- **Risk of changing the code:** A key that never changes can block a second real deposit. Include a time window.

---

## Area-by-area notes

| Area | Result |
| --- | --- |
| 1. Sign-in and session | Admin layout checks staff with `requireStaff`. Google’s return path `/auth/callback` is not treated as an existing session, which was the earlier cookie bug. Cookies for this site use the parent domain `.sweeptakehub.com`. |
| 2. Admin permissions | Each admin action calls `authorize` with a named permission. Super Admin passes all of them. Hiding a menu link is not the security check. |
| 3. Store and sub-creator | Deposit lists use `getAgentScope` and `adminListScope`. The manual cash-out action in finding 3 does not. |
| 4. Player isolation | Game loads and player cash outs use the signed-in user. Store creators are outside `is_staff()`. Platform staff can read all profiles. |
| 5. Deposits | Signature, saved payment intent, and a one-time payment id are in place. Spam limiting is finding 2. |
| 6. Withdrawals | Player route reserves money first. It fails closed if the SQL function is missing. Admin payout is finding 3. |
| 7. Refunds | Deposit reversal uses the saved ledger user, not a random id from the webhook. Game-load timeout refund is finding 1. |
| 8. Wallet | Balance changes are supposed to go through SQL functions. The protect trigger puts back casual edits. |
| 9. Game loads | Username must belong to the signed-in player. Timeout handling is finding 1. |
| 10. Payment webhooks | Paydora webhook checks the signature. The game webhook URL is finding 16. |
| 11. Duplicate payments | `paydora_processed_events.payment_id` is the primary key. |
| 12. KYC | Own-row read rule is present. Storage shape is finding 4. |
| 13. Geography | Pages and Paydora routes check WA, ID, NV, and MI. Other APIs are finding 14. |
| 14. Email and SMS consent | Newsletter and offers check the consent flags at send time. SMS still needs Twilio and `sms_marketing`. |
| 15. Telegram | Channel posts require a staff permission or a cron secret. They are not on the Vercel schedule. |
| 16. AI blog | The route checks a saved on/off setting. The schedule and the default-on row are findings 5 and 6. |
| 17. Cron | Only the SEO job is scheduled. Secret missing means 503. |
| 18. Migrations | Files exist under `supabase/migrations`. This audit did not apply any. Cash-out and newsletter grants are findings 10 and 12. |
| 19. Row security | Profiles, KYC, newsletter tables, and AI setting tables have row security. AI setting tables have no extra allow-policy, so normal visitors cannot read them. |
| 20. Logging | `console.error` only. Audit failures are swallowed. Finding 8. |
| 21. Rate limits | Finding 2. |
| 22. Environment | Names live in `.env.example`. Values were not printed. Resend, cron, Paydora, Twilio, and Telegram must be set in Vercel for those features to work. |
| 23. Production deploy | The production site is `https://www.sweeptakehub.com`. Deploy with the existing Vercel project. `vercel.json` schedules SEO only. |

## Launch blockers

These items should be settled before you call the product finished. They are repeated in `LAUNCH_CHECKLIST.md`.

1. Fix timed-out game loads so wallet money is returned when the game was not paid (confirmed bug 1).
2. Make the spam limiter call the real database function (confirmed bug 2).
3. Confirm the cash-out SQL function exists, then test one cash-out on a staff account (risk 10).
4. Confirm `RESEND_API_KEY` in Vercel and send one staff test email before any player campaign (risk 11).
5. Confirm the newsletter page loads. If it does not, run the two service-role grants (risk 12).
6. Decide who may use the manual cash-out button, and limit it to players that person is allowed to see (confirmed bug 3).
7. Stop storing full ID photos as text in the table before you collect more IDs (confirmed bug 4).
8. Leave AI blog, Telegram, and newsletter crons off until you explicitly want them to send (findings 5 and 6).
