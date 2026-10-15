# Admin 2.0 Phase 3 full audit

Date: 14 October 2026. This is a read-only audit of Cashoutanytime Admin 2.0. No application code was changed. No payment, message, approval, publish, or database write was performed. The only file added is this report.

## Top 10 most important issues

| Rank | ID | Severity | Why it is first | In the production commit `b61e65b` |
| --- | --- | --- | --- | --- |
| 1 | AUD-01 | HIGH | One click marks a cash-out paid and debits the wallet. No second confirmation. | Yes |
| 2 | AUD-02 | HIGH | One click marks a game load completed, failed, or cancelled. | Yes |
| 3 | AUD-03 | HIGH | A store home can hide pending deposits and loads for older players, and a failed count becomes 0. | Yes |
| 4 | AUD-04 | HIGH | A failed ticket query is shown as 0 open tickets. | Yes |
| 5 | AUD-05 | HIGH | Identity approve and reject have no confirmation and write no audit row. | Yes |
| 6 | AUD-06 | HIGH | “Generate & Publish Article Now” can publish a post and send it to Telegram. Defaults favor publishing. | Yes |
| 7 | AUD-07 | HIGH | “Generate All 50 States” publishes city pages on one click. | Yes |
| 8 | AUD-08 | MEDIUM | Offer Send has no second confirmation. Consent and same-day duplicate protection do exist. | Yes |
| 9 | AUD-09 | MEDIUM | The identity page signs every stored ID it loads, including old approvals. Old web addresses are not replaced. | Yes, code path. Live file contents were not queried. |
| 10 | AUD-10 | MEDIUM | “Players seen today” showed Unavailable on the signed-in dashboard. Other counts loaded. | The Unavailable behavior is in the Phase 2F dashboard, which is not on `origin/main`. |

## 1. Executive summary

The purple-and-blue Admin 2.0 screens are largely in place from Phase 2A through the uncommitted Phase 2H work. Navigation, permission gates, and the shared cards are consistent on the pages that were opened. The dashboard labels that were checked match the queries behind them. A failed player-activity count said Unavailable instead of zero.

This branch is **not ready to deploy**. The blocking items are accidental money and publishing actions that already exist on the known production commit, plus financial screens that were not clicked in this audit. Phases 2G and 2H are still uncommitted. Local `main` is not the same commit as `origin/main`.

No confirmed case of an outsider reading an identity file, moving money without a staff check, or sending a campaign was found in this pass. Several one-click staff actions can still debit a wallet, close a game load, publish pages, or send an offer.

## 2. Current branch and commit

- Current branch: `admin-v2-development`
- HEAD: `55a999017407bd70682b7dd25c131c5c0c3c1172`
- HEAD subject: `Admin v2 Phase 2F premium visual polish`
- The branch tracks `origin/admin-v2-development`.
- This audit did not fetch, pull, switch branches, merge, commit, or push.

## 3. Uncommitted Phase 2G and 2H changes

Both phases are still uncommitted on top of `55a9990`. `eng.traineddata` is still untracked and was not staged.

Phase 2G presentation files:

- `src/app/admin/kyc/page.tsx` and `src/app/admin/kyc/loading.tsx`
- `src/app/admin/security/page.tsx` and `src/app/admin/security/loading.tsx`
- `src/app/admin/fraud/page.tsx`, `src/app/admin/fraud/loading.tsx`, and `src/components/admin/admin-fraud-list.tsx`
- `src/app/admin/audit/page.tsx` and `src/app/admin/audit/loading.tsx`
- `src/app/admin/roles/page.tsx` and `src/app/admin/roles/loading.tsx`
- `src/app/admin/settings/page.tsx` and `src/app/admin/settings/loading.tsx`
- `src/components/admin/admin-kyc-review-card.tsx`
- `src/components/admin/settings-editor.tsx`
- `src/components/admin/rewards-toggle.tsx`
- `src/components/admin/telegram-promo-messages.tsx`
- `ADMIN_V2_PHASE2G_REPORT.md`

Phase 2H presentation files:

- `src/app/admin/payments/page.tsx` and `src/app/admin/payments/loading.tsx`
- `src/app/admin/cms/page.tsx` and `src/components/admin/cms-tab-nav.tsx`
- `src/app/admin/reviews/page.tsx`, `src/app/admin/reviews/loading.tsx`, and `src/components/reviews/review-card.tsx`
- `src/app/admin/geo/page.tsx`, `src/app/admin/geo/loading.tsx`, and `src/components/admin/admin-bulk-landing-generator.tsx`
- `src/components/admin/admin-chat-inbox.tsx`
- `src/app/admin/rewards/page.tsx`, `src/app/admin/vip/page.tsx`, `src/app/admin/achievements/page.tsx`, `src/app/admin/leaderboards/page.tsx`, and `src/app/admin/referrals/page.tsx`
- `src/components/admin/ui/admin-status-badge.tsx` (Phase 2G labels plus Phase 2H labels)
- `ADMIN_V2_PHASE2H_REPORT.md`

