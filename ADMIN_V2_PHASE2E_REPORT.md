# Admin v2 Phase 2E report

Date: 14 October 2026. This phase restyles the existing marketing and automation screens and explains the statuses those screens already store. Sender code, campaign actions, schedules, blog generation, payment routes, wallet math, refunds, game providers, migrations, SQL functions, row security, authentication, staff permission definitions, and production data were not edited. No email, SMS, Telegram message, or blog post was sent. Nothing was deployed, committed, or written to the database.

## 1. Routes inspected

| Route | What it already did | Who can open it |
| --- | --- | --- |
| `/admin/marketing-center` | Links into the marketing tools | Staff with a matching tool. An account with no tool is redirected to `/admin` |
| `/admin/newsletters` | Create, edit, delete, test, send, and schedule email campaigns | `newsletters.manage` |
| `/admin/marketing` | Copy one text or open one WhatsApp chat | `cms.manage`. Phone numbers also need `users.manage` |
| `/admin/telegram` | Channel tester, broadcast, autopilot, and image card | `cms.manage` |
| `/admin/notifications` | In-app notice composer and recent history | `notifications.broadcast` |
| `/admin/promotions` | Create, edit, and delete promotion records | `promotions.manage` |
| `/admin/offers` | One email and one SMS to the eligible audience | Super Admin, store, or sub. Anyone else is redirected to `/admin` |
| `/admin/automation` | Saved job health and today's counts | Operator with `cms.manage` or `support.manage`. Others are redirected to `/admin` |
| `/admin/ai-blog` | Existing blog generator and the 10 newest posts | `cms.manage` |
| `/admin/ai-bot` | Chatbot switch, model-key presence, and saved replies | `support.manage` |
| `/admin/analyzer` | Redirects to `/admin` | Same automation gate before the redirect |
| `/admin/content` | Links to the website editors | `cms.manage` |
| `/admin/cms`, `/admin/reviews`, `/admin/geo` | Existing page, review, and city editors | `cms.manage` |
| `/admin/analytics` | Reports home. It says revenue totals are not connected | `analytics.read` |
| `/admin/growth` | Rewards hub. It also links to promotions and offers | Reward permissions, plus store and sub for offers |
| `/admin/bonus-transactions` | Redirects to `/admin/transactions?wallet=bonus` | Existing redirect |

There is no separate SMS campaign page, no marketing analytics dashboard, and no second campaign system. Bonus history is a redirect, not a bonus editor.

## 2. Existing features preserved

- Email campaigns still call `upsertNewsletterCampaignAction`, `deleteNewsletterCampaignAction`, and `NewsletterSendControls`. Test send, Send now, and Schedule keep their existing confirmations.
- One-time offers still call `sendOfferAction`. That button still has no second confirmation. The label says so.
- Text one player still uses the promo card and `AdminPlayerFollowupCard`. Copy and WhatsApp stay as they were.
- Telegram still mounts the autopilot card, the tester, the broadcast card, and the image card.
- In-app notices still mount `BroadcastComposer` and still read `broadcasts`.
- Promotions still use `PromotionFormDialog` and `deletePromotionAction`, including the existing delete confirmation.
- Automation still calls `loadAutomationHealth` and still links to the AI blog, the chatbot, and the analyzer.
- The AI blog still mounts `AIBlogGeneratorCard` and still loads 10 posts. Opening the page does not generate one.
- The chatbot still mounts `AdminAiBotControlCard` and still reads the same log query.
- The website hub still links to `/admin/cms`, `/admin/games`, `/admin/reviews`, and `/admin/geo`.

## 3. Marketing channels inspected

- Email uses the existing Resend path inside the newsletter and offer actions. The automation page shows whether `RESEND_API_KEY` is present. The value stays hidden. This phase did not call Resend.
- SMS uses the existing Twilio path inside offers. The automation page shows Twilio as present only when the account id, auth token, and from-number are all set. Values stay hidden. Text one player does not send a bulk SMS.
- Telegram shows whether the bot token and admin chat are set. `isTelegramConfigured` only reads those environment values. It does not call Telegram. The admin chat id is no longer printed. The token was already hidden.
- In-app notices go through the existing `send_broadcast` function. That function keeps banned players out and requires `notification_preferences.inapp_announcements`. The function was not edited.
- Offer eligibility still requires promotional email or marketing SMS to be on, and still skips suspended and banned players. Newsletter sends still leave out suspended players and promotional-email opt-outs. Those rules were not changed.

## 4. Automation functionality

