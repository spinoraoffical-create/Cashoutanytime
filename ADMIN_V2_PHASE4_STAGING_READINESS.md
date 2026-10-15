# Phase 4 staging readiness

Date: 14 October 2026. Branch `admin-v2-development`. HEAD `55a999017407bd70682b7dd25c131c5c0c3c1172`. Uncommitted Phase 2G–3D work was left in place.

This pass did not commit, push, merge, deploy, run SQL, change environment variables, call a provider, send a message, publish content, or modify a player record.

Production remains the known Phase 2D commit until the owner asks for a deploy. A git deploy of this branch at `55a9990` does not include the uncommitted Admin 2.0 work.

## 1. What is ready

- Admin 2.0 screens, confirmation gates, count honesty, and audit warnings for payouts, wallet adjustments, deposit status, store actions, bans, deletes, and role changes are in the working tree.
- Paydora credit, refund, payout-void credit, and automatic settlement log a missed audit row and continue. A missed audit does not ask Paydora to retry a payment that already succeeded.
- `supabase/migrations/20261014000160_admin_decide_kyc.sql` is a reviewed, unapplied function. The app does not call it.
- `supabase/migrations/20261014000170_profiles_last_seen_at_index.sql` now adds `profiles.last_seen_at` before indexing it. An earlier index-only statement failed on the live database with `column "last_seen_at" does not exist` and created nothing.
- Safe source tests, `npx tsc --noEmit`, and an isolated Next.js 15.5.19 build passed in Phase 3D.

## 2. What is missing

- The working tree is uncommitted, so staging cannot be deployed from Git until the owner commits.
- Staging has no separate Supabase project, Paydora sandbox, webhook host, or cron secret recorded in this repo.
- The identity screen still writes the submission and the profile as two requests.
- The players-seen column and index are not applied on a database copy by this pass.
- Legacy public identity-document addresses are still in the database. Cleanup is an owner step and was not performed.
- Game-provider, email, Telegram, and site-URL fallbacks still point at live hosts when a staging variable is empty.

## 3. Owner actions before any staging deploy

1. Create a new Supabase project. Do not reuse the production URL, anon key, or service-role key.
2. Decide how the uncommitted files reach that environment. This pass does not commit them.
3. Set staging variables from the checklist below. Leave live provider credentials unset.
4. Take a backup of that empty staging database, then apply the two SQL files there only.
5. Prove `admin_decide_kyc` with the database checks in section 5 before any application change.
6. Run the player and admin cases in section 6 on staging accounts only.
7. Give a separate written approval before production.

## 4. Staging environment checklist

Do not copy production secrets into this file, into chat, or into a staging project. Compare variable names only.

