# Sweepstakes Hub launch report

Date: 18 October 2026

Decision: **NO-GO for a real-money launch today.**

A public safety release is prepared and was not published. No production SQL was applied. No credential was rotated. No deposit, payout, game transfer, or identity decision was made. The old Spinora project was not contacted.

Real money stays off because login recovery, storage files, Paydora, game transfers, legal approval, and secret rotation are not all verified. The deadline does not override those gates.

## Owner decision needed

Say yes or no to one letter at a time. A yes on one letter is not a yes on the next. "Launch today" is not approval to turn money on.

| Letter | Action | Ready now? |
| --- | --- | --- |
| A | Remove the Paydora API key and republish the current website so new checkouts stop. Do not publish the new build in this step. | Waiting for yes |
| B | Pause Juwa, Game Vault, Vegas Sweeps, Cash Frenzy, Cash Machine, Game Room, Mr All In One, and Mafia. | Waiting for yes |
| C | Apply only the database money guard, with all five rows left off. | Waiting for yes |
| D | Publish the reviewed local build to `https://www.sweeptakehub.com`. | Waiting for yes. Do this only after A, B, and C are verified. |
| E | Apply the identity repair. | Waiting for a later yes. The real pending identity was not used as a test. |
| F | Apply the stale-load repair. | Waiting for a later yes. |
| G | Rotate each exposed credential named in `SECRET_ROTATION_CHECKLIST.md`. | Waiting for a separate yes per secret. Do not paste new values into chat. |
| H | Enable deposits. | No. Paydora and legal gates are not verified. |
| I | Enable game loads for a named provider. | No. No provider load was verified. |
| J | Enable redemptions. | No. |
| K | Enable payouts. | No. |
| L | Enable staff wallet adjustments. | No. |

Do not approve H, I, J, K, or L today.

## 1. Fixes completed

No new application formula was changed in this pass. Existing local fixes remain uncommitted and undeployed.

| Fix | Status |
| --- | --- |
| Five money switches fail closed unless the value is exactly `on` | FIXED LOCALLY |
| Staff grants and cash wheel prizes use the adjustment switch | FIXED LOCALLY |
| Webhook credits require a paid status, the same amount, and USD. Missing currency is held. | FIXED LOCALLY |
| Location headers are trusted only when `VERCEL` is exactly `1` | FIXED LOCALLY |
| Database money guard | VERIFIED IN ISOLATED TEST on a restored copy of the live public schema. Not applied to production. |
| Identity repair with `app.kyc_status_update` | VERIFIED IN ISOLATED TEST on that restored copy. Not applied to production. |
| Stale loads marked once, without a refund | VERIFIED IN ISOLATED TEST on that restored copy. Not applied to production. |
| Production dependency audit | FIXED LOCALLY. `npm audit --omit=dev` found 0 issues. Not deployed. |

The live site is still the older deployment. None of the rows above are VERIFIED IN PRODUCTION.

## 2. Tests executed

- 39 application scripts, including webhook, payout reservation, deposit, identity, stale-load, staff access, age, and location checks
- TypeScript, ESLint, and a production build
- Production dependency audit
- Disposable Postgres run from the earlier guard session: 25 checks
- New restore: production schema and public data loaded into an isolated Postgres 17.11 database, then the three SQL files were applied only there
- Public site: home, play, Juwa, and login in the browser. Home, play, login, privacy, terms, FAQ, robots, and sitemap returned HTTP 200.

No sandbox payment was sent. No game provider was called. No real identity file was opened.

## 3. Test results

| Check | Result |
| --- | --- |
| 39 application scripts | PASS, 0 failed |
| TypeScript | PASS |
| ESLint | PASS, existing warnings only |
| Production build | PASS |
| `npm audit --omit=dev` | 0 findings |
| Restored copy: direct load and redeem blocked while controls are off | PASS |
| Restored copy: deposit credit blocked and balance unchanged | PASS |
| Restored copy: zero-amount account request still inserts | PASS |
| Restored copy: identity flag cannot change a wallet balance | PASS |
| Restored copy: approval saves without changing balance or role | PASS |
| Restored copy: stale row marked once, stays open, and is not refunded | PASS |
| Restored copy: the five original profiles' combined balances stayed 0.00 | PASS |
| Concurrent database race on the restored copy | NOT VERIFIED. Earlier payout and webhook overlap tests were in memory. |
| Live Paydora checkout, webhook, or payout | NOT VERIFIED |
| Live game load or redeem | NOT VERIFIED |

## 4. Backup verification

The hosted plan does not provide the managed backup the owner asked for. A manual `pg_dump` was taken from project `zecitlewsynyioemsqna` and stored outside git.

Encrypted files:

