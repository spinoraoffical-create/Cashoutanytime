# Financial Phase 2D — Production SQL safety preparation

Prepared only. The new migration was not applied. No SQL was executed. Production was not contacted. No customer row was changed.

The exported catalog CSV was not in this project. The comparison uses the confirmed production behavior: `fail_stale_game_loads` refunds timed-out `load` and `reload` requests without a confirmed provider failure. That behavior is the body in `supabase/migrations/20261008000160_financial_trust.sql`. It is not the June 2026 body, which refunds only `reload`.

## Callers

| Caller | Where | What it does |
|---|---|---|
| `fail_my_stale_game_load(integer, text)` | `20261008000160_financial_trust.sql` | Requires `auth.uid()` and returns `fail_stale_game_loads(p_stale_minutes, v_user, p_game_slug)`. Granted to `authenticated`. Not replaced. |
| `healStaleGameLoads` | `src/lib/actions/game-loads.ts` | Calls `fail_my_stale_game_load` only. The uncommitted Phase 2B change does not call `finishGameLoad` when that RPC errors. |
| `request_game_account_create` | `20261008000210_create_requires_game_row.sql` | Calls `fail_stale_game_loads(15, v_user_id, p_game_slug)` before the open-request check. The older copy in `20261008000190_auto_money.sql` is superseded by that file. Not replaced. |
| `claim_next_game_load` | Current migration `20260720000400_game_redeem_fix.sql` | Does not call `fail_stale_game_loads`. An older archive script does. The archive script is not a current migration. |

`src/lib/actions/game-loads.ts` does not call `fail_stale_game_loads` directly.

## Production compared with the local hold

Confirmed production body, matching `20261008000160`:

- Selects `pending` and `processing` rows older than `greatest(p_stale_minutes, 5)` minutes.
- For `load` and `reload`, calls `refund_game_load_wallet`.
- Sets `status = 'failed'` and a timeout error message.
- Returns the number of rows it closed.
- Signature `(integer, uuid, text)`, execute granted to `service_role` only.

`20261013000130_hold_unknown_game_loads.sql` already contains the safe `RETURN 0` body, and its own comment says not to run it until approved. Production is still on the refunding body, so that file is not installed.

## Exact SQL change

New file: `supabase/migrations/20261015000180_hold_stale_game_loads.sql`

`CREATE OR REPLACE` replaces only `public.fail_stale_game_loads(integer, uuid, text)`. The body reads its arguments and returns `0`. It does not call `refund_game_load_wallet`. It does not `UPDATE`, `INSERT`, or `DELETE`. It does not set `status = 'failed'`.

The same `REVOKE` and `GRANT` statements are repeated: `PUBLIC`, `anon`, and `authenticated` cannot execute it; `service_role` can.

Unchanged: `fail_my_stale_game_load`, `complete_game_load`, `refund_game_load_wallet`, `request_game_load`, `request_auto_game_load`, `mark_game_api_debited`, and `request_game_account_create`.

After this replacement, `fail_my_stale_game_load` still delegates, so a player heal returns `0` and leaves the row open. `request_game_account_create` still calls the function, but that call no longer clears a stale open request. An open pending or processing row continues to block a new account-creation request. That block is intentional.

## Deployment prerequisites

- Owner approval to apply one file in production.
- A fresh catalog read showing the installed `fail_stale_game_loads` still refunds `load` / `reload` and sets `failed`. Stop if the installed body is already the `RETURN 0` version or is some other definition.
- A backup, below, taken before the `CREATE OR REPLACE`.
- Apply only `20261015000180_hold_stale_game_loads.sql`. Do not replay older migrations. Do not run `20261013000130` as a separate manual step if this file is applied; both files install the same safe body, and applying either one is enough.
- Do not call `fail_stale_game_loads`, `fail_my_stale_game_load`, or `refund_game_load_wallet` during the deploy.

## Database backup

Before the replace, save:

- `pg_get_functiondef` for `fail_stale_game_loads` and `fail_my_stale_game_load`.
- A full database backup from the Supabase backup tool, or a logical dump of `public.game_load_requests`, `public.profiles` wallet columns, and `public.wallet_transactions`.

This migration does not edit those tables. The backup is for the function body and for any refund the old function may still issue if something calls it before the replace commits.

## Rollback limitations

There is no down migration. Restoring the previous body means running the `CREATE OR REPLACE` from `20261008000160_financial_trust.sql` again. That restore brings back timeout refunds.

Refunds already credited by the old function stay credited. This migration does not reverse them, and a rollback does not remove them either.

`CREATE OR REPLACE` keeps the same argument types, so existing callers do not need a signature change. It does not drop dependent functions.

## Verification queries

Run these in the SQL editor. They do not call the financial functions.

```sql
SELECT version
FROM supabase_migrations.schema_migrations
WHERE version IN ('20261008000160', '20261013000130', '20261015000180')
ORDER BY version;
```

```sql
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       (pg_get_functiondef(p.oid) ILIKE '%refund_game_load_wallet%') AS mentions_refund,
       (pg_get_functiondef(p.oid) ILIKE '%RETURN 0%') AS returns_zero,
       (pg_get_functiondef(p.oid) ILIKE '%status = ''failed''%') AS sets_failed,
       (pg_get_functiondef(p.oid) ILIKE '%UPDATE%') AS mentions_update
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('fail_stale_game_loads', 'fail_my_stale_game_load')
ORDER BY 1, 2;
```

After a successful apply, `fail_stale_game_loads(integer, uuid, text)` has `mentions_refund` false, `returns_zero` true, `sets_failed` false, and `mentions_update` false. `fail_my_stale_game_load(integer, text)` still mentions `fail_stale_game_loads` and does not contain its own refund.

```sql
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name = 'fail_stale_game_loads'
ORDER BY grantee, privilege_type;
```

Expected execute grant: `service_role` only.

## Local test

`node scripts/stale-load-hold.test.mjs`

The test reads the new migration. It checks the signature, the grants, `RETURN 0`, and the absence of refund and row changes. It then models pending, processing, timeout, and unknown rows, calls that model twice, and expects status and refund count to stay unchanged.

## Remaining risk

Open timed-out loads stay pending. The website wallet stays debited until a confirmed provider failure is refunded by the automatic finish path, or a person resolves the row with a stored outcome. This file does not add that outcome column. `request_auto_game_load` and `mark_game_api_debited` are unchanged.
