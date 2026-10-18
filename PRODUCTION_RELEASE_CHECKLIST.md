# Production release checklist

Date: 17 October 2026

Do not run this checklist until you approve the exact step in writing. This file does not deploy or migrate anything.

## What would ship

Working tree on `restore/public-game-catalog`, parent commit `2f170db003abd97a3d754d7ee7c6df8668c79994`, plus the uncommitted remediation.

Vercel project: `cashoutanytime`

Current live deployment to keep as the browsing rollback only: `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT`

Supabase project: `zecitlewsynyioemsqna`

## Environment values for the first deploy

Leave these unset. Do not set them to `on`.

- `REAL_VALUE_DEPOSITS`
- `REAL_VALUE_GAME_LOADS`
- `REAL_VALUE_REDEMPTIONS`
- `REAL_VALUE_PAYOUTS`
- `REAL_VALUE_ADJUSTMENTS`

`NEXT_PUBLIC_SITE_URL` stays unset.

## Safe order, after approval

1. Commit only the reviewed source, tests, lockfile, and reports. Do not commit `.env`, `.env.local`, or `supabase/.temp`.
2. Push `restore/public-game-catalog` without force. Do not move `main` unless you ask for that.
3. Confirm the five real-value names are not `on` in Vercel Production.
4. Deploy with `npm run deploy`.
5. Confirm the new deployment id is the one attached to `https://www.sweeptakehub.com`.
6. Smoke test below.
7. Apply identity SQL only under a second written approval.
8. Apply stale-load SQL only under a third written approval.

## Migrations, still not applied

1. `supabase/migrations/20261017000500_kyc_decision_profile_guard.sql`
2. `supabase/migrations/20261017000200_hold_stale_game_loads_for_review.sql`

Apply them only to `zecitlewsynyioemsqna`, one at a time, after the matching approval. Do not apply both because one approval was given.

Identity rollback is reapplying `supabase/migrations/20261014000160_admin_decide_kyc.sql`. That brings back the known save failure. It does not move money.

## Rollback that does not reopen money

Do not promote `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT` while `PAYDORA_API_KEY` is still in Production. That older build has no money switches, so deposits can start again.

If the new deploy breaks browsing:

1. Remove `PAYDORA_API_KEY` from Production first, or replace the site only after that key is gone.
2. Then promote the older deployment if browsing must return immediately.
3. Put the key back only on a build that contains the off switches.

Setting the cash-out limit above 0 is also blocked in the new code while payouts are off. The old build does not have that block. Leave `platform_ops` empty or at 0.

## Smoke tests after a future deploy

- Homepage, `/play`, `/login`, `/privacy`, and `/terms` return 200.
- `/games?q=juwa` returns 308.
- A deposit, load, redeem, and cash-out attempt says the money action is turned off.
- No provider transfer is sent.
- The real pending identity record is not approved.

## Not part of this release

Secret rotation, legal sign-off, payment-provider sign-off, backup restore, and turning any real-value switch on.
