# Supabase

## Source of truth

Apply SQL from **`migrations/` in filename order** (timestamps). That folder is authoritative for a new project.

After migrations, run **`paydora-security-hardening.sql`** in the SQL editor if those Paydora wallet RPCs / profile helpers are not already present. It is idempotent (`CREATE OR REPLACE` / `IF NOT EXISTS`).

## New project checklist

1. Create a Supabase project.
2. SQL Editor → paste each file in `migrations/` from oldest to newest, or use the Supabase CLI (`supabase db push`) if linked.
3. Run `paydora-security-hardening.sql`.
4. Put URL + anon + service_role keys in `.env.local` (see root `.env.example`).
5. Set at least one profile `role = 'admin'`.

## Archive / leftover dumps

`archive/` holds old combined dumps (`SPINORA-COMPLETE-SCHEMA.sql`, `ALL-MIGRATIONS-COMBINED.sql`, Section A patches). **Do not apply them on a database that already has `migrations/`.** They are reference-only.

Loose `*.sql` files in this directory (wallets, KYC patches, etc.) are historical one-offs. Prefer the matching file under `migrations/` when both exist.
