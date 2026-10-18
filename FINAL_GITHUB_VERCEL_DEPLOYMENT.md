# Final GitHub and Vercel deployment

Date: 18 October 2026

## GitHub

- Repository: https://github.com/spinoraoffical-create/Cashoutanytime
- Branch pushed: `restore/public-game-catalog`
- Default branch `main` fast-forwarded to the same commit. This was not a force-push.
- Commit: `c88a0cc38c97ed64e5c08a9cc71ba8bcba6fc37c`
- Message: Stop paused games from being contacted and keep an unrecognized Paydora method from being stored as Cash App.
- Push: `origin/restore/public-game-catalog` moved from `2f170db` to `c88a0cc`. `origin/main` moved from `b6afbc6` to `c88a0cc`.

The commit contains the reviewed October 18 code: financial switches, the database guard migration, the KYC decision repair, the stale-load hold, Paydora method labeling, checkout method storage, webhook method handling, and provider pause enforcement. Environment files, `supabase/.temp`, backups, and KYC files were not committed. A scan of the reports and source found no API key and no access token.

## Tests before the push

- Application tests: 41 passed, 0 failed.
- TypeScript: passed.
- Production build and ESLint: passed. Next.js 15.5.28, 123 pages. Existing image and hook warnings only.
- Financial regression tests in that suite passed, including real-value switches, webhook decisions, deposit idempotency rules, and provider pause rules.

## Vercel

The domain https://www.sweeptakehub.com is attached to ready deployment `dpl_9QLfizNCi3EA8pJZbd5TKU1AT62n`, created 12:56 Nepal time. https://sweeptakehub.com is on that same deployment.

A newer production deployment, `dpl_ApADCciQH7B4PvvJKy93f6q7idRD`, was created at 13:05 from this release and is still Queued. It does not own the domain yet. It was not promoted over an older build by hand. Another production deployment from the same window is also Queued. When Vercel starts them, they are the same reviewed release.

Checked on the live domain just now:

- `/login` 200
- `/register` 200
- `/play` 200
- `/admin` without a session: 307 to login
- Deposit methods: “Deposits are temporarily unavailable. Please try again later or contact support.”

No customer row was modified. Wallet sum is still 0. The five database controls are still off. All eleven provider pause rows are still paused. The five `REAL_VALUE_*` switches are not set in Vercel Production.

## Paydora credentials

- `PAYDORA_API_KEY` is present in Vercel Production. It was added during this session. The value is hidden. Vercel will not decrypt production secrets onto this machine, so this session did not read the value and cannot prove it is different from the key that was pasted in chat. Treat that as unproven until you confirm in the Paydora dashboard that the exposed key is revoked.
- `PAYDORA_WEBHOOK_SECRET` is present. Its value was not read.
- A read-only merchant call was not made from this machine, because the production secret could not be loaded here. No charge and no payout were sent.
- The earlier provider read of the $10.99 payment remains `failed` and uncredited. Do not credit it.

## Environment names present

Supabase URL, anon key, and service-role key are present. Agent settings are present for Juwa, Game Vault, Vegas Sweeps, Cash Frenzy, Cash Machine, Game Room, Mr All In One, Fire Kirin, Milky Way, and Orion Stars. A Mafia agent setting was not in the production list. `REAL_VALUE_DEPOSITS`, `REAL_VALUE_GAME_LOADS`, `REAL_VALUE_REDEMPTIONS`, `REAL_VALUE_PAYOUTS`, and `REAL_VALUE_ADJUSTMENTS` are absent, so those actions stay off.

## Existing game accounts

Still present. Not deleted, recreated, or overwritten. Usernames are not listed.

| Game | Accounts | Username stored |
| --- | --- | --- |
| Juwa | 3 | yes |
| Game Vault | 1 | yes |
| Vegas Sweeps | 1 | yes |
| Cash Frenzy | 1 | yes |
| Game Room | 1 | yes |

Provider ids are still empty. Lookup and balance calls were not sent, and no funds were moved. The providers stay paused.

## Manual testing checklist

Sign in with your own account. Money actions should explain that they are off. They should not create a charge, a load, or a payout.

- Registration: https://www.sweeptakehub.com/register
- Login: https://www.sweeptakehub.com/login
- Password reset: https://www.sweeptakehub.com/reset-password
- Player dashboard, wallet, KYC, history: https://www.sweeptakehub.com/dashboard
- Game catalog: https://www.sweeptakehub.com/play
- Deposit screen: shows that Paydora checkout is not available, with the unavailable message above
- Existing game accounts: visible on the game pages after sign-in. Creating, loading, and redeeming should say the game is paused or the money action is turned off
- Payout screen: cash out should say it is temporarily unavailable
- Admin: https://www.sweeptakehub.com/admin
- Games, staff, stores, and support are inside that admin area after an owner sign-in

## Still required before real-money activation

Do not turn these on as part of this deployment.

1. Confirm in Paydora that the exposed key is revoked and that the Vercel key is the replacement.
2. One test deposit with a signed webhook, an exact USD amount, a single credit, and a duplicate webhook that does not credit again. Failed and cancelled payments must not credit.
3. One test payout covering success, failure, and timeout.
4. Per provider, a test-account lookup, balance, load, redeem, and duplicate check. Then resume that provider alone.
5. Written merchant approval and the sweepstakes legal requirements, including a free-entry method.
6. A private backup of the identity image.

Only after those exist should deposits, loads, redemptions, payouts, and owner adjustments be enabled, one at a time, with the database triggers left in place.
