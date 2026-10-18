# Payment webhook reconciliation

Date: 17 October 2026

Status: VERIFIED IN ISOLATED TEST

Production status: NOT DEPLOYED

## What was wrong

The callback treated every `deposit.paid` event as successful even when the status was cancelled, failed, or missing. A smaller or larger amount could still become a credit for a different amount. A callback saved during shutdown depended on Paydora retrying HTTP 503 forever. Paydora's retry document was not in this project, so that assumption is UNVERIFIED.

## What the local code does now

1. The signature is checked first. A bad signature returns 401 and is not saved.
2. Missing webhook secret returns 500 and is not treated as paid.
3. Bad JSON returns 400.
4. A callback that must not credit is saved in `webhook_events` and answered with HTTP 200 and the body `HELD`.
5. A row already marked `processed` or `ignored` is not rewritten by the hold saver.
6. A held payment is not credited when a later retry arrives. It stays held for a person to reconcile.
7. Credit requires a saved payment intent, a paid status, the same amount to the cent, and the currency `USD`.
8. A missing currency is held. It is not assumed to be USD.
9. An underage date of birth is held and is not echoed back.
10. Cancelled, failed, and unknown statuses are ignored and not credited.
11. A refund while deposits are off is saved and not applied.
12. If the database save fails, the response is 500 so the sender can retry.

The wallet credit still uses the existing `credit_paydora_deposit` function. That function keeps one row per payment id. This session did not change its balance formula.

## Reconciliation procedure

Do not credit a held row from the browser or by editing the wallet.

When deposits are approved later:

1. Read `webhook_events` where `provider` is `paydora` and `error` starts with `held:`.
2. Ask Paydora for that deposit through the provider's own transaction lookup. Do not trust the stored callback alone.
3. Confirm the amount, currency, and paid status with the provider.
4. Credit once through the existing payment function only after that confirmation and a separate owner approval.
5. Mark the webhook row `processed` only after the credit succeeds.
6. If Paydora says the payment failed or was refunded, do not credit it.

A held row is the record if Paydora stops retrying. Returning 200 means we do not depend on an unverified retry policy.

## Tests

`scripts/webhook-reconciliation.test.mjs` covered a valid paid callback, a bad status, a duplicate, twelve overlapping decisions for one payment, a callback while deposits are off, a retry after that hold, a refund, a wrong amount, a wrong currency, a missing currency, an underage decision, and an unknown event.

No live payment was sent. No live callback URL was posted to.

## Remaining risk

Paydora's published retry behavior is UNVERIFIED. The exact currency field name in a live payload is UNVERIFIED because the old payload type had no currency field. Until a real payload shows `USD`, a live paid callback will be held rather than credited. That is intentional.
