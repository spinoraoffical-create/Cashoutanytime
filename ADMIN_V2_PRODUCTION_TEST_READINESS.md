# Production test readiness

Date: 14 October 2026. Branch `admin-v2-development`. HEAD `55a999017407bd70682b7dd25c131c5c0c3c1172`.

This pass did not commit, push, merge, deploy, run SQL, change environment variables, or modify a player record.

The owner will test on the existing Supabase project and the existing Vercel project. No second project is required. The production database holds real registered players. Every write in this test is limited to the owner’s own 2–3 accounts. Other players, their balances, transactions, game loads, and identity records stay as they are.

## 1. Release state

The public site is still the known Phase 2D production deploy. This working tree is not on that deploy. A git deploy of `55a9990` does not include the uncommitted Phase 2G–3D work.

Local admin pages that use the existing `.env.local` talk to the live database. Looking at a screen can be safe. Saving, approving, paying, loading a game, sending, or publishing from that local app writes production data.

Release remains **not ready to deploy**. This document is the test boundary for the current site and for a careful local check. It does not approve a deploy.

## 2. Accounts

Before any click that saves, write down the 2–3 accounts in this test. Use only those emails.

Every later write must show one of those emails on the screen. A row for any other person is view-only. Close it without saving.

Do not ban, delete, move, reset a password, change roles, adjust a wallet, mark a deposit, complete a game load, or decide an identity check for anyone outside that list.

## 3. Safe to open

These checks stay read-only on both the live site and the local admin app.

### Player side, signed in as one of the 2–3 accounts

| Area | What to do | Expected result |
| --- | --- | --- |
| Login | Sign in and open the dashboard | That account’s own profile loads. |
| Profile | Open the profile page | Name, email, and balances match that account. Do not save unless section 4 allows it. |
| Games | Open the public game list | Inactive games stay hidden. Do not start a load. |
| Wallet | Open deposits and cash-outs | Past rows for this account are visible. Do not start a payment. |
| Support | Open the chat page | Do not send a message. |
| Rewards and offers | Open the screens | Do not redeem or opt into a send. |

### Admin side, signed in as the owner

| Area | What to do | Expected result |
| --- | --- | --- |
| Dashboard | Open `/admin` | Numbers that load are the live totals. A card that says Unavailable stays Unavailable. Do not treat that as zero. |
| Player CRM | Open the list | Other players may appear. Do not move, credit, or suspend them. |
| Financial Center | Open deposits and cash-outs | Other players’ rows may appear. Do not mark, reject, or pay them. |
| Game Center | Open game loads | Do not press Complete, Failed, or Cancel on any row. |
| Store management | Open the store list | Do not activate, deactivate, edit, or reset a password. |
| KYC | Skip the review queue for this pass | Opening it can place other players’ pending documents on the page. Do not open those files. |
| Marketing | Open offers, newsletters, and the AI blog | Do not press Send, Publish, or Broadcast. |
| CMS | Open pages, FAQ, reviews, and city pages | Do not create, publish, or press Generate all states. |
| Support | Open the ticket list | Do not open another person’s thread. Selecting a thread can mark that person’s messages read. |
| Security | Open the security screen | Do not ban or flag another person. |
| Roles | Open a user only from the 2–3 account list | Do not change roles in this pass. |

## 4. Writes allowed on the 2–3 accounts

Use these only while signed in as one of those accounts, and only when the saved row is that same account.

- Change that account’s display name, then change it back.
- Sign out and sign in again.
- Open that account’s own wallet history.

Leave these unpressed even for those accounts during this pass:

- Deposit checkout and Paydora webhook replay. The live Paydora account is attached to this project.
- Cash-out, mark paid, wallet adjustment, and coin or XP grants.
- Game load, Complete, Failed, and Cancel. Those paths can call a live game portal or a refund.
- Identity upload, approve, and reject.
- Store create, password reset, and player move.
- Support reply, offer send, newsletter, Telegram, and AI publish.

A later pass can add a single $1 check on one of these accounts only after the owner names that account and asks for that check. This document does not start it.

## 5. Actions that reach other players

Do not press these on the live site or on the local app. Each one can change people outside the 2–3 accounts, send a message, or publish:

- Offer send, newsletter send, Telegram broadcast, Telegram autopilot
- Generate all states, publish FAQ, publish a review, publish a blog post
- Bulk store activate or deactivate
- Any deposit, cash-out, game-load, ban, delete, or role control on a row whose email is not one of the 2–3
- Cron routes under `/api/cron/*`
- Paydora create, payout, and webhook URLs
- Admin autopilot

The existing Vercel cron for `/api/cron/seo-index` stays as it is. Do not change its schedule and do not call it by hand.

## 6. Database files

These files stay unapplied:

- `supabase/migrations/20261014000160_admin_decide_kyc.sql`
- `supabase/migrations/20261014000170_profiles_last_seen_at_index.sql`

The identity screen still uses two writes. Do not approve or reject a submission while that is true.

`profiles.last_seen_at` is missing on the database that rejected the earlier index statement. That statement created nothing. Players seen today can stay Unavailable. Do not run the corrected file in this test. Adding the column would change the live table for every profile.

Do not run any other SQL. Do not edit a balance, transaction, game load, or identity row in the Supabase table editor.

## 7. Environment

Use the existing Vercel project and the existing Supabase project. Do not create a new project. Do not change Vercel or local environment variables. Do not rotate keys. Do not print secrets.

The local app and the public site share that database. A local save is a production save.

## 8. Stop conditions

Stop the test if any of these happen:

- A screen shows an email outside the 2–3 accounts and a save button was already clicked.
- A balance, deposit, game load, or identity status changes for anyone else.
- A send, publish, or provider action starts.
- The dashboard replaces a failed count with 0.
- An identity decision says it saved when the profile status did not change, or the reverse.

If a stop condition is only a wrong click on one of the 2–3 accounts, leave it and record the screen. Do not “fix” it by editing another player or by running SQL.

## 9. What remains before a deploy

- The owner finishes the read-only pass in section 3 on the live site.
- The owner finishes the same pass on the local Admin 2.0 app, still limited to the 2–3 accounts.
- The owner names any write from section 4 that was actually performed.
- The two SQL files are still a separate decision. They are not part of this test.
- A deploy still needs a separate owner request. The production site stays on the current deploy until then.

## 10. Rollback

There is nothing to roll back from this pass. No deploy and no SQL were run.

If a later deploy is requested and then must be undone, return production to the known Phase 2D deploy. Do not drop the identity function or the players-seen column unless they were applied in that later request. Do not reverse another player’s balance to undo a test.

## Final safety check

- Existing Supabase and Vercel projects stay in place.
- No new project was created.
- No environment variable was changed.
- No SQL was executed.
- No other player’s balance, transaction, game load, or identity record was modified.
- No commit, push, or deployment occurred.
