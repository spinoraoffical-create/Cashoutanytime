# Feature dependency matrix

Branch `restore/public-game-catalog`. Local HEAD `b6afbc6bee32b912e6c9d97aaa732ef47073c13c`. The restoration edits are uncommitted because this PC has no Git author configured.

The new database is `zecitlewsynyioemsqna`. The old project was not contacted.

| Feature | Page | Server path | Database | Permission | External service | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Public game list | Home, `/play`, wallet deposit | `getGames` then `buildLobbyCatalog` | `games` where `is_active` | Public read of active games | None | VERIFIED WORKING in the new database: 12 active rows. The live page was not opened in a browser. |
| Game categories | Admin games, catalog joins | Category lookup | `game_categories` | Public read | None | VERIFIED WORKING in the new database: 5 categories. |
| Game account create | Game page | `requestGameAccountCreate` | `game_load_requests`, `games` | Signed-in player. API must be configured first. | Provider agent login | CONFIGURATION MISSING. Code refuses with “This game is not connected yet.” before any wallet debit. |
| Wallet to game load | Game page | `request_game_load` then provider call | `profiles` wallet columns, `game_load_requests` | Player owns the account. Service role completes it. | Provider agent login | CONFIGURATION MISSING. NOT TESTED against a provider. |
| Game to wallet redeem | Game page | Redeem action then `complete_game_load` | Wallet credit only after provider success | Player plus service role | Provider agent login | NOT TESTED. Wallet is not credited from a typed amount. |
| Stale load | Called before a new load | `fail_my_stale_game_load` | `fail_stale_game_loads` | Service role only | None | TESTED LOCALLY. Holds the row and does not refund. Not applied to the hosted database. |
| Deposit | `/dashboard/deposit` | `/api/payments/paydora/create` | `payment_intents` | Signed-in player. Restricted states rejected. | Paydora | CONFIGURATION MISSING. No live call. |
| Deposit webhook | Paydora calls the site | `/api/payments/paydora/webhook` | `credit_paydora_deposit` | Signature required | Paydora | CODE PRESENT. NOT TESTED live. Secret missing fails closed. |
| Cash out | Wallet cash-out form | `/api/payments/paydora/payout` | Payout reservation RPCs | Signed-in player, KYC approved, rate limit | Paydora | CODE PRESENT. NOT TESTED live. |
| Wallet balances | Wallet page | Profile read | `wallet_balance`, `bonus_wallet`, `cashout_wallet` | Owner read. Writes are service role. | None | Earlier local package tests passed. Not re-run against hosted. |
| Signup | `/register` | `supabase.auth.signUp` with `emailRedirectTo` | `auth.users`, profile trigger | Public signup | Supabase Auth email | CODE DEFECT fixed in the screen copy. Delivery is CONFIGURATION MISSING. |
| Login code | OTP form | `signInWithOtp` | Supabase Auth | Rate limit | Supabase Auth email | Separate from signup. NOT TESTED. |
| Super Admin | `/admin` | `user_roles` key `super_admin` | `user_roles`, `roles` | Role row, profile stays `customer` | None | Owner reports the Preview login works. Not re-tested here. |
| Staff and store | Admin sections | `getStaffContext`, `getAgentScope` | `user_roles`, `role_permissions` | Role catalog from the install | None | NOT TESTED with a store login. |
| Rewards | Rewards page | `claimRewardAction` | `claim_reward` service role | Signed-in player, freeplay check | None | Uncommitted fix calls the service role with the signed-in user id. NOT TESTED live. |
| Promotions | Promotions | `claimPromotionAction` | `claim_promotion` service role | Signed-in player | None | Same service-role fix. NOT TESTED live. |
| KYC | Verification screens | KYC upload and review | `kyc` tables, private bucket | Owner or staff | None | NOT TESTED. |
| Live chat and tickets | Support, admin chat | Chat and ticket routes | Messages, tickets | Participant or staff | None | NOT TESTED in the browser. |
| Resend email | Admin and offers | `src/lib/email/resend.ts` | Optional templates | Server only | Resend | CONFIGURATION MISSING until `RESEND_API_KEY` is set. |
| Twilio SMS | Offers and STOP | `src/lib/offers/send.ts` | Opt-out route | Server only | Twilio | CONFIGURATION MISSING. |
| Telegram | Admin telegram | `src/lib/telegram` | None required to load the page | Server only | Telegram | CONFIGURATION MISSING. |
| AI blog and SEO | Admin AI blog | Blog generator and `/api/cron/seo-index` | Posts table | Cron secret for the job | OpenRouter, OpenAI, or Gemini | CONFIGURATION MISSING. Only the SEO job is scheduled, and only on Production. |
| NOWPayments | None | No source file | None | None | None | NOT IMPLEMENTED. |

A missing row is not a missing table. A missing provider password is not a code defect.
