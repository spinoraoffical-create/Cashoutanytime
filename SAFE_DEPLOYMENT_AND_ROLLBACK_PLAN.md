# Safe deployment and rollback

Date: 17 October 2026

The release order below is superseded for the shutdown release. Use `PRODUCTION_SHUTDOWN_RELEASE_PLAN.md` from 18 October 2026. Do not publish the new website before the Paydora key is removed, the active games are paused, and the database money guard is verified.

Nothing in this plan has been deployed.

## Current identity

- Branch: `restore/public-game-catalog`
- Last commit: `2f170db003abd97a3d754d7ee7c6df8668c79994`
- The fixes are uncommitted local changes.
- Live deployment: `dpl_2bxo4UhEGxQQcoVJty7JgC1XmDzT`
- Vercel project: `cashoutanytime`
- Database: `zecitlewsynyioemsqna`
- Domain: `https://www.sweeptakehub.com`

## Do not roll back to the current live deployment while Paydora can still create charges

That deployment has no money switches. Promoting it again while `PAYDORA_API_KEY` is present can reopen checkout and payout calls.

Removing `PAYDORA_API_KEY` stops new Paydora calls on the next serverless invocation that reads the environment. This session did not prove that an already running invocation stops in the same instant. Do not describe that removal as instant.

The pause table stops only Fire Kirin, Milky Way, and Orion Stars. It does not pause the eight active games.

## Independent database shutdown

`supabase/migrations/20261017000600_real_value_db_guard.sql` adds a control table that starts with every row off. Triggers refuse new deposit credits, payout debits, game-load debits, redemptions, and ledger adjustments. Refund rows and payout-void credits stay possible so an already accepted payment can still be reversed.

This file is not applied. After it is applied, the current website also loses those actions until the matching row is set to enabled. That is the shutdown that survives an application rollback. Do not set any row to enabled as part of the first deploy.

## Release order, only after written approval

1. Confirm the five `REAL_VALUE_*` values are unset.
2. Deploy the local build to Vercel project `cashoutanytime` with `npm run deploy`.
3. Confirm the new deployment id is the one attached to `https://www.sweeptakehub.com`.
4. Smoke-test public pages and confirm a deposit, load, redeem, and payout request says the money action is turned off.
5. Apply the identity SQL only if that file was separately approved.
6. Apply the stale-load SQL only if that file was separately approved.
7. Apply the database money guard only if that file was separately approved.
8. Do not turn any real-value switch on in the same release.

## If the new deploy breaks browsing

1. Remove `PAYDORA_API_KEY` first if the database money guard is not applied.
2. Then promote the previous deployment.
3. Leave the cash-out limit empty or zero.
4. Do not turn the switches on to "fix" the rollback.

## Monitoring

Payment, game-transfer, and identity failures already write server errors and audit rows where those paths exist. Mail, SMS, Telegram, and cron alerts were not reconfigured. Backup and point-in-time recovery were not opened. Do not claim they are on.
