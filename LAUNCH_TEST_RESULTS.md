# Launch test results

Audit date: 17 October 2026

Working tree: branch `restore/public-game-catalog`, commit `2f170db003abd97a3d754d7ee7c6df8668c79994`, plus uncommitted KYC files that are not deployed.

Production deployment: `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT`

These results do not include a real signup, a real payment, a real payout, a real KYC decision, or a live provider transfer.

## Local automated tests

Command:

`node --import ./scripts/dev-only/register-ts-ext.mjs scripts/<name>.test.mjs`

Each file was run once. All 37 exited 0.

| Test | Result | What it shows | Limit |
| --- | --- | --- | --- |
| admin-list-scope.test.mjs | PASS | Staff list scope in local code | Not a live permission test |
| admin-nav-v2.test.mjs | PASS | Admin navigation source | Not a live click test |
| auth-email-code.test.mjs | PASS | Email-code signup source rules | No email was sent |
| automation-health.test.mjs | PASS | Automation health source | Providers were not called |
| auto-money.test.mjs | PASS | Deposit settlement source rules | No payment was sent |
| blog-links.test.mjs | PASS | Blog link rules | Not a crawl of production |
| catalog-visibility.test.mjs | PASS | Eight active games stay public in source | Live database was checked separately |
| chat-thread.test.mjs | PASS | Chat thread source | No message was sent |
| deposit-access.test.mjs | PASS | Deposit read authorization source | No deposit was opened |
| deposit-automation.test.mjs | PASS | Deposit automation source | No webhook was delivered |
| financial-audit-result.test.mjs | PASS | Audit result wording | No ledger row was changed |
| financial-trust.test.mjs | PASS | Financial source invariants | No live money movement |
| firekirin-api.test.mjs | PASS | Fire Kirin client source | No Fire Kirin call |
| game-center-ui.test.mjs | PASS | Game Center source | Not a browser test |
| game-load-outcome.test.mjs | PASS | Load outcome source | No load was sent |
| kyc-decision.test.mjs | PASS | Local message, counts, and unapplied SQL text | Does not prove production approval |
| kyc-upload.test.mjs | PASS | Upload and decision source shape | No document was uploaded |
| live-game-balances.test.mjs | PASS | Balance display source | No provider balance call |
| marketing-center-ui.test.mjs | PASS | Marketing source | No campaign was sent |
| newsletter-consent.test.mjs | PASS | Consent source rules | No mail was sent |
| offers.test.mjs | PASS | Offer source rules | No offer was sent |
| payout-operations-security.test.mjs | PASS | Payout operation source guards | No payout was sent |
| payout-operations-ui.test.mjs | PASS | Payout screen source | Not a browser test |
| payout-reservation.test.mjs | PASS | Local double-payout fixture | Live database was not called |
| phase3d-release-blockers.test.mjs | PASS | KYC decision still uses one RPC | Production function is still the old one |
| player-transactions.test.mjs | PASS | Transaction list source | No player row was opened |
| rate-limit.test.mjs | PASS | Rate-limit source | Live limits were not measured |
| restricted-state.test.mjs | PASS | Header restriction helper | Does not cover the API matcher gap |
| seo-indexability.test.mjs | PASS | Canonical, robots, and sitemap source | Live pages were checked separately |
| staff-access.test.mjs | PASS | Staff permission source | No staff login |
| stale-load-hold.test.mjs | PASS | Unapplied hold SQL text | Live function does not contain that text |
| store-automation.test.mjs | PASS | Store automation source | No store login |
| store-center-ui.test.mjs | PASS | Store screen source | Not a browser test |
| terminal-account.test.mjs | PASS | Account creation stays disarmed in source | `TERMINAL_ACCOUNT_CREATION_ARMED` is false |
| terminal-api-safety.test.mjs | PASS | Terminal API safety source | No terminal call |
| transfer-ledger.test.mjs | PASS | Pause and duplicate claim fixture | Live pause rows were read separately |
| whole-coin.test.mjs | PASS | Whole-coin amount rules | No credit was posted |

## TypeScript, lint, dependencies, and build