- `C:\Users\asus\AppData\Local\SweepstakesHubBackups\2026-10-18\schema.sql.aes`
- `C:\Users\asus\AppData\Local\SweepstakesHubBackups\2026-10-18\data.sql.aes`
- `C:\Users\asus\AppData\Local\SweepstakesHubBackups\2026-10-18\app-data.sql.aes`

The decryption key is `backup.key` in that same folder. It is not in git and it is not printed here. Plaintext dumps were deleted. The disposable database was deleted after the checks.

| Piece | Result |
| --- | --- |
| Public schema, functions, triggers, policies, indexes | VERIFIED IN ISOLATED TEST. The schema file restored with exit 0. |
| Profiles, game loads, identity rows, payment intent | VERIFIED IN ISOLATED TEST. Counts matched the dump: 5 profiles, 13 game-load requests, 1 identity submission, 1 payment intent, 0 wallet-ledger rows, 0 webhook rows, 0 processed Paydora events. Combined wallet and cash-out totals were 0.00. |
| Auth logins | BLOCKED. The dump contains 5 auth users. Restore stopped because the disposable server's auth tables do not match production column names. Logins are in the encrypted file and were not proven restorable. |
| Storage files | NOT VERIFIED. The dump lists 6 buckets and 1 stored object. The object bytes were not downloaded, and the storage tables were not restored. |
| Point-in-time recovery in the Supabase dashboard | NOT VERIFIED |

Because login restore is not proven, this backup is not a complete disaster-recovery test. That blocks real-money activation and any production SQL until you accept that limit or a later restore of auth succeeds.

## 5. Database compatibility

Compared from the production schema dump, then retested by applying the three files to the restored copy only.

| Item | Result |
| --- | --- |
| `audit_logs` has `before_data`, `after_data`, `ip_address`, and `user_agent` | VERIFIED IN ISOLATED TEST |
| `real_value_controls` is absent on production | VERIFIED IN ISOLATED TEST |
| Wallet kinds include deposit, game load, redeem, refund, adjustment, and payout | VERIFIED IN ISOLATED TEST |
| Ledger wallet types are `current` and `cashout` | VERIFIED IN ISOLATED TEST |
| Live stale function returns 0 and does not refund | VERIFIED IN ISOLATED TEST |
| Live identity function does not set `app.kyc_status_update` | VERIFIED IN ISOLATED TEST |
| A second trigger, `protect_wallet_columns`, blocks wallet edits unless the service role or the wallet flag is used | VERIFIED IN ISOLATED TEST. The identity flag does not override it. |
| All three migration files apply to that schema | VERIFIED IN ISOLATED TEST |
| Production auth function `auth.role()` | NOT VERIFIED. It was not in the public dump. The approval test on the restored copy set the role claim directly. |

The three files were not applied to `zecitlewsynyioemsqna`.

## 6. KYC status

Production approval is still BLOCKED. The live function can pass its role check and then the profile guard rolls the decision back.

On the restored copy, the new function approved a synthetic identity, left the balance and role unchanged, and the wallet trigger rejected a balance edit made under the identity flag. The real pending submission was not approved or rejected. There is 1 identity submission in the backup. Its document file was not downloaded.

Private document access on the live bucket remains NOT VERIFIED in this pass.

## 7. Paydora deposit status

NOT VERIFIED against Paydora.

The owner reports that Paydora accepts sweepstakes transactions. That remains owner-reported. No provider document or sandbox payment in this session confirms it.

Local webhook rules are FIXED LOCALLY and covered by the application tests. They were not sent a real callback. The currency field name in a live Paydora payload is still NOT VERIFIED. Until a real payload shows USD, the new code holds the callback instead of crediting it.

No customer payment was created. One payment-intent row exists. Its status was not opened. There are no webhook rows and no processed Paydora events in the backup. Do not credit that intent from the browser.

## 8. Paydora payout status

NOT VERIFIED. No payout was submitted, acknowledged, rejected, or voided against Paydora. Duplicate-payout protection was tested in memory and, on an earlier disposable database, for the payout debit function. It was not tested with a live payout.

The backup has 0 payout-request rows.

## 9. Game-provider readiness

No provider was called. Catalog and pause flags below are from the restored production data.

| Provider | Catalog | Paused | Load, redeem, reconciliation |
| --- | --- | --- | --- |
| Juwa | Active | No | NOT VERIFIED |
| Game Vault | Active | No | NOT VERIFIED |
| Vegas Sweeps | Active | No | NOT VERIFIED |
| Cash Frenzy | Active | No | NOT VERIFIED |
| Cash Machine | Active | No | NOT VERIFIED |
| Game Room | Active | No | NOT VERIFIED |
| Mr All In One | Active | No | NOT VERIFIED |
| Mafia | Active | No | NOT VERIFIED |
| Fire Kirin | Inactive | Yes | NOT VERIFIED |
| Milky Way | Inactive | Yes | NOT VERIFIED |
| Orion Stars | Inactive | Yes | NOT VERIFIED |
| Panda Master | Inactive | No pause row | NOT VERIFIED |
| VBlink | Inactive | No pause row | NOT VERIFIED |