Supabase falls back to `https://unconfigured.supabase.co` and a non-working anon key when `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is empty. `SUPABASE_SERVICE_ROLE_KEY` has no fallback. Staging must set all three to the new project. The service-role key bypasses row-level security.

| Service | Variables | Staging requirement |
| --- | --- | --- |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | New project only. Auth redirects must allow the staging origin. |
| Site URL | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL` | Set both to the staging origin. An empty `NEXT_PUBLIC_SITE_URL` becomes `https://www.sweeptakehub.com` in `resolveSiteUrl`. Auth email fallback is `https://cashoutanytime.vercel.app` or `https://www.sweeptakehub.com`. Telegram helpers fall back to `https://spinoracasinos.com`. |
| Paydora | `PAYDORA_API_KEY`, `PAYDORA_WEBHOOK_SECRET`, `PAYDORA_API_BASE_URL` | Use a sandbox key and sandbox secret, or leave the key empty so checkout cannot start. The code default base URL is `https://cpcs.paydora.net/api/v1`, which is the live API. Webhook URL is `https://STAGING-HOST/api/payments/paydora/webhook`. Do not register that URL on the live Paydora account. |
| NOWPayments | `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` | Leave unset. Current `src` has no NOWPayments route. The example file still lists the names. |
| Game providers | Juwa, Vegas, Game Vault, Cash Frenzy, Cash Machine, Game Room, Mr All In One, Mafia, Fire Kirin, Milky Way, Orion Stars, VBlink agent URLs, ids, secrets, passwords, and proxy URLs | Leave unset for the first staging pass. Several admin URLs fall back to the live agent portals in `src/lib/game-automation/config.ts`. A staging password plus that fallback would log into production. |
| Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO` | Leave the API key unset unless a sandbox sender is approved. The default from address is `Sweepstakes Hub <noreply@spinoracasinos.com>`. The default reply-to is `support@spinoracasinos.com`. |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Leave unset. Offer SMS and the stop webhook stay idle. |
| Offer links | `OFFER_LINK_SECRET` | Set a staging-only value if offer links are tested. If it is empty, the code uses `RESEND_API_KEY`. |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, `TELEGRAM_PROMO_CHAT_ID`, `TELEGRAM_CHAT_FINANCE`, `TELEGRAM_CHAT_USERS`, `TELEGRAM_CHAT_SWEEPSTAKES`, `TELEGRAM_CHAT_ERRORS`, `TELEGRAM_CHAT_REPORTS`, bot usernames | Leave unset. Deposit alerts, promo posts, and broadcasts then have no bot. |
| AI publishing | `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `SPINORA_BOT_SENDER_ID` | Leave unset for the first pass. `ai_blog_settings.auto_publish` defaults to true in the older KYC/AI migration. A configured key plus a cron call can publish. |
| Scheduled jobs | `CRON_SECRET` | Staging-only secret. Routes fail closed with HTTP 503 when it is empty and HTTP 401 when the bearer token does not match. |
| Public contact | `NEXT_PUBLIC_WHATSAPP_URL` and the other social URLs | Set staging values or leave them empty on purpose. Empty WhatsApp becomes `https://wa.me/1234567890`. |
| Restricted states | `RESTRICTED_STATES` | Defaults to `WA,ID,NV,MI` when empty. Set it explicitly on staging. |

Scheduled routes under `src/app/api/cron`: `seo-index`, `newsletter-send`, `auto-blog`, `telegram-promo`, `telegram-auto-post`, `ai-self-analyze`, and `auto-post`. `vercel.json` schedules only `/api/cron/seo-index` at `0 8 * * *`. Vercel runs that schedule on the production deployment of a project. A staging project must use its own cron secret and its own Supabase project. Do not add the staging host to the production Paydora webhook, Twilio callback, or Telegram webhook.

Other live-capable routes: `/api/payments/paydora/create`, `/status`, `/methods`, `/payout`, `/webhook`, `/api/sms/stop`, `/api/email/unsubscribe/[userId]/[token]`, `/api/chat/live-bot`, `/api/chat/ai-bot`, `/api/chat/after-send`, `/api/admin/telegram-broadcast`, and `/api/admin/autopilot`.

Isolation checks before the first staging request:

- Staging Supabase host differs from the production project ref.
- Staging `NEXT_PUBLIC_SITE_URL` is the staging origin.
- `PAYDORA_API_BASE_URL` is a sandbox host, or `PAYDORA_API_KEY` is empty.
- Game agent passwords are empty.
- `RESEND_API_KEY`, `TWILIO_AUTH_TOKEN`, and `TELEGRAM_BOT_TOKEN` are empty for the first pass.
- AI provider keys are empty.
- `CRON_SECRET` differs from production.
- A preview deployment on the production Vercel project is not used, because previews can inherit production variables.

## 5. Database review

Neither file was applied by this pass. Run them on the staging project only, after a backup of that project, in this order: identity function first, then the players-seen file.

### `20261014000160_admin_decide_kyc.sql`

Schema compatibility, from the migrations already in the repo:

- `kyc_submissions.status` allows `pending`, `approved`, and `rejected`, and `user_id` is unique.
- `profiles.kyc_status` is added with default `unverified`.
- `audit_logs` has `actor_id`, `action`, `entity_type`, `entity_id`, `before_data`, `after_data`, `ip_address`, and `user_agent`.
- Both updated tables are expected to have `updated_at`. Confirm that on the staging copy before applying. A missing column rolls the function back.
- `protect_profile_columns` blocks a `kyc_status` change unless the request role is `service_role`, `app.wallet_update` is set, or the caller is an admin. The function requires `auth.role() = service_role`, so the same request should pass that trigger. The staging proof must read `profiles.kyc_status` after the call and see `verified` or `rejected`.

