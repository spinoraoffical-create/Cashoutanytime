# Test results

Date: 13 October 2026  
Where: this computer, folder `final-file-main`  
What ran: the existing `scripts/*.test.mjs` files that only read source code or compute sample numbers.  
What did not run: no production database, no Paydora charge, no email, no SMS, no Telegram post, no game-provider login, and no SQL migration.

`package.json` has no `npm test` script. Each file was started with `node`.

## Summary

| Result | Count |
| --- | --- |
| Passed | 14 |
| Failed | 1 |
| Not run on purpose | Live database scripts, Vercel env push, and provider login checks |

## Passed

| Script | What it checks | Result |
| --- | --- | --- |
| `scripts/newsletter-consent.test.mjs` | A player is skipped unless email notices are on, and the campaign sender is not a public server action | Passed |
| `scripts/blog-links.test.mjs` | Blog links stay on this site | Passed |
| `scripts/offers.test.mjs` | Offer send rules in source | Passed |
| `scripts/chat-thread.test.mjs` | Support chat uses the signed-in user | Passed |
| `scripts/live-game-balances.test.mjs` | Live game coins stay Super Admin only | Passed |
| `scripts/whole-coin.test.mjs` | Game amounts stay whole coins where required | Passed |
| `scripts/player-transactions.test.mjs` | A store report does not count another store or a failed load as profit | Passed |
| `scripts/payout-reservation.test.mjs` | A cash-out reserve cannot be spent twice in the sample ledger | Passed |
| `scripts/restricted-state.test.mjs` | WA, ID, NV, and MI are treated as restricted | Passed |
| `scripts/admin-list-scope.test.mjs` | Store and sub-creator lists stay inside their players | Passed |
| `scripts/financial-trust.test.mjs` | Game loads use the player’s own account and the signed-in user | Passed |
| `scripts/deposit-automation.test.mjs` | Deposit bonus math and one-time credit rules | Passed |
| `scripts/staff-access.test.mjs` | A normal player is not staff; Super Admin is recognized from the role key | Passed |
| `scripts/firekirin-api.test.mjs` | Fire Kirin transaction ids are stable and whole-dollar checks work. No live login. | Passed |

## Failed

### `scripts/auto-money.test.mjs`

- **Exit code:** 1
- **First failure:** line 58
- **Message:** `Expected values to be strictly equal: true !== false`
- **Meaning:** The test requires `src/lib/actions/game-loads.ts` not to contain the text `status: "failed"`. The file does contain it. `clearStaleRequests` sets a stuck load to failed with a normal update, and a stuck account request is replaced the same way.
- **Why that matters:** The database function that creates a load already takes the money. The safe timeout path refunds that money. The plain `status: "failed"` update does not. The full explanation is bug 1 in `AUDIT_REPORT.md`.
- **Later checks in the same file did not run.** After line 58, the script also requires the admin menu not to mention `/admin/requests` or `/admin/failed-loads`. The current menu includes both links, so those two checks would fail next even after the first line is fixed.
- **What not to do:** Do not delete the word `failed` just to make the test green. Call the refund function, then update the test so a refunding failure is allowed and the current menu links are allowed.

## Not run

These files can touch a live service or print setup details. They were left alone.

| Script | Why it was skipped |
| --- | --- |
| `scripts/firekirin-login-check.mjs` | Can sign in to a game provider |
| `scripts/verify-setup.mjs` | Can read live configuration |
| `scripts/push-vercel-env.mjs` | Can change Vercel secrets |
| `scripts/dev-only/*` | Older database and content probes |
| `scripts/check_roles.mjs` | Can read live roles |

## What this does not prove

A passing script proves the file still contains the safety check that script looks for. It does not prove a real card payment, a real cash-out, or a real email. Those need the checklist in `LAUNCH_CHECKLIST.md` on a test account.
