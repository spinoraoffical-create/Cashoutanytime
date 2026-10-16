# Sweepstakes Hub — new Supabase installation plan

Status: waiting for owner approval. No SQL has been run. Neither Supabase project has been changed. Production Vercel settings have not been changed.

Allowed target, and the only target this plan will ever use:

`zecitlewsynyioemsqna`

Forbidden target:

`muetgtzcbecsqigtpfyn` (spinoracasinos.com)

The install script must read the project reference from the database URL and stop immediately if it is not `zecitlewsynyioemsqna`.

## Backup files

`C:\supabase-backup` is not on this computer. These files could not be read:

- `C:\supabase-backup\schema.sql`
- `C:\supabase-backup\extensions.sql`

`data.sql` and `auth-data.sql` were not opened and will not be imported.

Because the production schema dump is missing, this plan is based on the 91 repository migrations in `supabase/migrations`, from `20260613000001_extensions_types.sql` through `20261015000180_hold_stale_game_loads.sql`. The older file `supabase/archive/schema.sql` is not a substitute. It is incomplete and must not be applied.

## What the application database contains

Counted from the migration files, in filename order:

- 77 application tables
- 80 functions, with 130 definitions because later migrations replace earlier ones
- 38 triggers
- 110 row-level security policies
- Storage buckets created by migrations: `avatars`, `cms-media`, `ticket-attachments`, `payment-proofs`, `kyc-documents`
- Realtime tables added by migrations: `notifications`, `ticket_messages`, `game_load_requests`, `messages`, `conversations`, `deposit_requests`, `agent_messages`

Wallet balances are columns on `profiles` (`wallet_balance` defaults to 0). There is no separate wallets table. A new registration creates a profile, a referral code, and notification preferences. The balance starts at zero.

There is no `pg_cron` schedule in the migrations. Scheduled work is application routes under `/api/cron`, protected by `CRON_SECRET`. `vercel.json` currently schedules only `/api/cron/seo-index`. These routes also exist and are not scheduled there: newsletter send, auto blog, telegram promo, telegram auto-post, auto-post, and AI self-analyze.

## Why the migrations must not be rerun blindly

They are safe to apply **once**, in filename order, on an **empty** new project. They are not safe to replay on the old project or on a database that already has these objects.

Reasons:

- Many statements use `CREATE TABLE`, `CREATE POLICY`, and `ALTER PUBLICATION ... ADD TABLE` without a second-run guard. A second run stops with an error.
- Important functions are replaced several times. The last file wins. Examples: `complete_game_load` (6), `protect_profile_columns` (5), `handle_new_user` (4), `fail_stale_game_loads` (4). Applying an older file later would restore an older, less safe money function.
- `20261015000180_hold_stale_game_loads.sql` is the last definition of `fail_stale_game_loads`. On the new project it must remain the version that returns 0 and does not refund a timed-out game load.
- `20261008000140_customer_signup_role.sql` names one email address and deletes other admin role rows. On an empty new project it changes nothing, because no auth user exists yet. It must not be replayed after real staff exist.
- Archive SQL in `supabase/archive` overlaps the migrations. It must not be applied as a second pass.
- The chat attachment bucket is only in `supabase/archive/chat-attachments.sql`. It is not in the migration chain. The app expects the private bucket `chat-attachments`. Its current policy allows staff only when `profiles.role = 'admin'`. New accounts are forced to `customer`, and staff access is `user_roles`. The install package must recreate that policy with `public.is_staff()` so authorized staff can open attachments and ordinary players cannot.

## What will be installed

Schema, functions, triggers, indexes, constraints, row-level security, empty configuration tables, storage buckets, and Realtime publication entries.

Configuration seeds already inside the migrations stay, because the site needs games, payment-method rows, roles, pages, and similar non-personal setup. They contain no player accounts.

## What will not be installed

- Auth users, identities, sessions, and tokens
- Profiles and personal information
- Wallet balances and ledger history
- Deposits, withdrawals, and payment events
- Game-load history and game accounts
- Chat messages and uploaded files
- Newsletter recipients and marketing sends
- Anything from `data.sql` or `auth-data.sql`

