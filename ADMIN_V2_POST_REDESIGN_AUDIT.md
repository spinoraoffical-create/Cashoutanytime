# Admin v2 post-redesign audit

Date: 13 October 2026. Commit `b58fc45547bf8af5b31bf61a79ed31e6162d62ea`.

This is an audit only. No application code, SQL, financial formula, production data, deploy, or push was changed.

The public website was not opened as the signed-in admin. This commit is on GitHub and is not the last production deploy. The checks below are against the commit in the project.

## Features preserved

All 54 admin pages in the app are listed in `ADMIN_V2_FEATURE_INVENTORY.md`. The three export routes are listed there too. Super Admin can reach every tool route from the sidebar:

- Player pages, CRM, tickets, and live chat
- Deposits, loads, failed loads, cash outs, transactions, holds, and deposit records
- Games, game accounts, and live game coins
- Stores, sub-creators, and creator chat
- Email, text, Telegram, notices, promotions, and offers
- Automation, AI blog, chatbot, and analyzer
- Rewards, referrals, VIP, achievements, leaderboards, and bonus history
- Identity check
- Fraud, security, and the audit log
- Reports, player transactions, and agent reports
- Settings, payment methods, roles, pages, reviews, city pages, and the website hub

`/admin/users/[id]` and `/admin/support/[id]` stay off the sidebar. They open from the player list and the ticket list. The export routes stay off the sidebar and open from their parent pages.

The redesign commit touches only the admin shell, navigation, dashboard, shared admin components, and the two admin reports. It does not include payment, wallet, deposit, withdrawal, refund, game-provider, migration, or authentication files.

## Broken features

No missing route was found. Every inventory tool has a page, and the production build still emits every admin route.

One label does not match its destination. On the owner dashboard, the card "Failed webhooks" links to `/admin/failed-loads`. That page is the failed game-load list. The link itself loads. It does not open a webhook list. This link was already pointed there before the redesign.

## Permission problems

Server permission checks were not edited in this commit. `can()`, `authorize()`, and the page gates are the same functions as before.

Menu results, using the seeded role permissions plus `requests.manage` for Admin and `newsletters.manage` for Admin and Manager:

- **Super Admin** sees all 12 groups, including Verification Center and Security Center.
- **Admin** sees Dashboard, Player CRM, Financial Center, Game Center, Store Center, Marketing Center, Automation Center, Rewards Center, Analytics Center, and Settings. Admin does not see tickets, live game coins, fraud, security, or the audit log. Admin does not see Verification Center because `kyc.manage` is not in the role seed. Identity review stays Super Admin only.
- **Manager** sees Dashboard, Game Center, Marketing Center, Automation Center, Rewards Center, Analytics Center, and Settings. Manager does not see player lists, money tools, stores, identity review, or security.
- **Support agent** sees Dashboard and Live chat. Tickets stay Super Admin only.
- **Moderator** sees Dashboard, player tools, live chat, and store/sub-creator management.
- **Store Creator** sees Dashboard, network players, deposits, failed loads, deposit records, game accounts, store tools, creator chat, one-time offers, player transactions, and agent reports. Store Creator does not see tickets, live chat, identity photos, fraud, cash-out processing, or settings.
- **Sub-Creator** sees the same money and player links as a store, plus creator chat. Sub-Creator does not see the store/sub-creator management link.

A store or sub session on `/admin` still returns the store home before the owner dashboard queries run. Those queries do not load for that session.

The dashboard identity list selects player name and status only, and only when `kyc.manage` passes. It does not select the ID file. System-health lines are Super Admin only and say whether a key is configured. They do not print the key. Sidebar search filters the links already allowed for that person.

## Visual problems

The approved dashboard image is not in the project, so a pixel comparison was not possible.

From the code, the shell matches the written direction: navy background `#070b18`, sidebar `#0b1022`, purple-to-blue active item, cyan highlights, rounded cards, a three-bar count chart, tables, status badges, and quick-action tiles.

Differences from a full premium dashboard:

- Inner management pages still use their older cards. Only the shell, headers, section tabs, and the owner dashboard use the new look.
- The chart is three count bars. It is not a multi-series money chart.
- Below 1024px the sidebar is hidden and a menu button opens it. A tablet does not get a second sidebar layout.
- Wide tables scroll sideways on a narrow screen. They are not squeezed into unreadably small columns.
- Signed-in screenshots at desktop, tablet, and mobile widths were not captured. Admin requires a staff login, and this commit is not what the public site is serving.

## Owner dashboard

- Counts come from live queries: deposit records, cash-out debit rows, profiles, game loads, tickets, identity submissions, stores, and automation job status.
- A missing query shows **Unavailable**. The page does not substitute zero.
- Labels say completed deposit counts and new player counts. They do not call that revenue.
- Cash-out today is a count of cash-out debit rows, not a dollar profit.
- Recent wallet rows show the stored amount. Failed game-load amounts are shown as the stored number, without a dollar sign.
- Quick actions point at `/admin/deposits?status=pending`, `/admin/payouts`, `/admin/users`, `/admin/support`, `/admin/kyc`, and `/admin/analytics`. Each route exists. The deposits page reads the `status` query. Each action is shown only when that person's existing permission allows it.

## Test results

Passed:

- `node scripts/admin-nav-v2.test.mjs`
- `node scripts/auto-money.test.mjs`
- `node scripts/kyc-upload.test.mjs`
- `node scripts/staff-access.test.mjs`
- `node scripts/financial-trust.test.mjs`
- `node scripts/admin-list-scope.test.mjs`
- `npx tsc --noEmit`
- `npx next build` (existing image and hook warnings, exit 0)

Failed: none in this run.

## Remaining risks

- The public site does not yet serve this commit.
- No staff member clicked through the live dashboard during this audit.
- `kyc.manage` is still not seeded, so a normal Admin cannot open identity review.
- The "Failed webhooks" card still opens failed game loads.

## Recommended fixes

1. Rename the webhook card, or point it at a real webhook list, before calling that card accurate.
2. After a staff login, capture the dashboard at desktop, tablet, and phone widths and compare those shots with the reference image.
3. Put the reference image in the project before the next visual pass.
4. Leave `kyc.manage` ungranted until the owner wants someone besides Super Admin to open ID photos.
5. Restyle the inner pages in a later phase. Do not change their actions while doing that.
