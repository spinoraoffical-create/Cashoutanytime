# Spinora data migration — Old (Sydney) → New (US East)

**Old project:** `aptzyjsaptaqcovjatqi` (ap-southeast-2)  
**New project:** `drpitkvjcwrbzzufwwjt` (us-east-1)

Run **all schema SQL on the NEW project first** (see `MIGRATION-ORDER.md`) before this guide.

---

## Overview

| Phase | What |
|-------|------|
| 1 | Maintenance window — stop new signups on live site |
| 2 | Export auth + data from OLD |
| 3 | Import into NEW (order matters) |
| 4 | Copy Storage files |
| 5 | Test locally with new `.env.local` |
| 6 | Update Vercel + deploy |
| 7 | Verify production, then pause OLD project |

**Plan ~1–2 hours downtime** (or migrate at night when traffic is low).

---

## Phase 1 — Maintenance (before export)

1. Tell users support chat may be briefly unavailable (optional Telegram post).
2. Do **not** update Vercel env vars yet — live site stays on old DB until Phase 6.
3. On **OLD** Supabase: avoid deleting anything until NEW is verified.

---

## Phase 2 — Install tools (Windows, one time)

### Option A — Supabase CLI + Docker (recommended)

```powershell
npm install -g supabase
```

Install [PostgreSQL 16](https://www.postgresql.org/download/windows/) — you only need **pg_dump** and **psql** in PATH.

### Option B — Supabase Dashboard only (small user count)

Use Table Editor → Export CSV per table. **Auth users cannot be migrated cleanly via CSV** — use Option A for real users.

---

## Phase 3 — Get database passwords

**OLD project** → Settings → Database → Database password (reset if unknown, save it).

**NEW project** → same.

Connection host format:
- Old: `db.aptzyjsaptaqcovjatqi.supabase.co`
- New: `db.drpitkvjcwrbzzufwwjt.supabase.co`

Port: `5432`  
User: `postgres`  
Database: `postgres`

---

## Phase 4 — Export from OLD project

Open PowerShell. Replace `OLD_DB_PASSWORD` with your old project password.

```powershell
$env:PGPASSWORD = "OLD_DB_PASSWORD"

# Auth (logins — keeps passwords)
pg_dump -h db.aptzyjsaptaqcovjatqi.supabase.co -U postgres -d postgres `
  --schema=auth --data-only `
  --table=auth.users `
  --table=auth.identities `
  -f S:\Spinora\migration\auth-data.sql

# Public app data
pg_dump -h db.aptzyjsaptaqcovjatqi.supabase.co -U postgres -d postgres `
  --schema=public --data-only `
  --table=public.profiles `
  --table=public.referrals `
  --table=public.conversations `
  --table=public.messages `
  --table=public.game_requests `
  --table=public.deposit_requests `
  --table=public.wheel_spins `
  --table=public.wallet_transactions `
  --table=public.notifications `
  --table=public.reviews `
  --table=public.user_task_levels `
  --table=public.user_task_submissions `
  --table=public.announcements `
  -f S:\Spinora\migration\public-data.sql
```

Create folder first: `mkdir S:\Spinora\migration`

If a table doesn't exist on old DB, remove that `--table=` line (pg_dump will error).

---

## Phase 5 — Import into NEW project

Replace `NEW_DB_PASSWORD`.

```powershell
$env:PGPASSWORD = "NEW_DB_PASSWORD"

# Auth first (users must exist before profiles FK)
psql -h db.drpitkvjcwrbzzufwwjt.supabase.co -U postgres -d postgres -f S:\Spinora\migration\auth-data.sql

# Then app data
psql -h db.drpitkvjcwrbzzufwwjt.supabase.co -U postgres -d postgres -f S:\Spinora\migration\public-data.sql
```

### If auth import errors (common)

Run on **NEW** project SQL Editor **before** importing auth:

```sql
-- Temporarily allow auth import
ALTER TABLE auth.users DISABLE TRIGGER ALL;
ALTER TABLE auth.identities DISABLE TRIGGER ALL;
```

Import auth again, then:

```sql
ALTER TABLE auth.users ENABLE TRIGGER ALL;
ALTER TABLE auth.identities ENABLE TRIGGER ALL;
```

### If public import fails on duplicate announcements

New project may have seed announcements from `schema.sql`. Either skip `--table=public.announcements` in export, or truncate first:

```sql
TRUNCATE public.announcements CASCADE;
```

---

## Phase 6 — Storage (chat + deposit images)

**OLD** → Storage → bucket `chat-attachments`

**NEW** → Storage → create bucket `chat-attachments` if missing (run `chat-attachments.sql` first).

### Manual (few files)
Download folders from OLD → Upload to same paths on NEW.

### CLI (many files)

```powershell
# Link old project, download
supabase login
supabase link --project-ref aptzyjsaptaqcovjatqi
supabase storage cp ss:///chat-attachments ./migration/storage/chat-attachments -r

# Link new project, upload
supabase link --project-ref drpitkvjcwrbzzufwwjt
supabase storage cp ./migration/storage/chat-attachments ss:///chat-attachments -r
```

---

## Phase 7 — Verify counts

Run on **both** OLD and NEW SQL Editor — numbers should match:

```sql
SELECT 'profiles' AS t, COUNT(*) FROM profiles
UNION ALL SELECT 'messages', COUNT(*) FROM messages
UNION ALL SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL SELECT 'game_requests', COUNT(*) FROM game_requests
UNION ALL SELECT 'deposit_requests', COUNT(*) FROM deposit_requests
UNION ALL SELECT 'wheel_spins', COUNT(*) FROM wheel_spins;
```

Auth users:

```sql
SELECT COUNT(*) FROM auth.users;
```

---

## Phase 8 — Test locally (before deploy)

`.env.local` should already point to NEW project.

```powershell
cd S:\Spinora
npm run dev
```

Test:
- [ ] Existing user login (email + password — should work, same password)
- [ ] Google login (re-enable Google provider on NEW + same callback URL)
- [ ] Chat history visible
- [ ] Admin inbox + deposits
- [ ] Spin wheel / wallet balance

---

## Phase 9 — Dashboard settings on NEW (copy from OLD)

| Setting | Where |
|---------|--------|
| SMTP (Resend) | Auth → SMTP |
| Email templates | Auth → Email Templates |
| Google OAuth | Auth → Providers → Google |
| URL config | Site URL + redirect URLs |

Google callback for NEW:
`https://drpitkvjcwrbzzufwwjt.supabase.co/auth/v1/callback`

Add in Google Cloud Console authorized redirect URIs.

---

## Phase 10 — Go live

1. Vercel → Settings → Environment Variables → update:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Redeploy production (when ready — you said wait until tested).
3. Test login on https://spinoracasinos.com
4. After 1 week stable → pause/delete OLD Sydney project.

---

## Tables import order (reference)

```
auth.users
auth.identities
profiles
referrals
conversations
messages
game_requests
deposit_requests
wheel_spins
wallet_transactions
notifications
reviews
user_task_levels
user_task_submissions
announcements
```

`pg_dump` with multiple `--table` flags handles FK order if you import auth first, then public dump (profiles before messages, etc.).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Login fails after migrate | Check `auth.identities` imported for Google users |
| Chat images 404 | Re-run Storage copy |
| "Database error saving new user" | Run `fix-signup.sql` on NEW |
| Wallet wrong | Re-check `wallet_transactions` + profile wallet columns imported |

---

## Need help?

Paste the **exact error** from psql or SQL Editor and which phase you're on.
