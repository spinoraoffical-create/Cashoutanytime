# Owner actions required

Date: 17 October 2026

You do not need to edit code. These are the decisions only you can make. Nothing below has been done for you.

## 1. Approve or refuse the first deploy

The working copy can be deployed with money turned off. Say yes only if you want that exact deploy. Until you say yes, the live site stays on the older build.

Do not turn on:

- `REAL_VALUE_DEPOSITS`
- `REAL_VALUE_GAME_LOADS`
- `REAL_VALUE_REDEMPTIONS`
- `REAL_VALUE_PAYOUTS`
- `REAL_VALUE_ADJUSTMENTS`

## 2. Approve the identity repair separately

File: `supabase/migrations/20261017000500_kyc_decision_profile_guard.sql`

This lets an authorized admin save Approve or Reject. It does not open the identity documents to the public. Do not test it on the real pending customer.

## 3. Approve the stale-load repair separately

File: `supabase/migrations/20261017000200_hold_stale_game_loads_for_review.sql`

This marks an old unfinished load for a person to review. It does not refund and it does not send the load again.

## 4. Rotate exposed passwords

Follow `SECRET_ROTATION_CHECKLIST.md`. Do not paste the new passwords into chat. Tell me only the secret name and the date it was changed.

## 5. Ask a US lawyer

The site has a privacy page, a terms page, and an 18+ sentence. That is not legal approval. Ask counsel to confirm:

- The minimum age.
- Which states must be blocked. The code still uses Washington, Idaho, Nevada, and Michigan.
- Whether official sweepstakes rules are required.
- Whether a no-purchase entry and a free entry method are required.
- Whether the current payment company is allowed for this business.

## 6. Ask the payment company

Ask Paydora whether this business is approved to take payments and send payouts. There is no approval letter in the project.

## 7. Confirm backups

In Supabase, for project `zecitlewsynyioemsqna`, check that backups or point-in-time recovery are on. Do not restore over the live database. A practice restore belongs on a copy.

## 8. Leave real money off

Players may open the public pages. They should not deposit, load game credits, redeem, or cash out until the items above are finished and you approve those switches one by one.
