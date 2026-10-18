# Remediation release plan

Date: 17 October 2026

This plan does not merge, migrate, deploy, or turn real-money operations on.

## Current position

- Branch: `restore/public-game-catalog`
- Last deployed commit: `2f170db003abd97a3d754d7ee7c6df8668c79994`
- Production deployment: `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT`
- Production domain: `https://www.sweeptakehub.com`
- Supabase project: `zecitlewsynyioemsqna`
- `origin/main` is behind this branch. Do not fast-forward `main` until the owner wants a Git-connected deploy.
- The working tree has uncommitted KYC screen changes, the unapplied KYC SQL, the unapplied stale-load SQL, the new money switches, the Next.js pin, and these reports.

## What the local code now does

Real-value operations stay off unless the matching environment value is exactly `on`:

- `REAL_VALUE_DEPOSITS`
- `REAL_VALUE_GAME_LOADS`
- `REAL_VALUE_REDEMPTIONS`
- `REAL_VALUE_PAYOUTS`

Do not set those values for the first deploy. Missing values fail closed. Browsing, login, and read-only account pages are not behind those switches.

Direct calls into the Paydora create and withdrawal functions also check the switch before the provider request. Webhook signature is still checked. A paid callback does not credit a wallet while deposits are off.

## Database migrations — do not apply yet

1. `supabase/migrations/20261017000500_kyc_decision_profile_guard.sql`
   - Replaces `admin_decide_kyc` with the same checks, plus one transaction-local `app.wallet_update` flag immediately before the profile update.
   - Does not add columns, change RLS, or change wallet math.
   - Execute remains limited to `service_role`.
   - Rollback is reapplying `supabase/migrations/20261014000160_admin_decide_kyc.sql`.
2. `supabase/migrations/20261017000200_hold_stale_game_loads_for_review.sql`
   - Marks stale loads for review and does not refund.
   - Separate approval. Do not combine it with the KYC change unless the owner says so.

Apply nothing until the owner writes approval for that exact file on `zecitlewsynyioemsqna`.

## Deployment sequence, after written approval

1. Commit only the reviewed files. Do not commit `.env`, `.env.local`, or `supabase/.temp`.
2. Push the feature branch. Do not force-push. Do not move `main` unless the owner asks.
3. Confirm Vercel project `cashoutanytime` and that production does not contain `REAL_VALUE_DEPOSITS=on` or the other three `on` values.
4. `npm run deploy` from this folder, then confirm the new deployment id is aliased to `https://www.sweeptakehub.com`.
5. Apply the KYC SQL only if that separate approval was given. Do it after the app deploy so the screen copy matches the function.
6. Do not approve the existing pending identity record. Use a disposable fixture on a non-production trial only if one is created later.

## Rollback

- Vercel: promote the previous healthy deployment `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT` if the new deploy breaks browsing, login, or the catalog.
- Database: if the KYC function was applied and must be undone, reapply `20261014000160_admin_decide_kyc.sql`. That returns the known save failure. It does not change balances.
- Do not roll back by deleting player rows, wallet rows, or identity documents.

## Post-deploy smoke tests

- Homepage, `/play`, `/login`, `/privacy`, and `/terms` return 200.
- `/games?q=juwa` redirects to `/play?q=juwa`.
- A signed-in test account can open the wallet page.
- Deposit, load, redeem, and cash-out requests return "This money action is turned off."
- No provider transfer is sent.
- Identity approval is still not clicked on the real pending record.

## Still not a launch

Legal review, payment-provider approval, secret rotation, backups, and a live money test are still open. Do not set the real-value switches to `on` until those are accepted in writing.
