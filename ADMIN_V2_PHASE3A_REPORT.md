# Admin 2.0 Phase 3A report

Date: 14 October 2026. This phase adds confirmations and makes a few admin counts fail honestly. It does not change wallet SQL, payment providers, permissions, or the database schema. Nothing was committed, pushed, or deployed.

## Finding results

| ID | Result | What changed |
| --- | --- | --- |
| AUD-01 Mark paid | Fixed | The same debit still runs, after a confirmation. |
| AUD-02 Game-load status | Fixed | Complete and Failed ask first. The status action is unchanged. |
| AUD-03 Store counts capped at 1,000 | Fixed | Pending loads, failed loads, and pending deposits are counted for the whole network. A failed count says Unavailable. |
| AUD-04 Open tickets show 0 on error | Partially fixed | The owner dashboard says Unavailable. The sidebar hides the badge. An older unused stats helper still turns a failed count into 0. |
| AUD-05 Identity approve and reject | Fixed | Each button asks first. A successful decision writes an audit row with the status only. |
| AUD-06 AI blog one-click publish | Partially fixed | The button asks first. If the saved settings row says publish, it still publishes after confirmation. The code fallback, used only when that row is missing, is now a draft and does not broadcast. |
| AUD-07 Generate all 50 states | Fixed | The same publish action runs after a confirmation. |
| AUD-08 Offer send | Partially fixed | Send asks first. Consent rules and the same-day duplicate block are unchanged. The 5,000-player read cap is unchanged. |
| AUD-09 Identity links for every stored check | Partially fixed | Approved and rejected checks no longer receive a signed link on the list. Pending checks still do. A pending row that already stores a web address is still shown as that address. |
| AUD-10 Players seen today Unavailable | Deferred | The card already says Unavailable. The database reason was not queried. |
| AUD-11 Deposit reject | Fixed | Reject asks first. The deposit action is unchanged. The older request screen’s Complete and Reject ask first as well. |
| AUD-12 Wallet adjustment | Fixed | Apply asks first. The adjustment actions are unchanged. |
| AUD-13 Payout error text | Deferred | The operator can still see the database message. Changing it could hide a real “not enough balance” message. |
| AUD-14 Identity records can disagree | Partially fixed | If the profile update fails, the submission status is put back. There is still no single database transaction. |
| AUD-15 Identity status check had no caller gate | Fixed | The status check now requires `kyc.manage`. Database error text is no longer shown. |
| AUD-16 Rewards and Telegram switches | Fixed | Each switch asks, then saves immediately as before. |
| AUD-17 Follow-up deposit totals capped | Partially fixed | The follow-up total now pages through matching rows instead of stopping at 1,000 players or 5,000 deposits. It can still stop with an error if a network is extremely large. It does not change a balance. |
| AUD-18 Active stores versus linked players | Partially fixed | The labels now say linked players can include an inactive parent. The numbers are the same queries. |
| AUD-19 Recent activity hides a failed read | Partially fixed | If every activity feed fails, the dashboard says Unavailable. A mix of a failed feed and a successful feed still shows the successful rows. |
| AUD-20 Older glass and green cards | Deferred | Visual only. Left for a later pass. |
| AUD-21 Shared ticket chat styling | Deferred | Restyling it would also change the player site. |
| AUD-22 City page title said Geo Pages | Fixed | The browser title now says City pages. |
| AUD-23 City page is very long | Deferred | No redesign. |
| AUD-24 New FAQ defaults to published | Fixed | A new FAQ and a new testimonial now start with Published off. Existing rows are unchanged. |
| AUD-25 Failed loads listed twice | Deferred | Both links still open the same list. |
| AUD-26 Ticket attachment links last 365 days | Deferred | Shortening them could expire pictures already stored in messages. |

## 1. Starting branch and commit

- Branch: `admin-v2-development`
- Commit: `55a9990` (`Admin v2 Phase 2F premium visual polish`)
- Phase 2G, Phase 2H, and the Phase 3 audit report were already uncommitted and were kept.

