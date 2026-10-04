# Supabase

## Source of truth

1. Apply **`migrations/` in filename order** (timestamps). That folder is authoritative for a new project.
2. Then run **`paydora-security-hardening.sql`** in the SQL editor if those Paydora wallet RPCs / profile helpers are not already present. It is idempotent (`CREATE OR REPLACE` / `IF NOT EXISTS`).

Use the Supabase CLI (`supabase db push`) when the project is linked, or paste files in the SQL Editor from oldest to newest.

## After apply

Put URL + anon + service_role keys in `.env.local` (see root `.env.example`).

Set at least one profile as admin:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
```

## What stays in this folder

- `migrations/` — apply these
- `paydora-security-hardening.sql` — post-migration step when needed
- `email-templates/` — Auth email HTML
- `README.md` (this file)
- `archive/` — **reference only**

## Archive (never apply on a migrated database)

Everything under `archive/` is leftover dumps, one-off patches, and old combined schemas. **Do not run those files on a database that already applied `migrations/`.**
