# Final launch readiness report

## 1. Audit date

17 October 2026

## 2. Repository commit

Branch: `restore/public-game-catalog`

Commit: `2f170db003abd97a3d754d7ee7c6df8668c79994`

Remote: `https://github.com/spinoraoffical-create/Cashoutanytime.git`

`origin/main` was last recorded at `b6afbc6bee32b912e6c9d97aaa732ef47073c13c`. Production was not deployed from `main`.

Uncommitted files are not in the live deployment. They include the local KYC screen and helper, the unapplied KYC SQL, and the unapplied stale-load SQL. This audit added three report files only.

## 3. Production deployment ID

`dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT`

Vercel project: `cashoutanytime` (`prj_ZF2oBLDLZVkBTQe3SyEokAdhffkz`)

`npx vercel inspect https://www.sweeptakehub.com` resolved the public domain to that deployment. Status: Ready. Target: production. Created 17 October 2026 at 17:09 Nepal time.

The deployment does not contain the later uncommitted KYC fix.

## 4. Supabase project verification

Read-only SQL was run with `npx supabase db query --linked --project-ref zecitlewsynyioemsqna`.

The old project `muetgtzcbecsqigtpfyn` was not contacted. That id is absent from application source, the homepage, the play page, robots, and the sitemap.

Production has the names `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Values were not printed. The public pages checked did not embed either project id in HTML. The service-role name is not a `NEXT_PUBLIC_` name. Server code can fall back to the anon key only when the service-role key is missing. Production has the service-role name.

## 5. Executive summary

Do not launch real-money play today.

The public site loads. The catalog, sitemap, robots file, privacy page, and terms page respond. That is not a launch approval.

Identity approval is still broken on the live database. Deposits are not switched off. Seven active games have production credentials and are not paused. The server does not enforce age 18. Secrets that were previously exposed have no recorded rotation. Legal approval was not established.

No wallet transaction and no deposit request is stored. Existing game-load rows total 0.00. One payment intent exists. One identity request is pending. The site has not yet shown a credited player deposit, and the paths that could take money are still present.

## 6. Systems reviewed

Repository, Vercel project and domain, Supabase schema flags and selected functions, signup code, KYC code and live function, wallet and deposit code, payout code, game-provider pause rows, stale-load function, state headers, admin permission source, email and SMS configuration names, public pages, and dependency audit.

## 7. Tests executed

37 local script tests, TypeScript, lint, production build, dependency audit, public HTTP checks, Vercel inspect, and read-only SQL. Details are in `LAUNCH_TEST_RESULTS.md`.

## 8. Tests passed

All 37 local scripts, `npx tsc --noEmit`, `npx next lint` with warnings only, and `npm run build`. Public homepage, play, games redirect, robots, sitemap, login, privacy, terms, and FAQ returned success codes. RLS is enabled on profiles, KYC submissions, and wallet transactions. The KYC bucket is private. The live stale-load function does not update or refund.

## 9. Tests failed

`npm audit --omit=dev` reports 1 critical and 8 high production findings. The critical package is Next.js 15.5.19.

The live KYC function failed the launch check because it still has no `set_config` call. That is a production defect, not a failed unit test.

## 10. Tests not executed

Live signup, login, logout, password reset, KYC approve, KYC reject, Paydora payment, Paydora webhook delivery, payout, recharge, redemption, mobile clicks, backup restore, and secret rotation.

An unexecuted test is not a pass.

## 11. Critical vulnerabilities

- Signup and deposit code do not enforce 18+.
- Previously exposed game-agent credentials and the database password have no rotation record in this audit.
- Next.js 15.5.19 has a critical dependency advisory. It was not exploited here.

## 12. High-priority defects

- Admin Approve on a pending identity check cannot save. The live function rolls back.
- Paydora checkout is configured and not disabled.
- Active credentialed games are not paused.
- State blocking depends on Vercel IP headers, and middleware does not run on `/api`.
- Dependency audit has eight additional high findings.

## 13. Production configuration risks

- `NEXT_PUBLIC_SITE_URL` is unset. The code fallback and the live canonical still use `https://www.sweeptakehub.com`. Do not copy a preview URL into production.
- `RESTRICTED_STATES` is unset, so the default is Washington, Idaho, Nevada, and Michigan.
- `RESEND_API_KEY`, Twilio, Telegram, and `CRON_SECRET` are absent. Cron calls fail closed. Transaction mail and SMS were not proven.
- `platform_ops` is empty, so the payout route holds the request and does not charge the wallet.
- GitHub `main` is not the deployed commit.
- Local `.env.local` was not used for these conclusions.

## 14. Financial safety assessment

FAIL for a real-money launch.

No double-credit was observed because no wallet transaction exists. That is not proof the credit function is safe under two webhooks. Local tests cover source rules only.

The live stale-load function does not refund. The safer review-hold SQL is not applied.

Completed game-load rows exist for Juwa, Game Vault, Game Room, Cash Frenzy, and Vegas Sweeps. Their amounts sum to 0.00. They are not evidence of a safe recharge.

`wallet_transactions` = 0. `deposit_requests` = 0. `payment_intents` = 1.

## 15. KYC assessment

FAIL in production.