Permissions:

- `SECURITY DEFINER` with `search_path = public`.
- The body rejects every role other than `service_role`.
- Execute is revoked from `public`, `anon`, and `authenticated`, and granted only to `service_role`.
- The SQL editor, when connected as the database owner, should fail with `service role required`. That failure is the expected guard.
- The actor must exist in `auth.users`. The application will pass the staff user id from `authorize("kyc.manage")`.

Atomic update and audit:

- The submission row and the profile row are locked with `FOR UPDATE`.
- A missing submission raises `identity check not found`.
- A missing profile raises `player profile not found` and rolls the submission change back.
- Approved maps the profile to `verified`. Rejected maps the profile to `rejected`.
- The audit insert is in the same function. A failed insert rolls both status writes back.
- Audit data is the old and new status only. `document_url` is not written.

Idempotency and concurrency:

- `CREATE OR REPLACE` plus the revoke/grant can be run again.
- If the submission status and the profile status already match the requested decision, the function returns and does not insert a second audit row.
- Two overlapping decisions lock the same rows. The second sees the first commit and then either returns or applies the new decision.
- A leftover split from the current two-write path, where the submission changed and the profile did not, does not take the early return. The function writes both rows and one audit row.

Rollback:

```sql
DROP FUNCTION IF EXISTS public.admin_decide_kyc(uuid, text, uuid, text, text);
```

Existing identity rows stay as they are.

### `20261014000170_profiles_last_seen_at_index.sql`

The live database rejected the earlier index-only statement because `profiles.last_seen_at` is absent. The file now does both steps:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx
  ON public.profiles (last_seen_at);
