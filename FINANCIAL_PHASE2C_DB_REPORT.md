# Financial Phase 2C — Database function verification

Read-only investigation. No financial function was executed. No customer row was read or changed. No migration was applied. No provider was called.

Production function definitions were **not** verified. Local `.env.local` has no `DATABASE_URL` and no `SUPABASE_DB_URL`, so this session had no read-only Postgres connection. The Supabase data API cannot read `pg_proc` or `supabase_migrations.schema_migrations`. Do not treat any function below as matched to production.

The queries at the end are `SELECT` only. Run them in the Supabase SQL editor. Do not call the seven functions, and do not run `UPDATE`, `INSERT`, `DELETE`, or DDL.

## 1. fail_stale_game_loads

| | |
|---|---|
| Latest local migration | `supabase/migrations/20261013000130_hold_unknown_game_loads.sql` |
| Earlier local definition | `supabase/migrations/20261008000160_financial_trust.sql` |
| Installed production definition | Not verified |
| Match | Unknown |

Latest local body takes `(integer, uuid, text)`, returns `0`, and does not call `refund_game_load_wallet` or set `status = 'failed'`. The file itself says not to run it until the owner approves it.

The `20261008000160` body selects open rows, refunds `load` / `reload`, and marks them `failed`.

**Financial risk.** If production still has the `20261008000160` body, a stale check can refund the website wallet after the provider already added game credit. That is a house loss. If the `20261013000130` body is installed, this function does not refund, but it also does not close the row.

**Next action.** Compare `pg_get_functiondef` with both files. Do not apply `20261013000130` from this report.

## 2. fail_my_stale_game_load

| | |
|---|---|
| Latest local migration | `supabase/migrations/20261008000160_financial_trust.sql` |
| Installed production definition | Not verified |
| Match | Unknown |

This is the only local definition. Signature is `(integer, text)`. It requires `auth.uid()` and returns `fail_stale_game_loads(p_stale_minutes, v_user, p_game_slug)`. No later migration replaces it.

**Financial risk.** This function has no refund statement of its own. Its money effect is whatever `fail_stale_game_loads` is actually installed. A missing or erroring function is what used to send the app into `finishGameLoad(success: false)`. That app fallback is removed in the uncommitted Phase 2B change; the database function is unchanged.

**Next action.** Confirm the installed signature is `(integer, text)` and that its body only delegates to `fail_stale_game_loads`. Then judge `fail_stale_game_loads`, not this wrapper.

## 3. complete_game_load

| | |
|---|---|
| Latest local migration | `supabase/migrations/20261008000210_create_requires_game_row.sql` |
| Earlier local definitions | `20261008000190_auto_money.sql`, then `20261008000160`, then July 2026 files |
| Installed production definition | Not verified |
| Match | Unknown |

Latest local signature is `(uuid, boolean, text, text, text, numeric)`. It updates only `pending` / `processing` rows. On failure of `load` / `reload` it calls `refund_game_load_wallet`. On success it can set `game_api_debited` inside this function. A successful `create_account` / `new_account` with no games row or no username is marked failed and does not keep a username. The phrases `No games row` and `Provider did not return a username` are in this version and not in `20261008000190`.

**Financial risk.** An older body can still refund `load` / `reload` on failure, which is correct only when the provider failure is real. The latest body still raises `Account not found` after a separate `mark_game_api_debited` call from the app, so a failed finish can leave the wallet debited and block a later refund. Matching the latest file does not remove that risk.

**Next action.** Confirm the installed body contains `No games row` and `Provider did not return a username`. Do not replace the function until that comparison is done.

## 4. refund_game_load_wallet

| | |
|---|---|
| Latest local migration | `supabase/migrations/20261011000280_refund_wallet_refunded_column.sql` |
| Earlier local definitions | `20261008000200_refund_load_and_reload.sql`, then `20261008000190_auto_money.sql` |
| Installed production definition | Not verified |
| Match | Unknown |

Latest local signature is `(uuid)`. It returns immediately when the row is missing, `wallet_refunded` is true, `game_api_debited` is true, the type is not `load` / `reload`, or the amount is not positive. Otherwise it adds `amount` back to `wallet_balance`, inserts a `game_load_refund` credit, and sets `wallet_refunded`.

The function text in `20261011000280` matches the function text in `20261008000200` (`COALESCE(v_row.wallet_refunded, false)`). `20261011000280` also adds `wallet_refunded` and `game_api_debited` if they are missing. `20261008000190` checks `v_row.wallet_refunded` without `COALESCE`. The migration comment says the live function failed because that field did not exist.

A function-body match cannot by itself tell `20261008000200` from `20261011000280`. The migration history row is the record that the column change was applied.

**Financial risk.** If the column or the `COALESCE` guard is missing, a confirmed-failure refund errors and the wallet stays debited. If an older body refunds without checking `game_api_debited`, a provider success can still be refunded.

