# Financial Phase 3A — Live database read-only audit

This workspace has no `DATABASE_URL`, `SUPABASE_DB_URL`, or `DIRECT_URL`. The live catalog was not queried. No financial function was called. No customer balance was read. No migration was applied.

There is one Supabase project, and it is the live website database. A separate staging project does not exist yet. Anything below that is not marked confirmed is a local-migration expectation, not a live finding.

## Confirmed database findings

The owner’s earlier catalog inspection confirmed one live behavior:

`fail_stale_game_loads` refunds timed-out `load` and `reload` requests and can mark them failed without a confirmed provider failure.

That matches the body in `supabase/migrations/20261008000160_financial_trust.sql`. It does not match the safe body in `20261013000130_hold_unknown_game_loads.sql` or `20261015000180_hold_stale_game_loads.sql`. Those two files are not installed.

No other installed function, index, constraint, grant, or RLS policy was confirmed in this pass.

## Unverified assumptions

These are the latest local definitions. Treat each one as unproven on the live database until the `SELECT`s at the end are run.

| Object | Latest local file | Expected live shape |
|---|---|---|
| `fail_stale_game_loads(integer, uuid, text)` | `20261015000180` is prepared and unapplied. Live body is the refunding `20261008000160` version. | Service role only. Returns a count. Refunds `load` / `reload`, then sets `failed`. |
| `fail_my_stale_game_load(integer, text)` | `20261008000160` only | `authenticated` may execute. Delegates to `fail_stale_game_loads` for `auth.uid()`. |
| `complete_game_load(uuid, boolean, text, text, text, numeric)` | `20261008000210_create_requires_game_row.sql` | Updates only `pending` / `processing`. Failure of `load` / `reload` calls `refund_game_load_wallet`. |
| `refund_game_load_wallet(uuid)` | `20261011000280_refund_wallet_refunded_column.sql` | Returns immediately when `wallet_refunded` or `game_api_debited` is true, or the type is not `load` / `reload`. |
| `request_game_load(text, text, numeric, text, text)` | `20261008000160` | Drops the older six-argument form. Debits the wallet once per call. Open-request check is not under the profile lock. |
| `request_auto_game_load(uuid, text, text, numeric, text, text)` | `20261008000130_auto_ops.sql` | Reopens a failed row when `wallet_refunded` is false. Does not read `game_api_debited`. |
| `mark_game_api_debited(uuid)` | `20261008000190_auto_money.sql` | Sets the flag for that id with no status check. |

Local table expectations for `game_load_requests`:

- Primary key `id`.
- `status` check: `pending`, `processing`, `completed`, `failed`, `cancelled`.
- Latest `load_type` check, from `20260720000400_game_redeem_fix.sql`: `new_account`, `reload`, `create_account`, `load`, `redeem`, `check_balance`.
- `amount >= 0`.
- Original `wallet_type` check allows only `current` and `cashout`. No later migration drops `game_load_requests_wallet_type_check`. `request_game_load` still accepts `bonus`. Whether that check still rejects `bonus` is unverified.
- Columns `wallet_refunded` and `game_api_debited` are added with `IF NOT EXISTS` in `20261011000280`. `source_key` is added in `20261008000130`.
- Indexes in local files: `(user_id, created_at desc)`, `(game_slug, status, created_at)`, and a partial unique index on `source_key` where it is not null.
- No partial unique index on open `(user_id, game_slug)`.
- RLS enabled in `20260617000085_game_load_requests.sql`: players and staff can select their rows, direct insert is `WITH CHECK (false)`, staff can update. Service role bypasses RLS. Later migrations do not replace these policies.

## Financial risks

**Confirmed.** A stale `load` or `reload` can be refunded after the provider already added game credit. That is a house loss. `20261015000180_hold_stale_game_loads.sql` stops that path and has not been applied. Applying it on this single live project is a production change and needs a staging test first.

**Unverified, high if the local files match production.**

- Two overlapping `request_game_load` calls can both pass the open-request check and both debit the wallet. Nothing in the local migrations creates a unique open-request index.
- `mark_game_api_debited` commits before `complete_game_load`. A failed finish leaves the wallet debited and blocks `refund_game_load_wallet`. A later retry can credit the game again.
- `request_auto_game_load` reopens a non-refunded failed row without looking at `game_api_debited`.
- `fail_my_stale_game_load` is executable by the signed-in player and currently inherits the refunding `fail_stale_game_loads`.
- Staff RLS allows a direct update of `game_load_requests` without going through `complete_game_load`. Service role bypasses RLS entirely.
- If `game_load_requests_wallet_type_check` still allows only `current` and `cashout`, a `bonus` load insert fails. If the check was removed outside the migrations, a `bonus` debit uses `bonus_wallet` inside `request_game_load`.

**Not safe just because they match the latest local file.** `mark_game_api_debited` and `request_auto_game_load` have no later safe replacement.