```

- `ADD COLUMN IF NOT EXISTS` is safe on a database that already has the column. It does not change an existing column’s nullability or default.
- The new column is nullable and has no default. Existing rows stay null, so they are not counted as seen today. Filling them with the current time would count every profile.
- The index build takes a write lock on `profiles` for the duration of the build. Run it in a quiet staging window. `CREATE INDEX CONCURRENTLY` is not used because the migration runner wraps SQL in a transaction.
- Running the file twice is safe.
- The dashboard query is unchanged. After the column exists, a successful count can be 0. A failed count must still say Unavailable.
- Site presence updates `last_seen_at` and `is_online` together. `is_online` appears in the archived schema and is not added by this file. On staging, confirm `is_online` before expecting a visit to fill `last_seen_at`. If that column is absent, the heartbeat update fails and the count stays 0.

Rollback:

```sql
DROP INDEX IF EXISTS public.profiles_last_seen_at_idx;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS last_seen_at;
```

Drop the column only before real heartbeats have written it, or accept the loss of those timestamps.

## 6. KYC application plan

Do not make this change until the staging database checks in section 5 pass. Do not leave a fallback that runs the old two writes in the same request.

Current behavior in `updateKYCStatus` inside `src/lib/actions/kyc-actions.ts`:

1. `authorize("kyc.manage")`.
2. Load the submission by row id, then by `user_id`.
3. Update `kyc_submissions.status`.
4. Update `profiles.kyc_status` to `verified` or `rejected`.
5. If the profile update fails, put the submission status back.
6. `writeAudit`. If that insert fails, return an error even though both status writes already succeeded.

Later change, in that function only:

1. Keep `authorize("kyc.manage")` first. Keep the staff gate error text.
2. Keep the row lookup so the RPC always receives `kyc_submissions.id`, including when the screen passed a user id.
3. Read the client IP and user agent the same way `writeAudit` does: the first `x-forwarded-for` hop, then `x-real-ip`, and `user-agent`.
4. Call `admin.rpc("admin_decide_kyc", { p_submission_id, p_status: newStatus, p_actor: gate.staff.userId, p_ip, p_user_agent })` once.
5. If the error says the function is missing, return `{ ok: false, error: "Identity review is not ready on this server." }` and stop.
6. Map a raised database error to a short message: not found, profile not found, invalid status, or a generic save failure. Do not return SQL text.
7. On success, keep the current `revalidatePath` calls and return `{ ok: true }`.
8. A second identical decision is success. The function inserts no extra audit row.
9. Remove the two updates, the manual revert, and the `writeAudit` call from this function. The function owns that audit row.
10. In the same later change, update `scripts/kyc-upload.test.mjs` and `scripts/phase3d-release-blockers.test.mjs`. Those tests currently require the two-write audit message and require that `kyc-actions.ts` does not contain `admin_decide_kyc`.

Leave submission upload, private-path signing, the 120-second signed URL, and the clearing of `http` and `data:` addresses unchanged.

## 7. Staging test plan

Use new staging accounts only: one player, one store, one sub-creator, and one Super Admin. Start balances at 0. Use a sample image that is not a real identity document. Use a $1 staging credit only after the Paydora sandbox is isolated. Do not complete a live game-provider load.

### Player

| Case | Steps | Expected result |
| --- | --- | --- |
| Signup | Create the player with terms accepted and the offers box cleared | Account exists. Offers stay off. |
| Login | Sign in and out, then open an expired link | The session matches that account. The expired link does not sign anyone in. |
| Profile | Save a display name | The name changes. Balances stay 0. |
| KYC upload | Upload the sample image | Status is pending. The stored value is a private path. |
| Games | Open the public catalog | Inactive games stay hidden. No provider call is made. |
| Game load | Open the load screen and stop | No load is submitted. |
| Deposit | With the sandbox key, start one checkout and deliver the webhook once, then again | One credit. The second delivery does not credit again. With the key empty, checkout does not leave the staging host. |
| Withdrawal | Request $1, then request more than the balance | One reservation. The low-balance message is the plain balance sentence. |
| Support | Send “staging test” | The row is stored. No campaign is sent. |
| Rewards and offers | Open both screens | Do not press Send. Counts may be 0. |

### Admin

| Case | Steps | Expected result |
| --- | --- | --- |
| Dashboard | Open `/admin` as Super Admin | A failed count says Unavailable. After the players-seen column exists, a real 0 may show. Unavailable is not treated as 0. |
| CRM | Open the staging store’s players | Totals stay inside that store. A capped total says Unavailable. |
| Financial operations | Open deposits and cash-outs. Mark the $1 staging row once, then submit it again | The second submit does not debit again. A missing audit row is a warning. The balance stays saved. |
| Game loads | Open the queue | Complete and Failed stay unpressed. |
| Stores | Create one staging sub-creator, then submit the same create again | One login. A missing audit row is a warning. |
| KYC | Before the RPC is wired, leave Approve unpressed. After the database proof and the later code change, approve the sample once and repeat it | One audit row. Profile status is `verified`. The repeat adds no second audit row. Rejecting afterward changes both rows together. |
| Marketing | Open offers, newsletters, and the AI blog | Do not send, publish, or broadcast. |
| CMS | Create a FAQ | It stays unpublished until the switch is turned on. Do not press Generate all states. |
| Support | Open tickets as Super Admin, and open `/admin/support` as the store | The store is redirected to the agent inbox. A failed ticket list says Unavailable. |
| Roles | Remove the store’s access to a player-only page, and try a role change without permission | The forbidden action returns the permission error. A saved role change with a missing audit row is a warning. A failed role write stays an error and restores the previous roles when the restore succeeds. |
| Password | Reset the staging store password to a 7-character value, then to a valid staging password | The short password is refused before the auth update. A provider failure on the valid attempt stays an error. |

### Failure and isolation cases

- Duplicate webhook: one `credit_paydora_deposit` call, one balance change.
- Audit insert disabled on staging for one payout: the payout remains saved, the screen warns, and a second click does not pay again.
- Identity RPC absent: the later app build returns the not-ready error and leaves both rows unchanged.
- Two admins decide the same submission at once: the final submission status and profile status match, and there is one audit row per actual change.
- Store account calls a Super Admin route: the existing permission error is returned.
- Staging server is pointed at the production Supabase host: stop the test. That configuration is a failed isolation check.
- Player financial amounts in server logs: the missed-audit line contains the action name only.

## 8. Deployment plan

### Staging

1. Confirm the working tree that will be deployed includes Phase 2G–3D. Git at `55a9990` does not.
2. Create the staging Vercel project and the staging Supabase project.
3. Set the variables in section 4. Leave live provider credentials empty.
4. Back up the staging database.
5. Apply `20261014000160_admin_decide_kyc.sql` on staging. Run the permission and concurrency checks. Do not change the app yet.
6. Apply `20261014000170_profiles_last_seen_at_index.sql` on staging. Reload the dashboard.
7. Deploy the current app to the staging host.
8. Run section 6. Approve and reject stay unpressed until the RPC proof passes and a later change wires it.
9. After that later change, repeat the KYC cases on the sample row only.

### Production

Production deploy is a separate owner request. It is not authorized by this report.

1. Staging section 6 has passed, including the wired identity function.
2. The deployed commit is recorded and matches the tested tree.
3. Production database backup is completed and restorable.
4. Maintenance window is agreed.
5. Apply the identity function on production only after the same proof used on staging.
6. Apply the players-seen file on production only after confirming whether `last_seen_at` is still absent. The failed index-only statement did not add it.
7. Deploy with the approved production command only after the owner asks.
8. Watch the first signup, the first dashboard load, the Paydora webhook response, and the audit log.
9. Leave game-provider loads, broadcasts, and AI publish turned off until their own checks pass.

### Backup

- Staging: backup before each of the two SQL files.
- Production: full database backup plus a storage inventory of `kyc-documents` before any identity cleanup. Do not download document bytes into the repo.
- Confirm the backup can be restored to a throwaway project before the production window.

### Monitoring after a future production deploy

- Paydora webhook responses are HTTP 200 for a duplicate delivery and HTTP 500 only when the credit or reverse itself throws.
- Incident log lines for `deposit.credit`, `deposit.refund`, `deposit.payout_void`, and `deposit.auto_settle` contain no amounts and no account ids.
- Dashboard cards that fail say Unavailable.
- New identity uploads store a private path.
- Cron `seo-index` runs only against the intended project.
- No Telegram, Resend, or Twilio traffic appears while those keys are unset.

### Final owner approval

- Staging host and Supabase project are named and are different from production.
- The tested git commit is named.
- Both SQL files are recorded as applied or skipped.
- The identity RPC proof passed, and the app either still uses the two writes or has the later single-RPC change.
- Player, store, and Super Admin accounts used in the test are staging accounts.
- No live game load, broadcast, or real identity document was used.
- Rollback owners and the backup location are named.
- A separate sentence approves production.

## 9. Unresolved release blockers

- Release remains **not ready for production**.
- Phase 2G–3D is uncommitted and is not on the known production commit.
- Identity approve and reject are still two writes. The RPC is not deployed and is not called.
- `profiles.last_seen_at` was missing on the database that rejected the index. The corrected file is still unapplied by this pass. Players seen today stays Unavailable while that query errors.
- `is_online` may also be missing. That would keep the new column null after a visit.
- Old public identity-document addresses are still stored. The admin list hides them. Cleanup has not been approved.
- A failed store password reset can still show the provider message.
- Empty staging configuration still falls back to live Paydora, live game-portal URLs, and live site domains. Staging must set or deliberately withhold those variables.
- `ai_blog_settings.auto_publish` defaults to true in the older migration. AI keys must stay empty until that setting is reviewed.
- Areas outside the Phase 3C and 3D audit list can still ignore a failed `writeAudit`. That was not expanded in this pass.

## 10. Rollback

- App: keep production on the known Phase 2D commit.
- Identity function: run the drop statement in section 5. Saved identity statuses remain.
- Players-seen index and column: run the two rollback statements in section 5 only on the database where they were applied.
- Do not reverse a saved payout, credit, or refund because an audit warning appeared.
- Do not delete identity files as a rollback.

## Final safety check

- Branch remains `admin-v2-development`.
- HEAD remains `55a999017407bd70682b7dd25c131c5c0c3c1172`.
- Phase 2G–3D changes are still present.
- No production variable, database, or player record was changed.
- No SQL was executed.
- No provider was called.
- No message was sent and no content was published.
- No commit, push, merge, or deployment occurred.
