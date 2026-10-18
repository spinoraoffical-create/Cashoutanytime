# Financial Center test evidence

Date: 18 October 2026. Results below are from this session. An untested item is NOT TESTED. It is not a pass.

## Passed

- `node node_modules/typescript/bin/tsc --noEmit` exit 0 after the final edits.
- ESLint exit 0 on the financial pages and reconciliation/overview modules.
- `next build` exit 0 on the tree that includes the overview, failed-load, reconciliation, and debit-match edits. Existing image and hook warnings remain. They are not new financial failures.
- Unit tests, 6 files, 0 failures:
  - `scripts/manual-test-fixes.test.mjs` including the $5 display rule, owner state, duplicate credits, and duplicate payouts
  - `scripts/admin-nav-v2.test.mjs`
  - `scripts/game-load-outcome.test.mjs`
  - `scripts/webhook-reconciliation.test.mjs`
  - `scripts/payout-reservation.test.mjs`
  - `scripts/financial-trust.test.mjs`

These unit tests use local fixtures. They do not call Paydora or a game provider.

## Not tested

- PostgreSQL transaction tests on an isolated database: NOT TESTED. Production was not used as a test database.
- PostgreSQL concurrency tests: NOT TESTED.
- Playwright browser tests: NOT TESTED.
- Admin pages in a browser: NOT TESTED.
- Live deposit, load, redeem, refund, and payout calls: NOT TESTED.
- The installed refund function was read. It was not executed against the $5 row.

## Security checks that were read, not attack-tested

- Refund execute grant: `service_role` true, `authenticated` false, from the live catalog.
- Wallet trigger still raises without the service-role claim.
- Preview environment names were listed without printing secret values. See the release report. No preview was deployed.