These edits are presentation. This audit did not find a permission, payment, or wallet-calculation change inside them.

## 4. Complete admin route inventory

Every `page.tsx` under `src/app/admin` is listed with the gate found in that file.

| Route | Gate found in the page |
| --- | --- |
| `/admin` | Store and sub see `AgentHome`. Other staff use `requireStaff`. |
| `/admin/users` | `users.manage` |
| `/admin/users/[id]` | `assertCanSeePlayer` before the profile loads |
| `/admin/players` | `requireAgentScope` |
| `/admin/crm` | List-scope decision. Deny redirects to `/admin`. |
| `/admin/support` and `/admin/support/[id]` | Store and sub redirect to `/admin/agent-inbox`. Tickets require platform ticket access. |
| `/admin/chat` | Store and sub redirect to `/admin/agent-inbox`. Other staff need the chat gate. |
| `/admin/money` | Network sessions pass. Others need `requests.manage`. |
| `/admin/deposits` and `/admin/requests` | Requests redirects to deposits. Deposits deny redirects to `/admin`. |
| `/admin/game-loads` and `/admin/failed-loads` | Failed loads redirects to the failed filter. Platform or network scope required. |
| `/admin/payouts` | Deny redirects to `/admin`. |
| `/admin/payout-operations` and `/admin/payout-operations/[id]` | Deny redirects to `/admin`. |
| `/admin/transactions` | Reached from the money hub. |
| `/admin/cashout-holds` | `requests.manage` |
| `/admin/player-transactions` | `requireAgentScope` |
| `/admin/payments` | `cms.manage` |
| `/admin/games` | `cms.manage` |
| `/admin/game-accounts` | `requireStaff`, then redirect if no tool applies |
| `/admin/game-balances` | Super Admin |
| `/admin/agents` | `requireStaff`, then redirect if no tool applies |
| `/admin/sub-creators` | `requireAgentScope`. A sub is sent to `/admin/players`. |
| `/admin/agent-inbox` | `requireAgentScope` |
| `/admin/agent-reports` | Staff, then redirect unless the role is allowed |
| `/admin/marketing-center` | `requireStaff`, then redirect if no tool applies |
| `/admin/newsletters` | `newsletters.manage` |
| `/admin/marketing` | `cms.manage` |
| `/admin/telegram` | `cms.manage` |
| `/admin/notifications` | `notifications.broadcast` |
| `/admin/promotions` | `promotions.manage` |
| `/admin/offers` | Redirects to `/admin` without an offer scope |
| `/admin/automation` | Operator staff, then redirect if no tool applies |
| `/admin/ai-blog` | `cms.manage` |
| `/admin/ai-bot` | `support.manage` |
| `/admin/analyzer` | Redirects to `/admin` |
| `/admin/content` | `requireStaff`, then redirect if no tool applies |
| `/admin/growth` | `requireStaff`, then redirect if no tool applies |
| `/admin/referrals` | `referrals.manage` |
| `/admin/vip` | `vip.manage` |
| `/admin/rewards` | `rewards.manage` |
| `/admin/achievements` | `achievements.manage` |
| `/admin/leaderboards` | `leaderboards.manage` |
| `/admin/bonus-transactions` | Redirects to `/admin/transactions?wallet=bonus` |
| `/admin/kyc` | `kyc.manage` |
| `/admin/security`, `/admin/fraud`, `/admin/audit` | Super Admin |
| `/admin/analytics` | `analytics.read` |
| `/admin/settings` | `settings.manage` |
| `/admin/roles` | `users.roles` |
| `/admin/cms`, `/admin/reviews`, `/admin/geo` | `cms.manage` |

`src/middleware.ts` does not itself decide who is staff. `src/lib/supabase/middleware.ts` treats `/admin` as a signed-in route. Each page above still applies its own staff gate. That split was already true at the production commit.

## 5. Phase-by-phase implementation status

| Phase | What it did | Where it sits |
| --- | --- | --- |
| 2A | Player, follow-up, ticket, and chat presentation. Renamed one dashboard card. | Inside the production history through `b61e65b`. |
| 2B | Financial screens and the separate failed-webhook card. | Inside the production history through `b61e65b`. |
| 2C | Store and sub-creator presentation. | Inside the production history through `b61e65b`. |
| 2D | Game screens. Provider passwords are not placed in the edit form. | `origin/main` is `b61e65b`. |
| 2E | Marketing and automation presentation. | Commit `030a2e2`. On local `main` and on this branch. Not on `origin/main`. |
| 2F | Dashboard, sidebar, and shared card polish. | Commit `55a9990`. On this branch and `origin/admin-v2-development`. Not on `main`. |
| 2G | Verification, security, roles, and settings presentation. | Uncommitted. |
| 2H | Payment labels, pages and FAQ, reviews, city pages, live chat, and rewards list cards. | Uncommitted. |

