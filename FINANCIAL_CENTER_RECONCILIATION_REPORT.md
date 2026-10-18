# Financial Center reconciliation report

Date: 18 October 2026. No production row was updated.

## The $5 Game Vault load

Confirmed still open:

- Game login `player43137`
- Amount $5.00
- Status `pending`
- `wallet_refunded` false
- Provider text claims a refund; the ledger does not
- Earlier wallet credit $16.49
- Later wallet debit $5.00
- Balance afterward $11.49
- No `game_load_refund` row was found in the previous investigation, and this pass did not create one

The provider result is a confirmed agent-balance rejection, code 6. The game account flag `game_api_debited` is false. The refund function did not commit. The $5 remains unreconciled.

Do not refund it until the migration in `FINANCIAL_CENTER_MIGRATION_PLAN.md` is applied and you explicitly approve that one function call.

## What the new Reconciliation page will show after deploy

For the last 7 days it lists:

- Confirmed agent-balance rejections whose `wallet_refunded` flag is still false
- Open loads older than 30 minutes, and provider messages that look like a timeout
- `deposit.paid` webhooks marked processed with no matching payment-ledger credit
- Payout rows still in requested, reserved, submitted, or manual review

Each alert links to stored evidence. The page does not run a refund.

These requested alerts are not built yet:

- A wallet debit with no nearby game-load request
- Duplicate wallet credits
- Financial actions with no audit row

Those stay as follow-up work so the page does not guess.

## Anthony Castro deposit

Confirmed from the earlier read-only check, not changed today:

- `deposit_requests` amount $16.49, card, Juwa, completed, wallet credited
- System note `Paid online`
- Proof value is a Paydora marker, not a screenshot
- Payment intent base $10.99, webhook `deposit.paid`, ledger credit $16.49

That credit is the $10.99 plus the $5.50 first-deposit bonus. It is a separate event from the missing $5 Game Vault refund.
