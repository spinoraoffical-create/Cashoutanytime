# Admin v2 Phase 2H report

Date: 14 October 2026. This phase finishes the purple-and-blue presentation on the remaining content, review, city, payment-label, and live-chat screens. It stays on `admin-v2-development`. The uncommitted Phase 2G files were left in place. Wallet math, payment provider routes, payout reservation, authentication, staff permission definitions, SQL, migrations, and row security were not edited. Nothing was committed, pushed, merged, deployed, or written as a new record.

## 1. Starting branch and commit

- Branch: `admin-v2-development`
- Starting commit: `55a9990` (`Admin v2 Phase 2F premium visual polish`)
- Phase 2G was still uncommitted at the start and is still uncommitted.
- `eng.traineddata` stayed untracked.
- `main` was not checked out.

## 2. Files changed

Phase 2H presentation files:

- `src/app/admin/payments/page.tsx`
- `src/app/admin/payments/loading.tsx`
- `src/app/admin/cms/page.tsx`
- `src/components/admin/cms-tab-nav.tsx`
- `src/app/admin/reviews/page.tsx`
- `src/app/admin/reviews/loading.tsx`
- `src/components/reviews/review-card.tsx` (admin controls only)
- `src/app/admin/geo/page.tsx`
- `src/app/admin/geo/loading.tsx`
- `src/components/admin/admin-bulk-landing-generator.tsx`
- `src/components/admin/admin-chat-inbox.tsx`
- `src/app/admin/rewards/page.tsx`
- `src/app/admin/vip/page.tsx`
- `src/app/admin/achievements/page.tsx`
- `src/app/admin/leaderboards/page.tsx`
- `src/app/admin/referrals/page.tsx`
- `src/components/admin/ui/admin-status-badge.tsx`
- `ADMIN_V2_PHASE2H_REPORT.md`

`admin-status-badge.tsx` also still contains the Phase 2G labels. This phase added `hidden`, `inactive`, `live`, and `featured`.

Phase 2G files remain modified and uncommitted. They were not reverted.

## 3. Routes updated

Presentation only. The addresses and permission gates are the same.

- `/admin/payments` — payment method labels. Still requires `cms.manage`.
- `/admin/cms` — pages and FAQ. Still requires `cms.manage`.
- `/admin/reviews` — player reviews. Still requires `cms.manage`.
- `/admin/geo` — city and state pages. Still requires `cms.manage`.
- `/admin/chat` — live chat. The same store and sub redirect, and the same staff gate, are still in the page.
- `/admin/rewards`, `/admin/vip`, `/admin/achievements`, `/admin/leaderboards`, and `/admin/referrals` — the list cards now use the navy surface. Their save actions were not edited.

## 4. Features preserved

- Payment add, edit, and delete still call `upsertPaymentMethodAction` and `deletePaymentMethodAction`. Delete still asks for confirmation. Checkout is still described as Paydora. No provider URL, credential, or validation was edited.
- FAQ, banner, announcement, testimonial, and blog save and delete actions are unchanged. A draft stays a draft until the existing published switch is saved. Blog status labels still come from the stored status.
- Review like, team reply, and delete still use the existing handlers. They only render when the card is opened as an admin. The public review text and the public team-reply box were not restyled.
- State and city save and delete actions are unchanged. The bulk generator still publishes only when its existing button is pressed. That button was not clicked.
- Live chat still uses the same conversation query, the same 50-message limit, and the same send handler. No message was sent. Real-time polling was not changed.
- Reward, VIP, achievement, leaderboard, and referral queries and edit actions were not changed.

## 5. Tests passed

- `npx tsc --noEmit` — exit 0
- `node scripts/admin-nav-v2.test.mjs` — passed
- `node scripts/staff-access.test.mjs` — passed
- `node scripts/kyc-upload.test.mjs` — passed, because Phase 2G still touches the identity page
- `node scripts/player-transactions.test.mjs` — passed. It checks that live chat still limits messages to 50 and does not use the old poll timers.
- `npx next build` — exit 0

There is no separate test script for payments, CMS, reviews, city pages, or live chat beyond the chat assertions inside `player-transactions.test.mjs`.

## 6. Tests failed

None of the checks above failed. The production build was run after the local dashboard on port 3001 was stopped, so it did not share the `.next` folder. Port 3001 was started again afterward. Port 3000 was not stopped.

The build still prints the existing image and hook warnings.

## 7. Browser verification

A signed-in Super Admin session was already open at `http://localhost:3001`. Authentication was not bypassed. No save, delete, generate, like, or send button was clicked.

- Pages and FAQ loaded on a narrow screen with the purple FAQ tab and the empty FAQ state.
- Payment methods loaded with the existing empty state for this session. The add button was visible and was not opened.
- Live chat loaded the existing customer list and one already-open thread. No reply was typed or sent.

City pages and the reviews list were restyled in code and covered by the typecheck and production build. They were not clicked through in the browser.

## 8. Remaining inconsistencies

- The ticket thread at `/admin/support/[id]` still uses the shared player chat container. Restyling that container would also change the player site, so it was left as it was.
- The inside of the city-page generator list still uses some of its older small cards. The outer card and the publish button now use the admin purple.
- Deposit, cash-out, and wallet screens were not opened in this phase.
- The public review card body still uses its previous colors. Only the admin like, reply, and delete controls were recolored.

## 9. Security concerns

- Payment method cards still show the stored handle or address when one exists. That was already on the page. Provider passwords and API keys are not printed.
- Live chat still shows the conversations this Super Admin could already open. No transcript was copied into this report, and no message was sent.
- The city generator button still publishes every stored state when pressed. The page copy says that. The button was not pressed.
- No permission check, chat subscription, or payment route was weakened.

## 10. Recommendations for a final audit

- Walk through Pages and FAQ, Reviews, City pages, Payment methods, and Live chat on a desktop and a phone before any merge.
- Confirm a payment-method edit still saves only the same fields, and that delete still asks first.
- Leave the city generator button unpressed unless a publish is intended.
- Do not deploy this branch until that review is done. Production is still the earlier `main` commit.