The button, server action, and RPC exist. The live function does not set the profile-guard flag, so the status update rolls back. One submission is pending. Its document was not opened. The `kyc-documents` bucket is private. Reviewer and time already belong in `audit_logs` when a decision succeeds. There is no reviewer column on `kyc_submissions`.

The local fix was not deployed and its SQL was not applied. Local tests of that fix do not make production pass.

## 16. Game-provider readiness

FAIL for real-money use.

| Provider | Catalog | Pause row | Production credentials | This audit | Status |
| --- | --- | --- | --- | --- | --- |
| Fire Kirin | Inactive | Paused | Names present | No live call | BLOCKED |
| Juwa | Active | None | Names present | No live call. Six zero-amount completed rows. | NOT TESTED |
| Orion Stars | Inactive | Paused | Names present | No live call | BLOCKED |
| Game Vault | Active | None | Names present | No live call. Two zero-amount completed rows. | NOT TESTED |
| Vegas Sweeps | Active | None | Names present | No live call. One zero-amount completed row. | NOT TESTED |
| Milky Way | Inactive | Paused | Names present | No live call. One failed zero-amount row. | BLOCKED |
| Panda Master | Inactive | None | No name found | No live call | BLOCKED |
| Cash Frenzy | Active | None | Names present | No live call. One zero-amount completed row. | NOT TESTED |
| VBlink | Inactive | None | No name found | No live call | BLOCKED |
| Mafia | Active | None | No name found | No live call | BLOCKED |
| Mr All In One | Active | None | Names present | No live call | NOT TESTED |
| Cash Machine | Active | None | Names present | No live call | NOT TESTED |
| Game Room | Active | None | Names present | No live call. Two zero-amount completed rows. | NOT TESTED |

Automatic account creation is off in source: `TERMINAL_ACCOUNT_CREATION_ARMED = false`.

## 17. Payment readiness

NOT VERIFIED.

Paydora create, signed webhook, and read-only status exist in code. NOWPayments was not found. A browser success response is not the credit path. Duplicate webhook behavior was not executed. One payment intent exists and no deposit request or wallet credit is stored.

Payouts currently hold because `platform_ops` is empty. Local tests say a repeated reserved payout should not call the provider twice. That was not proven on the live database.

## 18. Legal and compliance verification gaps

NOT VERIFIED.

Privacy and terms pages return 200. Terms say 18+. Responsible-play controls exist behind the dashboard. This audit found no no-purchase-necessary page and no free-entry method page. A code review cannot prove a real-money sweepstakes is legal in the intended US markets. Payment-provider approval was not shown. Counsel must review eligibility, age, state list, official rules, and payment approval before any money launch.

## 19. SEO readiness

The public site is technically reachable. Homepage 200. Play canonical is `https://www.sweeptakehub.com/play`. `/games?q=juwa` returns 308 to `/play?q=juwa`. Robots points at the www sitemap. Sitemap has 182 URLs and 8 game URLs. Login is noindex. Zero Google clicks are not a technical blocker. This audit does not claim all 182 URLs are indexed.

## 20. Operational readiness

FAIL for a funds platform.

Deposits are not disabled. Individual providers are not all paused. Withdrawals hold only because the settings row is missing. Game loads are not globally disabled. Cron fails closed because `CRON_SECRET` is missing. Backup and restore were not verified. Rollback is possible through Vercel deployment history, and this audit did not perform one.

## 21. Exact remaining launch blockers

1. Enforce 18+ on the server.
2. Rotate exposed credentials and record the rotation.
3. Fix and prove KYC approve and reject without using the real pending record.
4. Keep deposits, game loads, redemptions, and payouts off until their mock tests pass against the deployed build.
5. Close the state-check gap on money actions.
6. Resolve or accept, in writing, the critical Next.js advisory.
7. Obtain legal and payment-provider review.

The full list is in `LAUNCH_BLOCKERS.md`.

## 22. Required fixes

- Add a server-side age rejection before account creation and before every money action.
- Rotate the exposed secrets. Do not print the new values.
- After written approval, apply only `supabase/migrations/20261017000500_kyc_decision_profile_guard.sql` on `zecitlewsynyioemsqna`, then deploy the matching screen. Do not apply it during this audit.
- Add an explicit off switch for deposits and for each provider transfer, and prove it with fixtures.
- Apply the stale-load review hold only after a separate approval. Do not refund unknown loads.
- Do not start from the uncommitted working tree until those fixes are reviewed again.

## 23. Evidence supporting each conclusion

- Domain and deployment: `npx vercel inspect https://www.sweeptakehub.com`.
- Commit and dirty tree: `git rev-parse` and `git status`.
- Live KYC defect: function text search returned `set_config` position 0, and the profile guard does not read `request.jwt.claims`.
- Catalog and pause: direct row reads listed above.
- Money snapshot: aggregate counts only. No player row, document, or secret value was printed.
- Public site: `curl.exe` status codes on 17 October 2026.
- Local safety tests: 37 script files exited 0. They test this working tree, including uncommitted KYC code, not the deployed site.

## 24. Final launch recommendation

NO-GO

The owner should not invite players to deposit, load credits, redeem, or withdraw today. The website can stay online only as a public page that is already deployed. That is not approval to operate it as a sweepstakes cashier.

Nothing in this audit was deployed, migrated, or used to change a player, a balance, or an identity record.