No phase from 2A through 2H changed wallet math, Paydora routes, or permission definitions, according to those phase reports and the files inspected here.

## 6. Financial safety findings

Reviewed, and the server still checks the staff member before the debit:

- `payoutCashout` in `src/lib/actions/admin/payouts.ts` calls `authorize("requests.manage")`, then `adminListScope`, then `playerInScope` for a network staff member, then `admin_payout_cashout`. It writes `cashout.payout` to the audit log.
- The matching button in `src/components/admin/payout-form.tsx` does not ask for confirmation. The amount field starts at the full cash-out balance. **AUD-01. CONFIRMED. Also present at `b61e65b`.**
- `GameLoadActions.mark` in `src/components/admin/game-load-actions.tsx` calls `adminUpdateGameLoadStatus` on the first click for completed, failed, or cancelled. **AUD-02. CONFIRMED.**
- Deposit Reject in `src/components/admin/deposit-actions.tsx` changes the record on the first click. The note on the page says it does not send a payment. **AUD-11. MEDIUM. CONFIRMED.**
- A play-wallet or cash-out adjustment opens a dialog and then uses “Apply”. That is two steps, and it is not a separate “are you sure” question. **AUD-12. MEDIUM. CONFIRMED** in `src/components/admin/user-management-panel.tsx`. Delete still uses `ConfirmActionButton`.
- `scripts/payout-reservation.test.mjs`, `scripts/payout-operations-security.test.mjs`, `scripts/financial-trust.test.mjs`, and `scripts/deposit-automation.test.mjs` passed. They read source. They do not move money.
- This audit did not click Mark paid, Reject, Complete, Apply, Refund, or Withdraw.

`payoutCashout` returns the database error text to the screen when the SQL call fails (`src/lib/actions/admin/payouts.ts` line 52). **AUD-13. LOW. CONFIRMED.**

## 7. Game-provider findings

- `src/app/admin/games/page.tsx` still selects `webhook_secret`, `api_username`, and `api_password` on the server. The edit form sets those fields to an empty default and tells the operator that a blank value keeps the saved secret. The page shows “saved” or “not saved”, not the secret itself. **CONFIRMED in the current file. Phase 2D report says this browser leak was closed. This audit did not find the password in a client default.**
- Live game coins remain Super Admin only (`/admin/game-balances`).
- Provider clients, login-check scripts, and payment routes were not executed.
- No new provider, URL, or credential was added in Phase 2G or 2H.

## 8. Authentication and permission findings

- Admin pages listed in section 4 each have a server gate. Navigation hiding is in `src/lib/admin/nav.ts` and is not the only check.
- Super Admin still comes from the staff context used by `requireSuperAdmin`. The role matrix on `/admin/roles` is read-only.
- Role assignment remains on the player profile, in the same panel as wallet actions. That file was not part of Phase 2G or 2H.
- Store and sub sessions are redirected away from platform tickets and platform live chat.
- `offerScopeForCurrentUser` limits a sub to their own id and a store to `parentIds`. A platform super admin can target everyone. **CONFIRMED** in `src/lib/offers/send.ts`.
- No auth bypass was attempted. The browser session was already signed in.

No missing page-level gate was found in the inventory. That does not mean every server action was re-reviewed line by line. The money, identity, offer, and blog actions that were opened do call `authorize` or an equivalent staff check.

## 9. KYC and privacy findings

What is in good shape:

- A player upload requires a signed-in user, checks the file, and stores a private path such as `userId/uuid.jpg`. It does not store a public web address. `src/lib/actions/kyc-actions.ts` lines 41–93.
- The upload audit row stores the file name and size, not the photo. Lines 107–113.
- `getAdminKYCSubmissions` calls `authorize("kyc.manage")` before it creates signed links. Lines 155–184.
- Signed links last 120 seconds. Line 182.
- `supabase/migrations/20261013000140_kyc_private_bucket.sql` sets the `kyc-documents` bucket to `public = false`. It does not add a public read policy. This audit did not query the live bucket. Whether that migration is applied in production is **NEEDS VERIFICATION**. Earlier project notes say the owner applied it. This pass did not re-check the database.
- The review page was not opened, so no identity photo was loaded in the browser.

Findings:

