# Sweepstakes Hub — new Supabase installation plan

Status: waiting for owner approval. No SQL has been applied. The old project was not modified. Production Vercel was not modified. Nothing was deployed.

Allowed target, and the only target any later script may use:

`zecitlewsynyioemsqna`

Forbidden target:

`muetgtzcbecsqigtpfyn` (the backup is linked to this project)

The installer must read the project reference from the database URL and stop if it is not exactly `zecitlewsynyioemsqna`. This inspection did not connect to either database.

## What was inspected

- 91 files in `supabase/migrations`
- Overlapping SQL in `supabase/archive` (must not be applied as a second pass)
- `C:\supabase-backup\schema.sql` (structure only, 167,819 characters, no `INSERT` or `COPY`)
- `C:\supabase-backup\extensions.sql` (Supabase platform internals)
- `C:\supabase-backup\roles.sql` (statement timeouts for `anon`, `authenticated`, `authenticator`)
- Table names inside `data.sql` and `auth-data.sql` (headers only). Row values were not read and will not be imported.
- Application queries, storage buckets, Realtime subscriptions, auth, payments, games, chat, and marketing
- `C:\supabase-migration-test` already contains player-data files. Those files must not be applied.

The backup link file names `muetgtzcbecsqigtpfyn`. That confirms the dump source. It is read-only.

## Do not apply these files

