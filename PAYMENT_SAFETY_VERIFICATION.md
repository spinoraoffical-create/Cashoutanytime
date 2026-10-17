# Payment safety verification

No deposit, payout, refund, or webhook was sent. Production webhook addresses were not changed. Preview was not given live Paydora keys.

## What the current code does

| Control | Where | Result of this pass |
| --- | --- | --- |
| Webhook signature | `verifyPaydoraSignature` in the Paydora webhook route. Missing secret returns 500. Bad signature returns 401. | CODE PRESENT. NOT TESTED with a live Paydora payload. |
| Deposit credit uses the saved intent | Webhook loads `payment_intents` by Paydora id and credits the smaller of the saved amount and the collected amount. | CODE PRESENT. NOT TESTED live. |
| Wallet credit function | `creditPaydoraDeposit` uses the installed service-role RPC. | Preserved. Not rewritten. |
| Payout requires a signed-in player | Payout route returns 401 without a session. | CODE PRESENT. |
| Restricted state | `isRestrictedPaymentRequest` returns 403. | CODE PRESENT. NOT TESTED with a spoofed header. |
| KYC before cash out | Status must be `verified` or `approved`. | CODE PRESENT. |
| Rate limit | `checkRateLimit("paydoraPayout")`. | CODE PRESENT. |
| Duplicate payout reservation | `reserve` and provider-attempt fields, including `idempotency_key` and `reused`. | CODE PRESENT from the earlier financial work. NOT TESTED with two simultaneous clicks in this pass. |
| Held cash outs | Over-limit or flagged cash outs stay `held` and do not debit. | CODE PRESENT. |
| Unknown game-load refund | `mayRefundLoad` returns false unless the provider failure is confirmed, the type is load or reload, the provider flag is unset, and no refund was recorded. | TESTED LOCALLY. See `scripts/catalog/test-load-outcome.mjs`. |
| Admin cannot close a load from the stored row | `adminFinancialStatusDecision` always refuses to move money. | TESTED LOCALLY. |
| Stale load | New function marks the row and does not change the wallet. | TESTED LOCALLY. Not installed on the hosted database. |
| Player self-credit | Removed in the installed package. `credit_wallet` stays service role. | Preserved. Not reopened. |

## NOWPayments

NOT IMPLEMENTED. The names exist in `.env.example` only. No payment route calls them.

## Paydora methods

The site asks Paydora which methods the account supports. Marketing text is not proof that Cash App, Chime, Apple Pay, or Google Pay are enabled.

## Verdict

Payment safety code is intact. Live payment safety is NOT TESTED. Do not put Paydora keys on Preview. Do not change the production webhook until a separate approval.