- **AUD-05. HIGH. CONFIRMED.** `updateKYCStatus` (lines 189–242) checks `kyc.manage`, then updates the submission and the profile. It does not call `writeAudit`. The buttons in `src/components/admin/admin-kyc-review-card.tsx` lines 31–54 do not ask for confirmation. The same `writeAudit` import at production commit `b61e65b` is only used for the player submit, at line 107 of that older file. Approve and reject were already unaudited there.
- **AUD-14. MEDIUM. CONFIRMED.** If the submission update succeeds and the profile update fails, the function returns the profile error after the submission is already changed. The two records can disagree. Lines 215–234.
- **AUD-09. MEDIUM. CONFIRMED code, live rows NEEDS VERIFICATION.** Every loaded row, up to 100, gets a signed link, including approved and rejected checks. If `document_url` already starts with `http`, the code keeps that address and does not sign a private path. Lines 180–183. This audit did not read those rows and did not download a file. If old rows still contain a public address, that file can be opened by anyone who has the address.
- **AUD-15. LOW. CONFIRMED.** `getKYCSystemStatus` uses the service client and does not check the caller. A direct call can learn whether the table exists. The page itself still requires `kyc.manage` before it shows the message. Some database errors are returned as `error.message` (line 150) and can appear in `AdminErrorState`.
- Logs reviewed: `logIncident` and `console.error` receive the storage or query error text. The submit audit does not record the photo. No document body was found in those log calls.

## 10. Marketing and automation findings

What is in good shape:

- Newsletter sending calls `promoEmailBlockReason` again immediately before send (`blockReasonNow` in `src/lib/email/newsletter-batch.ts`). Opted-out, banned, and suspended recipients are skipped at send time, not only when the list was built. A recipient row is claimed before Resend is called, which blocks a second worker from sending the same row.
- Offer email and SMS lists require `email_promotions` or `sms_marketing` to be true, and they skip suspended and banned players (`src/lib/offers/audience.ts`).
- `offer_deliveries` has `unique (user_id, channel, sent_on)` in `supabase/migrations/20261008000170_signup_offers.sql`. A second offer to the same person on the same channel the same day is skipped.
- Signup does not enable the submit button until both the terms box and the offers box are checked (`signupReady`). The server rejects the profile finish unless `offersConsent` is true.
- Cron routes fail closed. `verifyCronRequest` returns 503 when `CRON_SECRET` is missing and 401 when the bearer token does not match.
- `vercel.json` schedules only `/api/cron/seo-index`. It does not schedule `/api/cron/auto-blog`. The live dashboard agrees: “AI blog — Not on the Vercel schedule” and “Telegram autopilot — Not on the Vercel schedule.”
- No email, SMS, Telegram message, campaign, or blog post was sent.

Findings:

- **AUD-06. HIGH. CONFIRMED.** `generateAndSaveAIBlogPost` sets the post to `published` when `auto_publish` is true (`src/lib/ai/blog-generator.ts` line 622). The in-code default is `auto_publish: true` and `auto_telegram_broadcast: true` (`src/lib/ai/settings.ts` lines 47–48). The button label is “Generate & Publish Article Now” and it has no confirmation (`src/components/admin/ai-blog-generator-card.tsx`). The staff action also broadcasts to Telegram when those settings are on (`src/lib/actions/admin/ai-blog-actions.ts` lines 25–30). The database default in `supabase/migrations/20260720000300_kyc_and_ai_system.sql` is the same. The cron route is protected, and it is not on the Vercel schedule in this repo. A person with `cms.manage` can still publish from the button.
- **AUD-08. MEDIUM. CONFIRMED.** `OfferSendForm` submits on the first click. The screen says it does not ask again. Consent filtering and the same-day unique key still apply. `loadScopedPlayers` stops at 5,000 profiles (`src/lib/offers/send.ts` line 45), so a larger audience count can be short without saying so.
- **AUD-16. MEDIUM. CONFIRMED.** The rewards switch and the Telegram promo switch still save as soon as they change. Phase 2G left that behavior in place. Send-test and delete still confirm.
- The local dashboard said the email sender is not configured and the scheduled-job secret is not configured. That is the local server environment. Production environment values were not read. Paydora webhook presence was “Configured” on that same local screen. The secret value was not shown.

## 11. Store and sub-creator findings

- **AUD-03. HIGH. CONFIRMED code. Whether any store has more than 1,000 players is NEEDS VERIFICATION.** `AgentHome` loads at most 1,000 newest profiles (`src/components/admin/agent-home.tsx` lines 14–20). The player total uses an exact count. “New players, 7 days” is counted only inside those 1,000 rows, and the hint says so. Pending loads, failed loads, and pending deposits are counted only for those 1,000 ids (lines 36–63). Their hints do not say the list is capped. If the count query fails, `count ?? 0` shows 0. The same `.limit(1000)` is at `b61e65b`.
- **AUD-17. MEDIUM. CONFIRMED.** Store CRM fulfilled-deposit totals use at most 1,000 player ids and then at most 5,000 deposit rows (`src/lib/data/admin-crm.ts` lines 91–104). The player total beside them is an exact count. The platform fallback path sums at most 5,000 completed deposits (line 58) when the overview function is unavailable. A short total can look complete.
- Creating a store, moving a player, and resetting a password were not clicked. Those buttons already ask before they run (`sub-creators-manager.tsx`, `network-players.tsx`).
- Cross-store reads that were inspected go through `parent_agent_id` and `adminListScope`. This pass did not find a new cross-store query in the Phase 2G or 2H files.

