# Admin v2 feature inventory

Date: 13 October 2026. Every existing admin route stays. This list is the map for the new sidebar. Permissions below are the menu gates. Each page still enforces its own check.

Preservation test for every row: the URL still exists, the page file was not replaced, and the menu item is hidden when the permission or role does not match.

| Route | Purpose | Current functionality | Permission | Depends on | Navigation category |
| --- | --- | --- | --- | --- | --- |
| `/admin` | Owner home | Live counts, queues, activity | Any staff. Stores and subs see their own home instead | Profiles, deposits, loads, tickets, KYC, automation | Dashboard |
| `/admin/users` | All players | Search and open player records | `users.manage` | Profiles | Player CRM |
| `/admin/users/[id]` | One player | Profile, notes, and existing wallet tools | `users.manage` plus scope | Profiles | Player CRM |
| `/admin/players` | Network players | Players under a store or sub | `users.manage` or store/sub role | Agent scope | Player CRM |
| `/admin/crm` | CRM | Follow-up list | `users.manage` | Profiles | Player CRM |
| `/admin/support` | Tickets | Super Admin ticket inbox | Super Admin. Hidden from store and sub | Tickets | Player CRM |
| `/admin/support/[id]` | One ticket | Ticket thread | Super Admin | Tickets | Player CRM |
| `/admin/chat` | Live chat | Staff chat inbox | `support.manage`. Hidden from store and sub | Chat | Player CRM |
| `/admin/deposits` | Deposits | Review deposit records | `requests.manage` or store/sub role | Deposit requests | Financial Center |
| `/admin/game-loads` | Loads and redeems | Wallet load queue | `requests.manage` | Game load requests | Financial Center |
| `/admin/failed-loads` | Failed loads | Failed load list | `requests.manage` or store/sub role | Game load requests | Financial Center and Game Center |
| `/admin/payouts` | Cash outs | Payout queue | `requests.manage` | Payout requests | Financial Center |
| `/admin/transactions` | All transactions | Transaction list | `requests.manage` | Wallet transactions | Financial Center |
| `/admin/cashout-holds` | Held cash outs | Holds waiting for a person | `requests.manage` | Cash-out holds | Financial Center |
| `/admin/requests` | Deposit records | Older deposit record view | `requests.manage` or store/sub role | Deposit requests | Financial Center |
| `/admin/money` | Money hub | Links into the money tools | `requests.manage` | None beyond the child pages | Financial Center |
| `/admin/games` | Games list | Turn games on and edit public game info | `cms.manage` | Games | Game Center |
| `/admin/game-accounts` | Game accounts | Accounts for the network | `requests.manage` or store/sub role | Game accounts | Game Center |
| `/admin/game-balances` | Live game coins | Super Admin coin view | Super Admin | Game balance reader | Game Center |
| `/admin/agents` | Store hub | Store tools home | `users.manage` | Agent accounts | Store Center |
| `/admin/sub-creators` | Stores and subs | Create and list stores | `users.manage` or store role | Agent accounts | Store Center |
| `/admin/agent-inbox` | Player chat for a creator | Messages for that creator's players | Super Admin, store, or sub | Agent messages | Store Center |
| `/admin/agent-reports` | Agent reports | Report for the signed-in scope | Super Admin, store, or sub | Agent scope | Analytics Center |
| `/admin/newsletters` | Email campaigns | Draft and send opted-in email | `newsletters.manage` | Newsletter tables | Marketing Center |
| `/admin/marketing` | Text one player | SMS to one player | `cms.manage` | SMS provider | Marketing Center |
| `/admin/telegram` | Telegram | Channel tools | `cms.manage` | Telegram | Marketing Center |
| `/admin/notifications` | In-app notices | Broadcasts | `notifications.broadcast` | Notifications | Marketing Center |
| `/admin/promotions` | Promotions | Promotion records | `promotions.manage` | Promotions | Marketing Center |
| `/admin/offers` | One-time offers | Send an offer | Super Admin, store, or sub | Offers | Marketing Center |
| `/admin/marketing-center` | Marketing hub | Links into marketing tools | Marketing permissions | Child pages | Marketing Center |
| `/admin/automation` | Automation home | Job health. It does not send or pay | Operator with `cms.manage` or `support.manage` | Automation health | Automation Center |
| `/admin/ai-blog` | AI blog | Blog generator settings | `cms.manage` and operator | Blog settings | Automation Center |
| `/admin/ai-bot` | Support chatbot | Chatbot settings | `support.manage` and operator | Chatbot settings | Automation Center |
| `/admin/analyzer` | Analyzer | Existing analyzer page | Operator | Analyzer | Automation Center |
| `/admin/growth` | Rewards hub | Links into rewards | `promotions.manage` or Super Admin | Child pages | Rewards Center |
| `/admin/referrals` | Referrals | Referral review | `referrals.manage` | Referrals | Rewards Center |
| `/admin/vip` | VIP | VIP tiers | `vip.manage` | VIP | Rewards Center |
| `/admin/rewards` | Rewards | Reward rules | `rewards.manage` | Rewards | Rewards Center |
| `/admin/achievements` | Achievements | Achievement rules | `achievements.manage` | Achievements | Rewards Center |
| `/admin/leaderboards` | Leaderboards | Leaderboard tools | `leaderboards.manage` | Leaderboards | Rewards Center |
| `/admin/bonus-transactions` | Bonus history | Bonus rows | `rewards.manage` | Bonus transactions | Rewards Center |
| `/admin/kyc` | Identity check | Review ID files | `kyc.manage`. Super Admin passes. Stores do not | KYC submissions, private bucket | Verification Center |
| `/admin/fraud` | Fraud flags | Fraud list | Super Admin | Fraud scores | Security Center |
| `/admin/security` | Security | Security tools | Super Admin | Security data | Security Center |
| `/admin/audit` | Audit log | Staff audit trail | Super Admin | Audit logs | Security Center |
| `/admin/analytics` | Reports home | Existing reports page | `analytics.read` | Report data | Analytics Center |
| `/admin/player-transactions` | Player transactions | Scoped transaction report | Super Admin, store, or sub | Transactions | Analytics Center |
| `/admin/settings` | Site settings | Site-wide settings | `settings.manage` | Settings | Settings |
| `/admin/payments` | Payment methods | Method display settings | `cms.manage` | Payment settings | Settings |
| `/admin/roles` | Staff roles | Role assignment | `users.roles` | Roles | Settings |
| `/admin/cms` | Pages and FAQ | CMS editor | `cms.manage` | CMS | Settings |
| `/admin/reviews` | Reviews | Moderate reviews | `cms.manage` | Reviews | Settings |
| `/admin/geo` | City pages | City landing pages | `cms.manage` | Geo pages | Settings |
| `/admin/content` | Website hub | Links into website editors | `cms.manage` | Child pages | Settings |

Export routes that stay as they are:

- `/admin/players/export`
- `/admin/player-transactions/export`
- `/admin/sub-creators/export`

Hidden or role-specific behavior that stays:

- Store and sub sessions on `/admin` render the store home, not the owner dashboard.
- Store and sub menus omit `/admin/support` and `/admin/chat`.
- `/admin/kyc` requires `kyc.manage`. Content permission alone does not show it.
- Fraud, security, audit, and live game coins stay Super Admin only.
- Automation stays limited to operators.