| File | Why |
| --- | --- |
| `extensions.sql` | Platform event triggers owned by `supabase_admin`. A new project already has them. Applying this file can fail or replace managed objects. |
| `schema.sql` as a raw script | It creates extensions, changes publication ownership, and still cannot sign a user up. See blockers below. |
| `data.sql` | One file mixes auth users, player profiles, balances, messages, KYC, and storage object rows. |
| `auth-data.sql` | Auth users, sessions, tokens, and identities. |
| `C:\supabase-migration-test\public-data-only.sql` | Player and money rows. |
| `C:\supabase-migration-test\local-public-restore.sql` | Player and money rows. |
| `C:\supabase-migration-test\auth-users-identities-only.sql` | Auth identities. |
| `C:\supabase-backup\storage\` | Player avatars, chat deposit proofs, and KYC files. Do not upload them. |
| `supabase/archive\*` and `supabase/archive/ALL-MIGRATIONS-COMBINED.sql` | Older copies of the same objects. A second pass recreates or downgrades functions. |
| Replaying all 91 migrations on the old project, or on a database that already has these objects | Many statements are not safe to run twice. Later files replace money functions. An older file run afterward would restore an older function. |

`roles.sql` is safe to consider later. It only sets role timeouts. It does not copy people.

## What the live database actually contains

`schema.sql` matches the public tables named in `data.sql`. That is the live structure as of the 15 Oct 2026 dump, not the full migration history.

- 48 public tables
- 55 public functions
- 49 row-level security policies
- 38 indexes
- 6 triggers
- Realtime publication entries: `agent_messages`, `conversations`, `deposit_requests`, `messages`
- Extensions named in the dump: `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault` (already present on a new project; do not recreate `supabase_vault` by hand)

Wallet balances are columns on `profiles`. There is no `wallets` table. A new profile starts at zero only when the signup trigger runs.

There is no `pg_cron` schedule in this schema. Scheduled work is `/api/cron/*`, guarded by `CRON_SECRET`. `vercel.json` currently schedules SEO indexing only.

## Migrations that are not the live database

The migration files create 77 tables. These 31 tables are in the migrations and are absent from the live dump:

`achievements`, `announcements`, `banners`, `broadcasts`, `cms_pages`, `contact_messages`, `faqs`, `game_provision_jobs`, `game_server_configs`, `leaderboard_entries`, `ledger_entries`, `notifications`, `payment_methods`, `player_reviews`, `promotion_claims`, `referrals`, `requests`, `reward_claims`, `site_settings`, `spin_history`, `support_tickets`, `telegram_link_codes`, `telegram_links`, `telegram_promo_messages`, `testimonials`, `ticket_messages`, `user_achievements`, `user_favorites`, `vip_history`, `vip_status`, `wallet_ledger`

These 2 live tables are not created by `supabase/migrations`. They come from archive SQL that was applied on the old project:

`deposit_requests`, `kyc_documents`

Replaying the migration folder on an empty project would build a different database from the one that is running. It would also miss objects that exist only in the dump, and it would include seed rows that point at `spinoracasinos.com`.

## Blockers inside the live schema

These must be fixed in a small supplement. They are not a reason to replay every migration.

1. Signup will fail if only `schema.sql` is applied. `handle_new_user` calls `public.generate_referral_code()` and inserts into `public.referrals`. Neither object is in the dump. The function body was saved with `check_function_bodies` off, so Postgres allowed the broken reference.
2. The signup trigger `on_auth_user_created` sits on `auth.users`. A public-schema dump does not include it. Without that trigger, a new Auth user gets no profile.
3. `protect_profile_columns()` exists, but its trigger is not one of the six triggers in the dump. A secure install should attach it. Otherwise a signed-in user can update protected profile columns directly.
4. Storage policies and bucket rows are not in `schema.sql`. The app uses `avatars`, `kyc-documents`, `cms-media`, `ticket-attachments`, `payment-proofs`, and `chat-attachments`. The chat policy in `supabase/archive/chat-attachments.sql` allows staff only when `profiles.role = 'admin'`. New accounts are forced to `customer`. That policy must use `public.is_staff()` instead.
5. `is_admin()` is true only when `profiles.role = 'admin'`. `profiles_force_customer_role` forces every new profile to `customer`. Staff access is a `user_roles` row. Server code that uses the service role still works. Browser policies that call `is_admin()` will not treat the new super admin as an admin.
6. Realtime is only published for four tables. The app also listens to `game_load_requests`, `game_accounts`, `wallet_transactions`, `profiles`, `cashout_holds`, and `webhook_events`. Those tables exist and should be added to `supabase_realtime`. `notifications` and `ticket_messages` are subscribed to in the app and do not exist in the live dump.
7. Catalog rows (games, roles, VIP tiers, geo pages, promotions, blog posts) live inside `data.sql` next to player rows. They cannot be imported by loading that file. Copying them needs a separate, approved filter that skips every personal table and skips any column that holds an API key or agent password.
8. This session did not open a connection, so it has not proven that `zecitlewsynyioemsqna` is empty. `C:\supabase-migration-test\new-project-schema.sql` is only the default empty `public` grants. The installer must stop if that project already has player or money rows.

## Application features the live dump does not support

These screens and RPCs are in the cloned website and are absent from the live dump. Installing the dump alone leaves them broken.

| Feature | Missing objects |
| --- | --- |
| Signup referral row | `referrals`, `generate_referral_code()` |
| Notifications bell | `notifications`, `create_notification` |
| Achievements | `achievements`, `user_achievements` |
| CMS, banners, FAQs, testimonials, reviews | `cms_pages`, `banners`, `faqs`, `testimonials`, `player_reviews`, and the separate `reviews` table in `supabase/archive/reviews.sql` |
| Payment method admin | `payment_methods` |
| Site settings and Telegram promo copy | `site_settings`, `telegram_promo_messages`, `telegram_links` |
| Leaderboard job | `leaderboard_entries`, `compute_leaderboard` |
| Support tickets | `support_tickets`, `ticket_messages` |
| VIP status used by newsletter audience and the VIP admin page | `vip_status` |
| Game server rows | `game_server_configs` (provider secrets stay in server env, not in copied rows) |
| Admin delete, CRM stats, broadcasts | `admin_delete_user_account`, `admin_crm_overview_stats`, `admin_user_deposit_stats`, `send_broadcast`, `admin_broadcast_to_all_users`, `claim_promotion`, `public_profiles_by_ids`, `public_profiles_top`, `calculate_level` |
| Player game-request form | Code queries `game_requests`. No migration creates that table. The older table name is `requests`. This form needs a decision before install. |

Money, chat, deposits, game loads, KYC, Paydora reservation, and wallets are in the live dump and do not depend on those extra tables.

## Recommended install, after approval

One controlled runner. Stop on the first error. Do not continue into data import.

1. Refuse to run unless the database URL host contains `zecitlewsynyioemsqna` and does not contain `muetgtzcbecsqigtpfyn`.
2. Refuse to run if `public.profiles` already has rows, or if `auth.users` is not empty.
3. Apply a cleaned copy of `schema.sql`:
   - keep tables, types, functions, indexes, policies, grants, and the six existing triggers
   - drop the extension block and the publication owner change
   - do not load `extensions.sql`
4. Apply one supplement, reviewed in this repo before it is run:
   - `generate_referral_code()` from `supabase/migrations/20260613000003_profiles.sql`
   - empty `referrals` table from the migration that creates it
   - `on_auth_user_created` calling the dump's `handle_new_user`
   - `trg_profiles_protect` on `protect_profile_columns`
   - storage buckets and policies, with chat attachments using `is_staff()`
   - Realtime `ADD TABLE` for the existing tables the app already listens to
5. Leave auth empty. No player rows. No balances. No messages. No KYC files.
6. Owner creates the first login in the new project's Auth screen, or on a local site pointed at the new project only.
7. A one-time local script inserts one `user_roles` row for `super_admin`. It asks for the email at run time, requires exactly one matching new auth user, and refuses a second grant. No password is stored in the repo.
8. A second registration is checked to prove `profiles.role` stays `customer` and that user has no staff role.

Catalog seed (games, roles, geo, VIP, blog) is a separate approval. It will be generated by filtering `data.sql` to named configuration tables, omitting secret columns, and omitting every personal table. It will not run in the same step as the schema.

### Feature tables

Default recommendation: add the missing feature tables and the latest function bodies from `supabase/migrations`, empty of players, so the cloned website matches its code.

Alternative, if you want the new project to match the old database and nothing more: skip that list. Achievements, CMS, payment-method admin, leaderboards, ticket threads, and the notification bell will error until those objects exist.

Reply with which of those two you want. The installer will not guess.

## First admin

There is no password in source and no public promotion page.

`profiles.role` stays `customer`. Admin access is the `user_roles` row. `20261008000140_customer_signup_role.sql` names one email and deletes other admin role rows. That file must not be replayed after real staff exist. On an empty project, before any user exists, it changes nothing. The supplement will not include that delete.

## Configuration that must be replaced

Do this in a new local env file after approval. Do not edit production Vercel in this step. Do not point the new project at Spinora webhooks.

| Item | New value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://zecitlewsynyioemsqna.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | New project's anon key only. Browser-safe. |
| `SUPABASE_SERVICE_ROLE_KEY` | New project's service role. Server only. |
| `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` | `https://www.sweeptakehub.com` for a real host. `http://localhost:3000` for local tests. |
| Auth Site URL | `https://www.sweeptakehub.com` and `http://localhost:3000` |
| Auth redirect allow-list | `/auth/callback` |
| Google provider | Enable in the new project. Authorized redirect includes `https://zecitlewsynyioemsqna.supabase.co/auth/v1/callback` |
| Resend | New server key. From-address should be a Sweepstakes Hub domain before go-live. Code still defaults to `noreply@spinoracasinos.com` and reply-to `support@spinoracasinos.com`. |
| Twilio | New SID, token, and from-number. No SMS during tests. |
| Telegram | New bot token and chat IDs. Do not reuse Spinora chats. Code falls back to `https://spinoracasinos.com` when `NEXT_PUBLIC_SITE_URL` is empty. |
| Paydora | New API key and webhook secret. Webhook URL `https://www.sweeptakehub.com/api/payments/paydora/webhook`. Do not point the Spinora store here. |
| NOWPayments | New API key and IPN secret. IPN URL `https://www.sweeptakehub.com/api/payments/nowpayments/webhook`. |
| Game providers | Separate agent logins. Leave them unset until those accounts exist. Sharing Spinora agent accounts mixes the two sites. |
| `CRON_SECRET` | New random value. Do not enable newsletter, Telegram, or AI crons until you ask. |
| AI keys | Not required for human chat. Blog generation stays off. |
| `SPINORA_BOT_SENDER_ID` | Leave unset. The env name is historical. Do not copy the old sender id. |

Old project reference `muetgtzcbecsqigtpfyn` must not appear in the new env file.

Spinora names that remain in source, and are a later content pass rather than part of the database install:

- `src/lib/email/resend.ts`, `src/lib/email/deliverability.ts`, `src/lib/notifications/welcome-mailer.ts`
- `src/lib/telegram/index.ts`, `src/lib/telegram/auto-post.ts`, `src/lib/email/newsletter-form.ts`
- `src/app/contact/page.tsx`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`
- `README.md`
- Telegram promo seed SQL that hardcodes `https://spinoracasinos.com/...`
- `src/lib/seo/blog-links.ts` still treats `spinoracasinos.com` as an owned host

## Safe tests, after the schema exists

No real card, crypto, payout, SMS, or email blast.

1. Project ref is `zecitlewsynyioemsqna`. `auth.users` count is 0 before the first signup.
2. Required money tables exist: `profiles`, `wallet_transactions`, `deposit_requests`, `game_load_requests`, `paydora_payout_requests`, `cashout_holds`.
3. `fail_stale_game_loads` is the version that returns 0 and does not refund a timed-out load. Confirm by reading the function body, not by creating a load.
4. Signup creates a profile with role `customer`, a referral code, and notification preferences. Wallet columns are 0.
5. Second user stays `customer` and has no `user_roles` staff row.
6. First user, after the one-time grant, can open an admin page. A normal user cannot.
7. Two test users can exchange a human chat message. No bot row is required.
8. Avatar upload lands in `avatars`. A KYC upload attempt uses the private `kyc-documents` bucket and is not world-readable. No real identity document.
9. Game lobby reads the games catalog if the catalog seed was approved. Provider calls stay disabled.
10. Payment routes are not called. Webhook URLs are checked on paper only.
11. A direct update of `profiles.wallet_balance` as the signed-in user is rejected by `protect_wallet_columns_trigger`.
12. Marketing send controls are visible and are not submitted.

## Rollback

The old project and the live Vercel environment stay as they are. Rollback is: do not switch production environment variables. The new project can be left unused. This plan does not drop, reset, or delete the old database.

## Approval needed

Reply with both of these before any SQL is written to `zecitlewsynyioemsqna`:

1. Approve this plan.
2. Choose feature tables: install the missing website tables empty, or install only the 48 live tables.

The installer, the supplement SQL, the admin grant script, and the verification report will be prepared in `C:\supabase-migration-test` after that reply. They will not be committed to GitHub. Backup files and secrets will not be committed.