The signed-in platform dashboard showed 0 active stores, 0 active sub-creators, and 4 players linked to a store. Those are three different queries. The labels match the queries. A reader can still think the 4 players have no store. **AUD-18. MEDIUM. CONFIRMED on screen. The cause of the mismatch was not queried. NEEDS VERIFICATION.**

## 12. Dashboard and analytics findings

The platform dashboard in `src/app/admin/page.tsx` uses real counts:

- “Deposits completed today” is completed `deposit_requests` since 00:00 UTC. The hint says it is a count, not revenue.
- “Cash-out debits today” is cash-out wallet debit rows since 00:00 UTC. The hint says it is not profit.
- The chart “24 hours / 7 days / 30 days” uses rolling windows (`since(1)`, `since(7)`, `since(30)`). It is not the same window as “today.” The caption says that.
- `headCount` returns null on error. `showCount` prints Unavailable. A real zero stays 0.
- Recent transaction and failed-load panels show an error state when their query returns an error.
- Identity photos are not loaded on the dashboard. The identity card says photos stay on the identity page.
- Automation health does not start a job.
- System health shows whether a key exists. It does not print the key.

Findings:

- **AUD-04. HIGH. CONFIRMED. Present at `b61e65b`.** `countOpenTickets` returns 0 when the ticket table query fails for a reason other than a missing table (`src/lib/support/ticket-store.ts` lines 203–211). The dashboard then shows 0, not Unavailable.
- **AUD-10. MEDIUM. CONFIRMED on the local dashboard.** “Players seen today” rendered Unavailable. Deposits, cash-outs, pending loads, and the charts rendered numbers. The query uses `profiles.last_seen_at`. The database error was not printed. Cause is **NEEDS VERIFICATION**.
- **AUD-19. MEDIUM. CONFIRMED.** The recent-activity feed ignores a failed player or deposit query and can look empty (`src/app/admin/page.tsx` lines 158–201). It does not say Unavailable.
- Live numbers seen, without opening the linked tools: deposits completed today 0; cash-out debits today 0; pending deposits 0; pending wallet loads 30; open tickets 1; identity checks 0; fraud flags 0; failed game loads 75; held cash outs 0; completed deposits 24h 0, 7d 1, 30d 1; new players 24h 2, 7d 13, 30d 31; failed webhooks 0. These came from the existing signed-in page. They were not invented. Personal names from the activity list are not copied here.

`/admin/analytics` still does not calculate revenue. Phase 2E recorded that. It was not rebuilt.

## 13. Admin UX and visual findings

Consistent on the pages that were opened: midnight sidebar, “Sweepstakes Hub / Control Center,” purple search field, section labels, breadcrumbs, and the payment, FAQ, and review empty states.

Leftovers, presentation only:

- **AUD-20. LOW. CONFIRMED.** These admin pieces still use the older glass, amber, or green treatment: `admin-ai-bot-control-card.tsx`, `ai-blog-generator-card.tsx` (green publish button), `admin-tool-grid.tsx`, `admin-player-followup-card.tsx`, `admin-telegram-tester.tsx`, `admin-image-generator-card.tsx`. The public site was not restyled.
- **AUD-21. LOW. CONFIRMED.** Ticket threads still use the shared player chat component. Phase 2H left it alone so the public chat would not change.
- **AUD-22. LOW. CONFIRMED.** The city page heading is “City pages” (`src/app/admin/geo/page.tsx` line 48). The browser title is still “Geo Pages” (line 19).
- **AUD-07. HIGH. CONFIRMED.** The city generator button is still one click. The page copy says it publishes when pressed. It was visible in the browser as “Bulk US States SEO Generator” and was not pressed. The page lists every stored state and city with edit and delete controls, which is a long screen for a nontechnical owner. **AUD-23. MEDIUM. CONFIRMED on screen.**
- **AUD-24. LOW. CONFIRMED.** A new FAQ and a new testimonial still default the Published switch to on (`src/app/admin/cms/page.tsx` lines 90 and 382). The page says nothing is published until you save. The first save of a new FAQ still publishes if that switch is left on. That default was already the save behavior.
- Failed loads appears under both Financial Center and Game Center. Both open the same list. **AUD-25. LOW. CONFIRMED** in `src/lib/admin/nav.ts`.
- Support chat at `/admin/chat` showed the existing conversation list, search box, and timestamps. No reply was typed or sent. Message text is not copied into this report.
- Desktop at 1440 pixels showed a 288-pixel sidebar. Phone width at 390 pixels hid the sidebar, left the menu button collapsed, and did not widen the page past 390 pixels. Device emulation was cleared afterward.