## 2. Files modified

Phase 3A application files:

- `src/components/admin/payout-form.tsx`
- `src/components/admin/game-load-actions.tsx`
- `src/components/admin/deposit-actions.tsx`
- `src/components/admin/request-actions.tsx`
- `src/components/admin/user-management-panel.tsx`
- `src/components/admin/admin-kyc-review-card.tsx`
- `src/lib/actions/kyc-actions.ts`
- `src/components/admin/offer-send-form.tsx`
- `src/app/admin/offers/page.tsx`
- `src/components/admin/ai-blog-generator-card.tsx`
- `src/lib/ai/settings.ts`
- `src/components/admin/admin-bulk-landing-generator.tsx`
- `src/components/admin/rewards-toggle.tsx`
- `src/components/admin/settings-editor.tsx`
- `src/components/admin/agent-home.tsx`
- `src/lib/data/admin-crm.ts`
- `src/lib/support/ticket-store.ts`
- `src/lib/data/admin-stats.ts`
- `src/app/admin/page.tsx`
- `src/app/admin/cms/page.tsx`
- `src/app/admin/geo/page.tsx`
- `ADMIN_V2_PHASE3A_REPORT.md`

Phase 2G and Phase 2H files that this phase did not need were left as they were. `eng.traineddata` stayed untracked. Test files were not edited.

## 3. Confirmations added

Each confirmation runs the existing action only after the operator accepts it. Cancel does nothing.

- Mark paid
- Game-load Complete and Failed
- Deposit Reject
- Older request Complete and Reject
- Wallet Apply, including a cash-out redeem from the player profile
- Identity Approve and Reject
- Offer Send
- Generate article
- Generate all 50 states
- Rewards switch
- Telegram promo switch

## 4. Count accuracy improvements

- A store home no longer limits pending deposits, pending loads, or failed loads to the newest 1,000 players. New players in 7 days use a direct count.
- Player follow-up fulfilled-deposit totals page through the matching rows instead of a 1,000-player and 5,000-deposit cap.
- The owner dashboard explains that “players linked to a store” can include an inactive parent. That number was not recalculated.

## 5. Error handling improvements

- A failed store count, commission total, or player total says Unavailable instead of 0.
- A failed open-ticket query on the owner dashboard says Unavailable instead of 0.
- Recent activity says Unavailable when its feeds fail and nothing loaded.
- Identity review no longer shows the raw database error.
- A failed identity profile update puts the submission status back and tells the operator the check was left as it was.

## 6. Existing functionality preserved

- `payoutCashout`, game-load status, deposit status, wallet adjustment, and offer send still call the same server actions after confirmation.
- Permission checks were not redefined. The identity status helper now uses the existing `kyc.manage` check.
- No payment provider, game provider, or wallet SQL function was edited.
- Newsletter consent, the offer same-day unique rule, and the offer 5,000-row read were not changed.
- Saved AI blog settings in the database still control publish and Telegram. Only the fallback used when that row cannot be loaded changed.
- Existing FAQ and testimonial rows keep their saved published state.

## 7. Automated test results

Passed:

- `npx tsc --noEmit`
- `scripts/admin-nav-v2.test.mjs`
- `scripts/staff-access.test.mjs`
- `scripts/kyc-upload.test.mjs`
- `scripts/player-transactions.test.mjs`
- `scripts/financial-trust.test.mjs`
- `scripts/payout-reservation.test.mjs`
- `scripts/payout-operations-security.test.mjs`
- `scripts/payout-operations-ui.test.mjs`
- `scripts/deposit-automation.test.mjs`
- `scripts/admin-list-scope.test.mjs`
- `scripts/newsletter-consent.test.mjs`
- `scripts/offers.test.mjs`
- `scripts/store-center-ui.test.mjs`
- `scripts/chat-thread.test.mjs`

Failed, and not edited:

- `scripts/game-center-ui.test.mjs` expects `window.confirm` to be absent from the game-load actions. The new confirmation makes that assertion fail.
- `scripts/marketing-center-ui.test.mjs` expects `window.confirm` to be absent from the offer form. The new confirmation makes that assertion fail.