Saved job states are `off`, `not_scheduled`, `unknown`, `stale`, and `ok`. The screen explains each one. There is no separate running or failed job status. Email campaigns have their own `scheduled`, `sending`, and `failed` marks, and those stay on the email page.

The jobs shown are the existing search index, AI blog, Telegram autopilot, and support chatbot. The search index still says the app does not store its last successful call. Counts for failed webhooks, failed email campaigns, waiting email campaigns, and cash outs that need a person still come from the existing health loader. This page does not run a job or pay a cash out.

## 5. UI improvements

- Marketing, automation, and the website hub use the navy cards and the same link gates.
- Email campaigns, promotions, and the newest blog posts use navy tables, status badges, and a plain-language line for each stored status.
- Loading skeletons were added for the restyled routes.
- Empty and error states cover a missing campaign list, a missing promotion list, a missing blog list, a missing notice history, and a chatbot log that cannot be loaded.
- Send, schedule, generate, and Telegram buttons are described as the actions that deliver or publish. Opening the page is described as viewing.
- The published-post number now says it counts published rows among the 10 newest posts loaded on that page.

## 6. Files changed

- `src/lib/admin/marketing-status.ts`
- `src/components/admin/ui/admin-status-badge.tsx`
- `src/components/admin/offer-send-form.tsx`
- `src/app/admin/marketing-center/page.tsx`
- `src/app/admin/marketing-center/loading.tsx`
- `src/app/admin/marketing/page.tsx`
- `src/app/admin/marketing/loading.tsx`
- `src/app/admin/newsletters/page.tsx`
- `src/app/admin/newsletters/loading.tsx`
- `src/app/admin/telegram/page.tsx`
- `src/app/admin/telegram/loading.tsx`
- `src/app/admin/notifications/page.tsx`
- `src/app/admin/notifications/loading.tsx`
- `src/app/admin/promotions/page.tsx`
- `src/app/admin/promotions/loading.tsx`
- `src/app/admin/offers/page.tsx`
- `src/app/admin/offers/loading.tsx`
- `src/app/admin/automation/page.tsx`
- `src/app/admin/automation/loading.tsx`
- `src/app/admin/ai-blog/page.tsx`
- `src/app/admin/ai-blog/loading.tsx`
- `src/app/admin/ai-bot/page.tsx`
- `src/app/admin/ai-bot/loading.tsx`
- `src/app/admin/content/page.tsx`
- `src/app/admin/content/loading.tsx`
- `scripts/marketing-center-ui.test.mjs`
- `ADMIN_V2_PHASE2E_REPORT.md`

## 7. Tests passed

- `npx tsc --noEmit` — exit 0
- `node scripts/marketing-center-ui.test.mjs` — passed
- `node scripts/admin-nav-v2.test.mjs` — passed
- `node scripts/staff-access.test.mjs` — passed
- `node scripts/newsletter-consent.test.mjs` — passed
- `node scripts/offers.test.mjs` — passed
- `node scripts/blog-links.test.mjs` — passed
- `node scripts/automation-health.test.mjs` — passed
- `npx next build` — exit 0

The marketing UI test checks that the hub links and permission gates remain, email actions stay on the existing controls, offers still call `sendOfferAction` without a new confirmation, Telegram no longer prints the admin chat id, and the automation page still loads saved health without a new fetch.

## 8. Tests failed

None of the checks in section 7 failed.

## 9. Unverified behavior

- Signed-in browser use is NOT VERIFIED. A live staff session was not opened.
- No test email, SMS, Telegram message, in-app notice, or blog post was sent.
- No automation job was run.
- The production site was not deployed.
- No SQL was run.

## 10. Remaining risks

- Send on one-time offers still delivers on the first click. The label states that. A confirmation was not added, because the button did not have one.
- The AI blog generate control can still publish through its existing action. This phase did not click it.
- The Telegram tester, broadcast, and autopilot controls can still post when their existing buttons are clicked. This phase did not click them.
- A promotion query error still looks like an empty list. That behavior was already there.
- Chat log failures no longer show the raw database message. The page says the logs could not be loaded.
- The CMS, review, and city editors were inspected and left as they are, so their publish and edit controls were not restyled.
- The rewards hub and the bonus-history redirect were inspected and left as they are. Bonus history is not a separate ledger screen.
- The reports page is not a marketing analytics dashboard. Revenue totals are still described there as not connected.
- Provider names on the automation page include payment and cron settings. Only present or missing is shown. The values stay hidden, and this page does not call those providers.
