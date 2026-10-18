# Financial Center test results

Date: 18 October 2026. Commands that ran are listed with their results. Anything not listed did not run.

## Passed

- `scripts/manual-test-fixes.test.mjs`
- `scripts/admin-nav-v2.test.mjs`
- `scripts/game-load-outcome.test.mjs`
- `scripts/webhook-reconciliation.test.mjs`
- `scripts/payout-reservation.test.mjs`
- `scripts/financial-trust.test.mjs`
- `node node_modules/typescript/bin/tsc --noEmit` exit 0
- ESLint on the financial files edited in this pass, exit 0
- `node node_modules/next/dist/bin/next build` exit 0 (Next.js 15.5.28). Existing image and hook warnings in unrelated files. No build error.

## Failed

None of the commands above failed.

## Not run

- Postgres transaction tests
- Postgres concurrency tests
- A live or mocked HTTP call to any game provider
- A live Paydora webhook or payout
- Duplicate click tests in a browser
- Role tests beyond the nav unit test
- Browser check of the new admin pages

Those were skipped because this session must not use production as a test database and must not call real payment or game APIs. There is no isolated financial test database wired into the test command that was used.

## Read-only production check

This was a SELECT, not a test of the new code. It confirmed the live refund function does not set the service-role claim, the wallet trigger still raises, and the $5 load is still pending with `wallet_refunded` false.