Those two assertions recorded the old one-click behavior. They were left in place so the test files were not rewritten to force a pass.

`npx next build` was not run. The dashboard on port 3001 was left running, and a build in the same folder would collide with it.

## 8. Browser verification status

A signed-in session was already open at `http://localhost:3001`. No Mark paid, Complete, Failed, Send, Approve, Reject, or Generate button was accepted.

- One-time offers showed “Send asks you to confirm” and the page description that send asks before it delivers. Send was not clicked. The eligible counts on screen were Email 0 and SMS 0.
- Cash outs loaded with 0 players holding a cash-out balance, so the Mark paid form was not on screen. The page still says Mark paid removes the amount from the cash-out wallet.
- City pages used the browser title “City pages.” The generator was not pressed.
- Game loads opened. Expanding a row did not reveal the new sentence in the accessibility tree, so that sentence was confirmed in code and not by a completed click. Complete and Failed were not clicked.

## 9. Remaining backend risks

These can still affect production after this phase:

- The debit, load status, deposit status, and offer send functions are the same functions as before. Confirmation is only in the browser. A crafted call can still invoke the server action.
- A saved `ai_blog_settings` row with publishing turned on still publishes after the operator confirms. This phase did not read or change that row.
- Pending identity files that were stored as a public web address are still usable as that address. The live bucket was not queried.
- The offer audience read still stops at 5,000 profiles.
- Ticket lists other than the dashboard can still look empty when a query fails.
- `getDashboardStats` still treats a failed ticket count as 0. Nothing in the app currently calls it.
- Identity approve and reject are still two updates, with a revert if the second one fails. They are not one database transaction.
- Approving an identity now inserts an audit row. That is a new write to `audit_logs`. The photo is not stored in that row. If the audit insert fails, the status change still stands.

## 10. Phase 3B requirements

- On a database copy, accept each new confirmation once and confirm the old action still does the same thing.
- Update the two UI tests so they require the confirmation instead of forbidding it, after this behavior is accepted.
- Check the live `kyc-documents` bucket and whether any `document_url` values are public web addresses. Do not download files.
- Find why “Players seen today” is Unavailable.
- Decide whether the saved AI blog settings should be switched to draft.
- Remove or raise the 5,000-player offer cap only with a stated audience rule.
- Make the ticket list and the unused stats helper say Unavailable on a failed read.
- Review the 365-day ticket attachment links before shortening them.
- Leave the visual leftovers and the duplicate Failed loads link for a presentation pass.

## Changes that can affect existing production behavior

These do not change a formula, a provider, or a permission definition. They do change what an operator sees or what gets written:

1. The listed buttons and switches do nothing until the operator confirms. Cancel leaves the record unchanged.
2. A successful identity decision writes an audit row. A failed profile update now restores the previous submission status.
3. The identity list no longer prepares links for approved or rejected photos.
4. A new FAQ or testimonial is unpublished unless the operator turns Published on before saving.
5. If the AI blog settings row is missing, a generated article is saved as a draft and is not broadcast. A stored settings row is still obeyed.
6. Store pending and failed counts can be higher than the old 1,000-player view, because older players are included. A failed read shows Unavailable instead of 0.
7. Follow-up deposit totals can be higher than the old capped sum. A failed total shows an error instead of a short number.
8. The owner dashboard can say Unavailable for open tickets or recent activity when those reads fail.

## 12. Final safety check

- Branch remains `admin-v2-development` at `55a9990`.
- Phase 2G files are still present and uncommitted.
- Phase 2H files are still present and uncommitted.
- No financial SQL was changed.
- No provider integration was changed.
- No database migration was created.
- No permission definition was changed.
- No environment file was changed.
- No production record was modified by this phase. The new confirmations were not accepted in the browser.
- No commit was created.
- No push occurred.
- No deployment occurred.
- `eng.traineddata` remains untracked.