## 14. Automated test results

The local dashboard on port 3001 was left running. `npx next build` was not run in the project folder. It was run in a temporary folder that used links to `src` and `node_modules`, so the build could not replace the dashboard’s `.next` directory. Those links were removed afterward. The temporary copy of environment files was deleted. The real project files were not deleted.

Passed:

- `npx tsc --noEmit`
- `node scripts/admin-nav-v2.test.mjs`
- `node scripts/staff-access.test.mjs`
- `node scripts/kyc-upload.test.mjs`
- `node scripts/player-transactions.test.mjs`
- `node scripts/financial-trust.test.mjs`
- `node scripts/payout-reservation.test.mjs`
- `node scripts/payout-operations-security.test.mjs`
- `node scripts/payout-operations-ui.test.mjs`
- `node scripts/deposit-automation.test.mjs`
- `node scripts/deposit-access.test.mjs`
- `node scripts/auto-money.test.mjs`
- `node scripts/admin-list-scope.test.mjs`
- `node scripts/newsletter-consent.test.mjs`
- `node scripts/offers.test.mjs`
- `node scripts/store-center-ui.test.mjs`
- `node scripts/game-center-ui.test.mjs`
- `node scripts/marketing-center-ui.test.mjs`
- `node scripts/automation-health.test.mjs`
- `node scripts/chat-thread.test.mjs`
- `node scripts/restricted-state.test.mjs`
- `node scripts/whole-coin.test.mjs`
- `node scripts/live-game-balances.test.mjs`
- `node scripts/rate-limit.test.mjs`
- `node scripts/blog-links.test.mjs`
- `node scripts/game-load-outcome.test.mjs`
- `node scripts/firekirin-api.test.mjs`
- Isolated `npx next build` — exit 0. Existing image and hook warnings remained. One compile retry happened after a network socket closed. The retry compiled.

Failed: none of the checks above.

Not present, so not run: a test that clicks Mark paid, a test that approves identity, a test for the settings page, a test for the fraud page, a test for the audit page, and a test for the roles page. `package.json` has no `npm test` script. Provider login checks and setup scripts were not run.

Tests were not edited.

## 15. Browser verification results

A signed-in Super Admin session was already open at `http://localhost:3001`. No password was entered. Authentication was not bypassed.

Opened, and no save, delete, approve, reject, send, publish, or payment button was clicked:

- `/admin` at desktop width and at 390 pixels
- `/admin/cms` (FAQ tab, empty state, New FAQ not opened)
- `/admin/reviews` (empty state)
- `/admin/geo` (stored states and cities, generator visible, button not pressed)
- `/admin/payments` (empty state, Add not opened)
- `/admin/chat` (existing list visible, no message sent)

Not opened in this pass: identity photos, fraud actions, payouts, deposits, game loads, newsletters, offers, and the AI blog button. Identity review was skipped so a photo would not load.

Player CRM, Financial Center, Game Center, Store Center, Marketing Center, Automation Center, Rewards Center, Verification Center, Security Center, Analytics Center, and Settings were visible in the sidebar. Child links were not all clicked.

## 16. Critical findings

None confirmed.

A critical rating would need a demonstrated path for an outsider to read an identity file, change a balance, or send a campaign without a staff check. The actions above require a signed-in staff permission. Old public identity addresses are possible in stored rows, and that was not verified against the database. It is not marked critical without that evidence.

## 17. High findings

| ID | File | Evidence | Impact | Production commit | Staging |
| --- | --- | --- | --- | --- | --- |
| AUD-01 | `src/components/admin/payout-form.tsx` lines 23–73; `src/lib/actions/admin/payouts.ts` `payoutCashout` | Mark paid submits immediately. The server does authorize and debit in SQL. | A mis-click pays out the full cash-out balance. | Yes | Required before any payout test |
| AUD-02 | `src/components/admin/game-load-actions.tsx` lines 32–52 | `mark` has no confirmation. | A load can be closed or failed by one click. | Yes | Required |
| AUD-03 | `src/components/admin/agent-home.tsx` lines 14–63 | Pending money counts use the newest 1,000 players. Errors become 0. | A store can miss a waiting deposit or load. | Yes | Required on a store with a known player count |
| AUD-04 | `src/lib/support/ticket-store.ts` lines 203–211 | Query error returns 0. | Open tickets can look clear. | Yes | Required by forcing a failed read on a copy, not production |
| AUD-05 | `src/lib/actions/kyc-actions.ts` `updateKYCStatus`; `admin-kyc-review-card.tsx` lines 31–54 | No audit write. No confirmation. | An approval can change cash-out eligibility with no review trail. | Yes | Required on test identities only |
| AUD-06 | `src/lib/ai/blog-generator.ts` line 622; `ai-blog-generator-card.tsx`; `src/lib/ai/settings.ts` lines 47–48 | Publish and Telegram follow `auto_publish`. | One click can publish a public post and message Telegram. | Yes | Required with publishing turned off first |
| AUD-07 | `src/components/admin/admin-bulk-landing-generator.tsx` `handleBulkGenerate` | One click. The label is Generate All 50 States. | Public city pages change together. | Yes | Required only if a publish test is intended |

