# Preview release plan

Do not deploy from this session. Production environment variables were not changed.

## What Preview is

Vercel project `cashoutanytime`. Preview should talk only to the new Supabase project `zecitlewsynyioemsqna`. It must not receive live Paydora keys or live game-agent passwords.

The local commit at the start of this work is `b6afbc6bee32b912e6c9d97aaa732ef47073c13c`. The restoration files are not committed, because Git has no author on this PC. A Preview deploy of `main` would not include this work until it is committed and pushed, and only after you ask for that deploy.

This session did not read the Vercel deployment list, so the exact commit currently on Preview was not confirmed here.

## Preview environment names

Set these on Preview only:

- `NEXT_PUBLIC_SUPABASE_URL` = `https://zecitlewsynyioemsqna.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the new project's anon key
- `SUPABASE_SERVICE_ROLE_KEY` = the new project's service role key
- `NEXT_PUBLIC_SITE_URL` = the Preview https address
- `NEXT_PUBLIC_APP_URL` if the project uses it, same Preview address

Leave empty on Preview:

- `PAYDORA_API_KEY`
- `PAYDORA_WEBHOOK_SECRET`
- game agent passwords and secrets
- `CRON_SECRET` unless you intentionally want a job
- Resend, Twilio, Telegram, and AI keys, unless you are testing that one channel with a test recipient

## Before a Preview deploy

1. You set a Git author and the restoration branch is committed. I will not invent that identity.
2. You approve a push. This session did not push.
3. You approve `npm run deploy:preview` or a Vercel Preview deployment. This session did not run it.
4. Supabase Authentication redirect URLs include `https://THAT-PREVIEW-HOST/auth/callback`.

## What to click after Preview is up

- Games page should show 12 games. Those rows are already in the new database.
- Register shows “confirmation link,” not “6-digit code,” as the main instruction.
- A load on a game without an agent login says the game is not connected and does not change the wallet.
- Deposit without Paydora keys fails closed.

## Rollback

Leave the previous Preview deployment in Vercel and promote it again from the Vercel dashboard. Do not reset the database to roll back a Preview.