**Next action.** Confirm both columns exist and the installed body uses `COALESCE(v_row.wallet_refunded, false)` and `game_api_debited`. Then check whether `20261011000280` is in `schema_migrations`.

## 5. request_game_load

| | |
|---|---|
| Latest local migration | `supabase/migrations/20261008000160_financial_trust.sql` |
| Earlier local definition | `supabase/migrations/20260720000200_game_load_rpc_fix.sql` |
| Installed production definition | Not verified |
| Match | Unknown |

Latest local signature is `(text, text, numeric, text, text)`. It drops the older six-argument form that took `p_game_username`. For `load` / `reload` it locks the profile, subtracts the wallet once, and inserts one pending row. The open-request check is not under that same lock.

**Financial risk.** Two overlapping calls can each pass the open-request check and each debit the wallet. An installed six-argument overload would mean the July function is still callable.

**Next action.** List every installed overload. The expected result is one function, `(text, text, numeric, text, text)`, whose body contains `A request is already in progress`.

## 6. request_auto_game_load

| | |
|---|---|
| Latest local migration | `supabase/migrations/20261008000130_auto_ops.sql` |
| Installed production definition | Not verified |
| Match | Unknown |

This is the only local definition. Signature is `(uuid, text, text, numeric, text, text)`. Service role only. An existing `source_key` in `completed`, `pending`, or `processing` returns that id. A failed row with `wallet_refunded = false` is set back to `processing` and returned. The body does not read `game_api_debited`.

**Financial risk.** Matching the latest file still allows one wallet debit and a second provider credit when a failed row was already sent to the game. This is the auto-retry risk from the Phase 1 audit.

**Next action.** Confirm the installed body reopens a non-refunded row without a `game_api_debited` check. Do not replace it until a later change is reviewed. A safe change has to keep the same signature and stop the provider retry when that flag is already true.

## 7. mark_game_api_debited

| | |
|---|---|
| Latest local migration | `supabase/migrations/20261008000190_auto_money.sql` |
| Installed production definition | Not verified |
| Match | Unknown |

This is the only local definition. Signature is `(uuid)`. It sets `game_api_debited = true` for that id with no status check and no lock shared with `complete_game_load`.

**Financial risk.** The latest local definition is already the risky one. The app commits this flag, then calls `complete_game_load`. If the second call fails, a later refund is refused and a retry can credit the game again. A production match does not make this safe.

**Next action.** Confirm the installed body is this unconditional update. Leave it in place until the flag and `complete_game_load` can be one transaction. Do not apply a new migration in this step.

## SELECT-only checks for manual review

Run these in the SQL editor. They read the catalog and migration history only.

```sql
SELECT version
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20261008000130',
  '20261008000160',
  '20261008000190',
  '20261008000200',
  '20261008000210',
  '20261011000280',
  '20261013000130'
)
ORDER BY version;
```

```sql
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args
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
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       (pg_get_functiondef(p.oid) ILIKE '%refund_game_load_wallet%') AS mentions_refund,
       (pg_get_functiondef(p.oid) ILIKE '%RETURN 0%') AS returns_zero,
       (pg_get_functiondef(p.oid) ILIKE '%status = ''failed''%') AS sets_failed,
       (pg_get_functiondef(p.oid) ILIKE '%No games row%') AS no_games_row,
       (pg_get_functiondef(p.oid) ILIKE '%Provider did not return a username%') AS missing_username,
       (pg_get_functiondef(p.oid) ILIKE '%COALESCE(v_row.wallet_refunded, false)%') AS coalesce_refunded,
       (pg_get_functiondef(p.oid) ILIKE '%game_api_debited%') AS mentions_debited,
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

To read one full definition after the markers, use `SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'fail_stale_game_loads';` and the same form for each name. That reads the source. It does not run the function.

What a safe installed set would show:

- `fail_stale_game_loads(integer, uuid, text)`: `returns_zero` true, `mentions_refund` false, `sets_failed` false, and version `20261013000130` present.
- `fail_my_stale_game_load(integer, text)`: `mentions_refund` true only because it calls `fail_stale_game_loads`.
- `complete_game_load(uuid, boolean, text, text, text, numeric)`: `no_games_row` true and `missing_username` true.
- `refund_game_load_wallet(uuid)`: `coalesce_refunded` true and `mentions_debited` true, plus version `20261011000280` present.
- `request_game_load`: one row, arguments `text, text, numeric, text, text`, `open_request_guard` true.
- `request_auto_game_load`: `uses_source_key` true and `mentions_debited` false.
- `mark_game_api_debited(uuid)`: `mentions_debited` true and no status predicate in the full definition.

## Result

Production is unverified. The highest-risk unknown is `fail_stale_game_loads`: the latest local file is the no-refund version, and the previous local file refunds timed-out loads. `mark_game_api_debited` and `request_auto_game_load` remain risky even if production matches the latest local files.