## Changes that require staging tests

Do these on a copy, not on the live project.

1. Apply only `20261015000180_hold_stale_game_loads.sql`. Confirm `pg_get_functiondef` returns `0`, does not mention `refund_game_load_wallet`, and does not update rows. Call it only on the copy, with a disposable row, and confirm a `pending` load stays `pending` with `wallet_refunded` false. Repeat the call.
2. Confirm `fail_my_stale_game_load` still has signature `(integer, text)` and, after the replacement, also leaves the row unchanged.
3. Prove an overlapping pair of `request_game_load` calls. The local SQL cannot prevent a double debit. A staging test should show whether both debits land. Do not add the unique index on the live database in this step.
4. Set `game_api_debited` and then make `complete_game_load` fail. Confirm the wallet is not refunded. Then call `request_auto_game_load` for that source key and confirm whether the row returns to `processing` while the flag stays true.
5. As `authenticated`, attempt `fail_stale_game_loads` directly and confirm it is denied. As `authenticated`, attempt `mark_game_api_debited` and `refund_game_load_wallet` and confirm they are denied.
6. Insert a `bonus` `game_load_requests` row only on the copy, or inspect the check constraint, before deciding whether bonus loads are blocked.

App changes already prepared locally, and not part of this database pass: admin Complete / Failed no longer settles an open row, and `healStaleGameLoads` no longer calls `finishGameLoad` when the stale RPC errors. Those still need an application staging check. They do not remove the live SQL refund inside `fail_stale_game_loads`.

## Recommended next steps

1. Run the `SELECT`s below in the Supabase SQL editor. Paste back function names, argument lists, constraint names, index names, and policy names only. Do not paste player rows, balances, emails, or function results from calling the RPCs.
2. Create a separate staging project and restore a schema-only copy, or a backup restored somewhere that is not the live project. Do not point the website at it.
3. On that copy, apply `20261015000180` only after the catalog read still shows the refunding `fail_stale_game_loads`. Run the staging tests above.
4. Leave `mark_game_api_debited`, `request_auto_game_load`, and the missing open-request unique index unchanged until their own staging tests pass. Each one needs its own migration. This audit does not add them.

## SELECT-only queries

These read the catalog and one aggregate. They do not call the financial functions and do not list players.

```sql
SELECT version
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20260617000085',
  '20260720000200',
  '20260720000400',
  '20261008000130',
  '20261008000160',
  '20261008000190',
  '20261008000200',
  '20261008000210',
  '20261011000280',
  '20261013000130',
  '20261015000180'
)
ORDER BY version;
```

```sql
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       (pg_get_functiondef(p.oid) ILIKE '%refund_game_load_wallet%') AS mentions_refund,
       (pg_get_functiondef(p.oid) ILIKE '%RETURN 0%') AS returns_zero,
       (pg_get_functiondef(p.oid) ILIKE '%status = ''failed''%') AS sets_failed,
       (pg_get_functiondef(p.oid) ILIKE '%game_api_debited%') AS mentions_debited,
       (pg_get_functiondef(p.oid) ILIKE '%COALESCE(v_row.wallet_refunded, false)%') AS coalesce_refunded,
       (pg_get_functiondef(p.oid) ILIKE '%No games row%') AS no_games_row,
       (pg_get_functiondef(p.oid) ILIKE '%A request is already in progress%') AS open_request_guard,
       (pg_get_functiondef(p.oid) ILIKE '%source_key%') AS uses_source_key
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'fail_stale_game_loads',
    'fail_my_stale_game_load',
    'complete_game_load',
    'refund_game_load_wallet',
    'request_game_load',
    'request_auto_game_load',
    'mark_game_api_debited'
  )
ORDER BY 1, 2;
```

```sql
SELECT grantee, routine_name, privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN (
    'fail_stale_game_loads',
    'fail_my_stale_game_load',
    'complete_game_load',
    'refund_game_load_wallet',
    'request_game_load',
    'request_auto_game_load',
    'mark_game_api_debited'
  )
ORDER BY routine_name, grantee;
```

```sql
SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'game_load_requests'
ORDER BY c.conname;
```

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'game_load_requests'
ORDER BY indexname;
```

```sql
SELECT polname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'game_load_requests'
ORDER BY polname;
```

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'game_load_requests'
  AND column_name IN ('status', 'load_type', 'wallet_type', 'amount', 'wallet_refunded', 'game_api_debited', 'source_key')
ORDER BY column_name;
```

```sql
SELECT count(*) AS open_duplicate_pairs
FROM (
  SELECT user_id, game_slug
  FROM public.game_load_requests
  WHERE status IN ('pending', 'processing')
  GROUP BY user_id, game_slug
  HAVING count(*) > 1
) d;
```

The last query returns one number. It does not return user ids. A number above zero means at least one player already has two open requests for the same game. It does not, by itself, prove a double wallet debit.