## 18. Medium findings

| ID | File | Evidence | Impact | Production commit | Staging |
| --- | --- | --- | --- | --- | --- |
| AUD-08 | `src/components/admin/offer-send-form.tsx`; `src/lib/offers/send.ts` | No second confirm. Consent and same-day unique key exist. Cap of 5,000. | Accidental offer. A large list can be incomplete. | Yes | Required before any send test |
| AUD-09 | `src/lib/actions/kyc-actions.ts` lines 180–183 | Signs all loaded IDs. Keeps `http` addresses. | Extra exposure of old files if those addresses are public. | Yes | Verify row values on a copy. Do not download files. |
| AUD-10 | `src/app/admin/page.tsx` lines 142–144 | Live card said Unavailable. | The owner cannot see who was active today. | Dashboard text is newer than `origin/main` | Check the `last_seen_at` error on staging |
| AUD-11 | `src/components/admin/deposit-actions.tsx` lines 22–50 | Reject is one click. | A deposit record can be rejected by mistake. | Yes | Required |
| AUD-12 | `src/components/admin/user-management-panel.tsx` lines 170–222 | Apply sits inside a dialog. | A wallet change is easier than a delete. | Yes | Required |
| AUD-14 | `src/lib/actions/kyc-actions.ts` lines 215–234 | Profile update is separate from the submission update. | Statuses can disagree. | Yes | Required |
| AUD-16 | `src/components/admin/rewards-toggle.tsx`; settings editor | Switch saves immediately. | Rewards or a promo switch can change without Save. | Yes | Required |
| AUD-17 | `src/lib/data/admin-crm.ts` lines 58 and 91–104 | Caps of 1,000 and 5,000. | Fulfilled-deposit totals can be short. | Yes | Compare a known total |
| AUD-18 | `src/app/admin/page.tsx` lines 145–153 | Screen showed 0 active stores and 4 linked players. | The store section is easy to misread. | Query is in the Phase 2F dashboard | Explain the 4 links on staging |
| AUD-19 | `src/app/admin/page.tsx` lines 158–201 | Feed drops failed queries. | Empty activity can mean a failed read. | Yes for the feed pattern | Optional |
| AUD-23 | `src/app/admin/geo/page.tsx` | The live page renders every state and city control. | Hard to scan. The generator is on the same page. | Yes | Optional |
| AUD-26 | `src/components/dashboard/chat-container.tsx` lines 150–152 | Ticket attachment links last 365 days. | A leaked link works for a year. This is the shared player chat, not the identity bucket. | Yes, this file was not part of 2G or 2H | Required before changing it |

## 19. Low findings

| ID | File | Evidence | Production commit |
| --- | --- | --- | --- |
| AUD-13 | `src/lib/actions/admin/payouts.ts` line 52 | Database error text is returned to the operator. | Yes |
| AUD-15 | `src/lib/actions/kyc-actions.ts` `getKYCSystemStatus` | No caller check. No documents are returned. | Yes |
| AUD-20 | Admin glass and green cards listed in section 13 | Older colors remain on a few tools. | Mixed. Some are older than Phase 2F. |
| AUD-21 | `src/app/admin/support/[id]/page.tsx` | Shared player chat styling. | Yes |
| AUD-22 | `src/app/admin/geo/page.tsx` lines 19 and 48 | Title says Geo Pages. Heading says City pages. | Heading change is uncommitted Phase 2H. |
| AUD-24 | `src/app/admin/cms/page.tsx` lines 90 and 382 | New FAQ published switch defaults on. | Yes |
| AUD-25 | `src/lib/admin/nav.ts` | Failed loads is listed twice. | Yes |

## 20. Production versus development comparison

Read-only git only. Nothing was fetched.

| Ref | Commit | Meaning |
| --- | --- | --- |
| `origin/main` | `b61e65b` Admin v2 Phase 2D game management redesign | Last known remote main. Matches the previously observed production commit. |
| local `main` | `030a2e2` Admin v2 Phase 2E marketing redesign | Not the same as `origin/main`. It is one commit ahead, and that commit was not on `origin/main`. |
| `admin-v2-development` HEAD | `55a9990` Phase 2F | Contains Phase 2E and Phase 2F. |
| Uncommitted | Phase 2G and Phase 2H | Not on any remote. |