Real-value status for every provider: disabled. A successful balance read would not change that. None was attempted.

## 10. Security status

| Item | Status |
| --- | --- |
| Application auth, staff, rate-limit, and webhook signature tests | VERIFIED IN ISOLATED TEST through the 39 scripts |
| Live session, admin, store, and sub-creator screens | NOT VERIFIED. No production login was used. |
| RLS policies in the restored schema | Present in the restored schema. Not re-probed as each role on production. |
| Service-role key exposure and rotation | NOT VERIFIED. Nothing was rotated. |
| Age 18 and the four-state block in the new code | FIXED LOCALLY. Not deployed. Counsel has not approved either rule. |
| Secrets printed | None |

Staff-panel tests in the repo passed. That is not a live authorization audit.

## 11. Legal approval status

NOT VERIFIED. No lawyer's letter, license, registration, official rules approval, or free-entry method was found. The terms page says 18 or older. That page is not legal approval. The code still blocks Washington, Idaho, Nevada, and Michigan for money actions in the undeployed build. The live play page still links to Michigan and Nevada as public location pages. Do not treat those links as permission to take money there.

Payment-provider authorization is owner-reported only.

## 12. Production deployment ID

No new deployment was published. The last recorded production deployment is `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT`. This session did not replace it.

The public site responded on `https://www.sweeptakehub.com`. Home, the game catalog, the Juwa page, and the login page rendered. The home view showed the phone navigation. The play catalog showed the wider layout. Signed-in dashboard, admin, staff, and store screens were not opened.

## 13. Production SQL applied

None.

These files were applied only to the disposable restored copy:

- `supabase/migrations/20261017000600_real_value_db_guard.sql`
- `supabase/migrations/20261017000500_kyc_decision_profile_guard.sql`
- `supabase/migrations/20261017000200_hold_stale_game_loads_for_review.sql`

## 14. Environment configuration status

All five switches are off because they are absent, not because they were set to a blocking word.

- `REAL_VALUE_DEPOSITS`
- `REAL_VALUE_GAME_LOADS`
- `REAL_VALUE_REDEMPTIONS`
- `REAL_VALUE_PAYOUTS`
- `REAL_VALUE_ADJUSTMENTS`

They are absent on this computer. They were not listed in the Vercel production environment for `cashoutanytime` when checked earlier today. The live deployment does not use them, so the current website can still move money until A and C are done.

A Vercel change does not alter an instance that is already running. Shutdown counts only after a new instance is serving the domain and the check is repeated.

## 15. Real-money features

| Feature | State |
| --- | --- |
| Deposits | Disabled in the undeployed code. Still possible on the live site if the Paydora key is loaded. |
| Game loads | Disabled in the undeployed code. Direct database calls still work on production until C. |
| Redemptions | Same as game loads. |
| Payouts | Disabled in the undeployed code. Still possible on the live site until the key is removed and C is applied. |
| Staff adjustments | Disabled in the undeployed code. Not enforced in the live database until C. |
| Refunds and payout voids after C | Stay possible on purpose so an already accepted payment can be reversed. |

Nothing was enabled.

## 16. Remaining blockers

1. Auth data is backed up and was not restored. Full recovery is BLOCKED.
2. The one stored file was not backed up as bytes. Storage restore is NOT VERIFIED.
3. Paydora checkout, webhook payload, refund, and payout are NOT VERIFIED.
4. No game provider load, redeem, or reconciliation is verified.
5. Legal approval is missing.
6. Credentials named in the rotation checklist are not rotated.
7. The live site has no money switches and no database guard.
8. Eight active games are not paused.
9. Identity approval is still broken on production.
10. Stale loads on production return 0 and are not marked for review.
11. Dashboard, admin, and store flows were not signed into.
12. One payment intent exists and was not reconciled.

## 17. Required owner approvals

Use the letter table at the top. The safe order is A, then B, then C, then D. E and F are separate and can wait. G is separate for each secret. H through L stay closed.

Dropping a money-guard trigger reopens a direct game-load debit. That was proven on an earlier disposable database. Do not use that as the rollback. Re-running the guard file does not turn a row back off if someone enables it.

## 18. GO / NO-GO

| Gate | Decision |
| --- | --- |
| Real-money launch today | NO-GO |
| Enable any of the five money switches | NO-GO |
| Apply production SQL now | NO-GO until you approve C, E, or F one at a time |
| Publish the safety build | READY FOR A SEPARATE YES, and only after A, B, and C |
| Public browsing | The current site is up. It is not a safe money platform. |

This report does not promise zero bugs. It records the tests that ran and the gates that did not.