New people can still register. `handle_new_user` creates their profile as `customer`. The `profiles_force_customer_role` trigger blocks a signup from choosing another role.

## First admin

There will be no password in source code and no public “make me admin” page.

After the empty database exists:

1. The owner registers on the new project with an email and a password they choose in the Supabase Auth screen or the local site.
2. A one-time local script, using the service-role key, inserts one `user_roles` row for the `super_admin` role.
3. The script checks the project reference, requires the email to be typed at run time, and refuses to run if that person already has the role or if the email does not match exactly one new auth user.
4. A second registration is checked to prove it stays `customer` and has no staff role.

`profiles.role` stays `customer`. Admin access is the `user_roles` row. A few older server actions still look at `profiles.role = 'admin'`; those paths are reported separately and are not opened up.

## Website configuration

Local `.env.local` still points at the old project. It will not be switched until this plan is approved, and even then only a separate local or staging env file will use the new project.

Production Vercel variables stay on the current project until a later, explicit go-live.

The browser receives only the public URL and the anon key. The service-role key stays on the server.

Old project reference `muetgtzcbecsqigtpfyn` must not remain in the new deployment configuration. Spinora names in emails, Telegram links, and visible copy are a later content pass. They are not removed in this step, so working features are not redesigned while the database is being prepared.

## Live chat

The human-only chat edits are already in the local working tree and are not deployed. They stay part of this application. No second chat system will be added. Historical bot rows are not deleted because the new database starts with no messages.

## Integrations that need manual setup

These are not copied from the old project into source code.

| Integration | What the owner must set up on the new project |
| --- | --- |
| Supabase Auth | Site URL `https://www.sweeptakehub.com`, plus local `http://localhost:3000`. Redirect allow-list includes `/auth/callback`. |
| Google sign-in | Enable the Google provider in the new Supabase project. Authorized redirect includes `https://zecitlewsynyioemsqna.supabase.co/auth/v1/callback`. |
| Auth email | Custom SMTP in the new Supabase dashboard, or Supabase’s built-in mail. This is separate from Resend. |
| Resend | New or existing API key in server env only. From-address should become a Sweepstakes Hub domain before go-live. Current code defaults to `noreply@spinoracasinos.com`. |
| Twilio | Account SID, auth token, and from-number in server env. No SMS during testing. |
| Telegram | New bot token and chat IDs if this site must not post into the Spinora chats. |
| Paydora | New API key and webhook secret. Webhook URL is `https://www.sweeptakehub.com/api/payments/paydora/webhook`. Do not point the Spinora store at this site. |
| NOWPayments | New API key and IPN secret. IPN URL is `https://www.sweeptakehub.com/api/payments/nowpayments/webhook`. |
| Game providers | Separate agent logins for Sweepstakes Hub. Sharing the Spinora agent accounts would mix the two sites at the provider. Leave providers unset until those accounts exist. |
| Cron | `CRON_SECRET` in server env. Do not enable marketing, Telegram, or AI crons until the owner asks. |
| AI keys | Not required for human-only chat. Blog generation stays off unless the owner asks. |

## One install process, after approval

1. Confirm the new project reference is exactly `zecitlewsynyioemsqna`. Stop otherwise.
2. Confirm the new public tables are empty. Stop if player or money rows already exist.
3. Apply `supabase/migrations` once, in filename order, inside a single controlled runner with a stop-on-error log.
4. Apply one small follow-up file for the `chat-attachments` bucket and an `is_staff()` storage policy.
5. Run read-only checks: required tables exist, `fail_stale_game_loads` returns without updating rows, signup role trigger exists, buckets exist, Realtime tables are published, and `auth.users` is empty.
6. Owner creates the first login. The one-time script grants `super_admin` to that one user.
7. Register a second test user and prove they are not staff.
8. Local app test only: register, log in, empty wallet, human chat between the two test users, and one storage upload. No real payment, SMS, email blast, or Telegram message.

## Rollback

The old project and the live Vercel environment stay as they are. Rollback is: do not switch production environment variables. The new project can be left unused or removed later by the owner from the Supabase dashboard. This plan does not drop, reset, or delete the old database.

## Approval needed

Reply that this plan is approved before any SQL is applied to `zecitlewsynyioemsqna`.
