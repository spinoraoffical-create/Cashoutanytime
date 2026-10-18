# Financial Center release report

Date: 18 October 2026.

## Git

- Remote `origin`: `https://github.com/spinoraoffical-create/Cashoutanytime.git`
- Release branch: `release/financial-center-2026-10-18`
- `main` was not pushed.
- Production was not deployed.
- `supabase/.temp/` was not committed.

The commit hash is filled in at the bottom of this file after the commit succeeds.

## Vercel

Project: `cashoutanytime`.

Preview was not created.

Reason: Preview already has the production Supabase URL, the production service-role key, and the live game-provider credentials (Game Vault, Juwa, and the other agent logins). `PAYDORA_API_KEY` and the `REAL_VALUE_*` switches are Production-only, so a preview would not automatically charge cards, but it could still read and write the live wallet database and call live game providers. The release instruction says to stop before testing when that is true. No preview URL was opened.

## Production

Status: not deployed. Live domain still serves `fa8dc2704983dadde6e5253981cd86d69d12f38d` until you explicitly approve a production deploy.

The refund migration is already installed. No further database change is required for this branch. No production refund or payout was run.

## Commit

`e2af5aaa502aae9f071988b3814cd62f67d9119c` on `release/financial-center-2026-10-18`.
