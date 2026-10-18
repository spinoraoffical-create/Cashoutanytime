# Full regression test results

Date: 17 October 2026

Command for each script:

`node --import ./scripts/dev-only/register-ts-ext.mjs scripts/<name>.test.mjs`

All 38 scripts exited 0.

| Script | Result |
| --- | --- |
| admin-list-scope.test.mjs | PASS |
| admin-nav-v2.test.mjs | PASS |
| auth-email-code.test.mjs | PASS |
| automation-health.test.mjs | PASS |
| auto-money.test.mjs | PASS |
| blog-links.test.mjs | PASS |
| catalog-visibility.test.mjs | PASS |
| chat-thread.test.mjs | PASS |
| deposit-access.test.mjs | PASS |
| deposit-automation.test.mjs | PASS |
| financial-audit-result.test.mjs | PASS |
| financial-trust.test.mjs | PASS |
| firekirin-api.test.mjs | PASS |
| game-center-ui.test.mjs | PASS |
| game-load-outcome.test.mjs | PASS |
| kyc-decision.test.mjs | PASS |
| kyc-upload.test.mjs | PASS |
| live-game-balances.test.mjs | PASS |
| marketing-center-ui.test.mjs | PASS |
| newsletter-consent.test.mjs | PASS |
| offers.test.mjs | PASS |
| payout-operations-security.test.mjs | PASS |
| payout-operations-ui.test.mjs | PASS |
| payout-reservation.test.mjs | PASS |
| phase3d-release-blockers.test.mjs | PASS |
| player-transactions.test.mjs | PASS |
| rate-limit.test.mjs | PASS |
| real-value-controls.test.mjs | PASS |
| restricted-state.test.mjs | PASS |
| seo-indexability.test.mjs | PASS |
| staff-access.test.mjs | PASS |
| stale-load-hold.test.mjs | PASS |
| store-automation.test.mjs | PASS |
| store-center-ui.test.mjs | PASS |
| terminal-account.test.mjs | PASS |
| terminal-api-safety.test.mjs | PASS |
| transfer-ledger.test.mjs | PASS |
| whole-coin.test.mjs | PASS |

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | PASS |
| Lint | `npx next lint` | PASS with existing image and hook warnings. No errors. |
| Production build | `npm run build` | PASS on Next.js 15.5.28 |
| Dependency audit | `npm audit --omit=dev` | 0 critical, 8 high, 34 moderate |

High packages still listed: `@tiptap/core`, `brace-expansion`, `js-yaml`, `nanoid`, `postcss`, `prosemirror-view`, `sharp`, `source-map-js`.

## Not executed

| Check | Result |
| --- | --- |
| Live signup, login, logout, and password reset | NOT TESTED |
| Live identity approve or reject | NOT TESTED |
| Live Paydora payment or webhook delivery | NOT TESTED |
| Live payout | NOT TESTED |
| Live game recharge or redemption | NOT TESTED |
| Phone browser layout | NOT TESTED |
| Backup restore | NOT TESTED |

An unexecuted test is not a pass.