Local `main` is not behind `origin/main`. It is ahead of the last fetched `origin/main` by Phase 2E. Because this audit did not fetch, GitHub `main` might have moved since that remote ref was last updated. Live production behavior is not claimed from git history alone.

`git diff --stat b61e65b...HEAD` is Phase 2E and Phase 2F only: marketing screens, dashboard polish, shared cards, and the admin scrollbar. It does not include payment routes, wallet SQL, or migrations. Phase 2G and 2H are extra uncommitted presentation files.

Risks that already exist at `b61e65b`: AUD-01, AUD-02, AUD-03, AUD-04, AUD-05, AUD-06, AUD-07, AUD-08, AUD-09, AUD-11, AUD-12, AUD-17.

Risks introduced on the development branch: the Phase 2F dashboard can say Unavailable for players seen today (AUD-10). The uncommitted city-page heading and chat colors do not change publish or send behavior. The offer screen now states that Send does not ask again. The send action itself was already one click.

## 21. Staging requirements

Use a copy of the database, not production, for every item below.

- Confirm the `kyc-documents` bucket is private and that stored `document_url` values are paths, not public web addresses. Do not download the files.
- Approve and reject only a test identity, and confirm an audit row is the desired behavior before changing code.
- Click Mark paid, game-load complete, and wallet Apply only against test balances.
- Turn AI auto-publish and Telegram auto-post off before opening the blog generator.
- Do not press Generate All 50 States unless a publish test is intended.
- Send an offer and a newsletter only to a test inbox, including a recipient who opted out.
- Open a store account with more than 1,000 players, or a fixture of that size, and compare pending-load counts with a direct count.
- Find out why “Players seen today” is Unavailable.
- Walk the phone layout of payouts, deposits, and live chat. This pass checked the dashboard at 390 pixels.

## 22. Production release checklist

| Check | Result |
| --- | --- |
| Visual completeness | Most hubs match the navy and purple system. AUD-20 leftovers remain. |
| Route coverage | The inventory in section 4 is complete for current `page.tsx` files. |
| Permission safety | Page gates are present. They were not bypassed. |
| Financial safety | Server checks remain. One-click payout and load actions remain. Not clicked. |
| Game-provider safety | Passwords are not prefilled. Provider calls were not made. |
| Marketing consent | Newsletter and offer filters recheck consent. One-click send and publish remain. |
| KYC privacy | New uploads target a private bucket in code. Approval has no audit row. Live bucket not re-queried. |
| Mobile usability | Dashboard at 390 pixels kept the menu closed and did not overflow. Other hubs were desktop-only in this pass. |
| Automated tests | The list in section 14 passed. |
| Browser verification | Section 15. Dangerous buttons were not clicked. |
| Database isolation | No SQL was run. No production row was written by this audit. |
| Staging readiness | Not done. Section 21 is still open. |
| Deployment safety | Do not deploy. 2G and 2H are uncommitted. Local `main` is not `origin/main`. |

## 23. Overall readiness rating

**NOT READY**

The admin visuals can be reviewed. They should not be released. High-severity one-click money and publishing actions are still in the code, including on the known production commit. Essential payout, deposit, game-load, identity, and campaign workflows were not executed, on purpose. Uncommitted Phase 2G and 2H work is not on GitHub. Local `main` does not match `origin/main`.

This would move to ready with conditions only after the staging list is done, the high findings are accepted or fixed, and the owner chooses a commit to deploy. It is not that state now.

## 24. Recommended next actions

1. Leave this branch unmerged and undeployed until you review this report.
2. On a database copy, check identity-file privacy and the “Players seen today” error before any code change.
3. Add confirmation, without changing the debit itself, for Mark paid, game-load status, identity approve and reject, offer send, and the city generator. Add an audit row for identity decisions.
4. Make store pending counts use the full network, and make a failed ticket count say Unavailable.
5. Turn the AI blog default to draft unless you explicitly want automatic publishing.
6. After those decisions, commit Phase 2G and 2H only if you ask for a commit. Do not commit `eng.traineddata`.
7. Deploy only with an explicit request, from the commit you choose, after staging. Pushing `main` is a separate decision from pushing this development branch.

## Final safety check

Recorded after this report was the only intended write:

- Branch remains `admin-v2-development`.
- Phase 2G and Phase 2H files listed in section 3 were still present when the report was written.
- No financial, migration, permission, or environment file was edited by this audit.
- No commit, push, merge, or deployment was made.
- No production data was modified.
- `eng.traineddata` stays untracked.
