# Restoration test results

Disposable database: local container `supabase_db_supabase-migration-test`. Hosted projects were not used for these tests. No payment and no provider call was made.

| Test | Result | Evidence | If it failed |
| --- | --- | --- | --- |
| Catalog script, second run, stricter active and inactive check | PASS | Inserts were 0, 0, 0. Then 12 active, 19 inactive, 5 categories. | `scripts/catalog/restore-public-catalog.sql` |
| Catalog does not create users | PASS | `auth.users` 0 and `profiles` 0 after the run. | same file |
| Stale-load hold | PASS | Function applied on the disposable database. Test block completed and rolled back. | `supabase/migrations/20261017000200_hold_stale_game_loads_for_review.sql`, `scripts/catalog/test-stale-hold.sql` |
| Stale hold does not refund | PASS | Wallet stayed 0. Status stayed pending or processing. `wallet_refunded` stayed false. | same test |
| Confirmed completed load is left alone | PASS | Completed row was not marked held. | same test |
| Provider-flagged stale load is not refunded | PASS | Note says the provider flag is set. Status stayed processing. | same test |
| Second stale run | PASS | Returned 0. | same test |
| Signed-in player cannot call `fail_stale_game_loads` | PASS | Authenticated role received insufficient privilege. | same test |
| No leftover test users | PASS | `auth.users` 0 and `game_load_requests` 0 after rollback. | same test |
| Unknown provider result is not refundable | PASS | `load-outcome checks passed` | `scripts/catalog/test-load-outcome.mjs` |
| Confirmed failure after the provider flag is not refundable | PASS | same output | same file |
| A second refund is not allowed | PASS | `walletRefunded: true` returns false | same file |
| Admin screen cannot move load money from the stored row | PASS | `proceed` is false | same file |
| Failed stale RPC does not refund in the app | PASS | `appRefund` is false and healed count is 0 | same file |
| Hosted catalog apply | PASS | Before: 0 categories, 0 games, 2 users, 2 profiles, 0 wallet transactions, 0 provider configs. After: 5 categories, 12 active games, 19 inactive games, 31 total, 0 duplicate slugs. Users, profiles, wallet transactions, and provider configs were unchanged. | `scripts/catalog/restore-public-catalog.sql` |
| Hosted stale-load migration | NOT RUN | Needs a separate approval. | migration file above |
| Paydora sandbox | NOT TESTED | No call | Paydora routes |
| Provider load or redeem | NOT TESTED | No call | game automation |
| Signup inbox | NOT TESTED | SMTP is still an owner setup | signup form |
| Typecheck | PASS | `tsc --noEmit` exited 0. | `package.json` |
| Lint | PASS with existing warnings | `next lint` exited 0. Warnings are existing image and hook notices. None are in the signup or stale-load edits. | `package.json` |
| Production build | PASS | `next build` completed. 123 static pages generated. Not deployed. | `package.json` |
| Browser admin click-through | NOT TESTED | Not opened | admin pages |

The project has no unit-test script in `package.json`. The checks above are the ones executed.