| Test | Command | Result | Evidence | Limit |
| --- | --- | --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | PASS | Exit 0 | Does not prove financial safety |
| Lint | `npx next lint` | PASS with warnings | Exit 0. Image and hook warnings only. No errors. | Warnings are not launch blockers |
| Dependency install | Existing `node_modules` used by the tests and build | PASS | Tests and build ran | `npm ci` was not repeated |
| Dependency advisories | `npm audit --omit=dev --json` | FAIL | 1 critical (`next` 15.5.19), 8 high, 33 moderate | Issues were not exploited |
| Production build | `npm run build` | PASS | Exit 0. Route table completed. | Build does not prove the live deployment matches this tree |

## Production HTTP checks

| Test | Command | Result | Evidence | Limit |
| --- | --- | --- | --- | --- |
| Homepage | `curl.exe -I https://www.sweeptakehub.com/` | PASS | 200, HTTPS, HSTS | Body did not contain either Supabase project id |
| Play catalog | `curl.exe https://www.sweeptakehub.com/play` | PASS | 200. Canonical `https://www.sweeptakehub.com/play`. Page text includes Juwa. | Cards were not clicked |
| Games redirect | `curl.exe -I https://www.sweeptakehub.com/games?q=juwa` | PASS | 308 to `https://www.sweeptakehub.com/play?q=juwa` | Query was not followed in a browser |
| Robots | `curl.exe https://www.sweeptakehub.com/robots.txt` | PASS | 200. Host and sitemap use `www.sweeptakehub.com`. Admin and dashboard are disallowed. | Not a Google crawl |
| Sitemap | `curl.exe https://www.sweeptakehub.com/sitemap.xml` | PASS | 200. 182 URLs. 8 game URLs. Old project id absent. | Does not mean all URLs are indexed |
| Login | `curl.exe https://www.sweeptakehub.com/login` | PASS | 200. `noindex` present. | Login was not submitted |
| Privacy, terms, FAQ | `curl.exe` each URL | PASS | Each returned 200 | Pages exist. They are not legal approval. |

## Production deployment and database reads

| Test | Command | Result | Evidence | Limit |
| --- | --- | --- | --- | --- |
| Domain deployment | `npx vercel inspect https://www.sweeptakehub.com` | PASS | Deployment `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT`, project `cashoutanytime`, target production, Ready | Environment values were not printed |
| Active games | `npx supabase db query --linked` on `zecitlewsynyioemsqna` | PASS | Eight active slugs. Fire Kirin, Orion Stars, Milky Way, Panda Master, and VBlink are inactive. | Read only |
| Provider pause | same CLI | PASS | Fire Kirin, Milky Way, and Orion Stars are paused. No other pause rows. | Does not pause the seven active credentialed games |
| KYC function | same CLI | FAIL for launch | `set_config` position is 0. Service-role check is present. | Function was not executed |
| Profile guard | same CLI | FAIL for KYC save | Guard does not read `request.jwt.claims`. It does contain `app.wallet_update`. | Trigger was not fired |
| Stale loads | same CLI | PASS for no auto-refund | No `UPDATE`, no `credit_wallet`, no review note | Hold migration is not applied |
| RLS flags | same CLI | PASS | RLS is on for `profiles`, `kyc_submissions`, and `wallet_transactions` | Policy text was not fully reviewed |
| KYC documents bucket | same CLI | PASS | `kyc-documents` is not public | A signed URL was not opened |
| Cash-out switch | same CLI | PASS for current hold | `platform_ops` returned no rows | Payout route was not called |
| Money counts | same CLI | PASS as a snapshot | 0 wallet transactions, 0 deposit requests, 1 payment intent, 4 profiles, 1 pending KYC, 13 zero-amount game-load rows | Rows were not opened |

## Not executed

| Test | Result | Why |
| --- | --- | --- |
| Live signup, login, logout, and password reset | NOT TESTED | Would create or change a real account |
| Live KYC approve and reject | NOT TESTED | The one pending record is real. Production function is still broken. |
| Live Paydora deposit and webhook | NOT TESTED | Would move money |
| Live payout double-click | NOT TESTED | Would risk a provider payout |
| Live recharge and redemption | NOT TESTED | Would move game value |
| Mobile browser pass | NOT TESTED | No interactive browser session was run |
| Backup restore drill | NOT TESTED | Would require a database copy |
| Secret rotation | NOT TESTED | Forbidden during an audit |
| Old Supabase project | NOT TESTED | Forbidden. It was not contacted. |
