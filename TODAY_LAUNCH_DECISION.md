# Today launch decision

Date: 18 October 2026

Production: https://www.sweeptakehub.com

Deployment: `dpl_5TumMEUAubN26ji99A4rSAWSs5jD`

Supabase: `zecitlewsynyioemsqna`

Paydora deposits: **NO-GO**

Paydora payouts: **NO-GO**

Every game provider: **NO-GO**

Full production activation: **NO-GO**

No balance was changed. No provider was resumed. No KYC decision was made. The exposed Paydora key was not put back into Vercel and was not used again.

## Paydora

The production environment has `PAYDORA_WEBHOOK_SECRET` and does not have `PAYDORA_API_KEY`. A replacement key cannot be created from this machine. Paydora's dashboard is the only place that can revoke the exposed key and issue a new one.

Until that new key is stored in the Vercel project `cashoutanytime`, these were not run: test checkout, signed webhook, exactly-once credit, failed checkout, cancelled checkout, refund, payout success, payout failure, payout timeout.

What is already verified:

- The earlier read of deposit `6ad2f76612536669727a47b6` returned `failed`, amount 10.99, no paid amount, no refund. The wallet was not credited. Do not credit it and do not refund it.
- Live method names from that same read: Card, Chime, Cash App, Google Pay, and Apple Pay for deposits. Card, Chime, and Cash App for withdrawals.
- Production `GET /api/payments/paydora/methods` now returns HTTP 503 and "Deposits are temporarily unavailable." Checked again today.
- Database controls for deposits, game loads, redemptions, payouts, and adjustments are all off.

## Existing game accounts

These rows are still in `game_accounts`. Nothing was deleted or recreated. Usernames are not listed here.

| Game | Saved accounts | Username stored | Provider id stored |
| --- | --- | --- | --- |
| Juwa | 3 | yes | no |
| Game Vault | 1 | yes | no |
| Vegas Sweeps | 1 | yes | no |
| Cash Frenzy | 1 | yes | no |
| Game Room | 1 | yes | no |

That is five games and seven accounts. Cash Machine, Mr All In One, and Mafia have no saved player account. The app resolves a player from the stored username when a transfer runs, so an empty provider id is not a deleted account. No username was rewritten.

All eleven pause rows are still paused: Juwa, Game Vault, Vegas Sweeps, Cash Frenzy, Cash Machine, Game Room, Mr All In One, Mafia, Fire Kirin, Milky Way, and Orion Stars.

Account lookup and balance retrieval were not sent to those providers. The agent credentials are only in Vercel, not on this machine, and they were not exported. Load, redeem, duplicate-transfer, and timeout tests were not run. Unverified providers stay paused.

Vercel production does have agent settings for Juwa, Game Vault, Vegas Sweeps, Cash Frenzy, Cash Machine, Game Room, and Mr All In One. It does not have a Mafia agent setting. Fire Kirin, Milky Way, Orion Stars, and Panda Master names exist locally. Panda Master still has no API client in this project.

## Customer workflows

| Step | Result |
| --- | --- |
| `/login` | HTTP 200 |
| `/register` | HTTP 200 |
| `/play` | HTTP 200 |
| Deposit methods | HTTP 503, deposits unavailable |
| Signed-in signup, KYC, wallet, game load, redeem, payout, history | Not opened. No authorized test-user session was available, and a real customer session was not used. |

## Admin workflows

Unsigned `/admin` was already redirecting to login on this deployment. An owner, staff, or store session was not opened. Staff-access unit tests from the previous build passed. That is not a signed-in dashboard check. The pending KYC submission was not decided.

## Guards, backup, secrets, legal

- The five database money controls are off. Triggers were not dropped.
- Profiles: 5. Wallet sum: 0. Payment intents: 1, still uncredited.
- The encrypted database backup from earlier today was not modified. The private identity image is still not in that backup. Storage was not opened or deleted.
- The exposed Paydora key is the credential that must be revoked. It is not in git and not in Vercel.
- No merchant-approval letter, counsel opinion, official rules approval, or free-entry method is in this project. Age and state checks in the code are not that approval.

## Exact blockers

1. Create a new Paydora API key in the Paydora dashboard, revoke the exposed one, and add the new key in the Vercel dashboard for `cashoutanytime`. Do not paste it into chat.
2. With deposits still off, run one sandbox or test checkout and one signed webhook. Credit must happen once, and a second delivery must not credit again. Failed and cancelled payments must not credit.
3. Run one test payout through success, failure, and timeout. A timeout must not be recorded as a failed payout and must not be retried blindly.
4. For each game that should go live, run lookup, balance, load, redeem, and a duplicate request on a provider-approved test account. Then resume that provider alone.
5. Open one authorized test player and one owner session for signup, KYC, wallet, and admin. Do not use a real customer's password and do not decide the pending KYC.
6. Back up the private identity image without a public link.
7. Obtain the written merchant and sweepstakes approvals before any real-money switch is turned on.

## Activation request

Do not enable deposits, payouts, loads, redemptions, or staff adjustments today. Do not resume any provider today.

When the tests above exist, the single activation is:

1. Store the replacement Paydora key in Vercel.
2. Enable deposits only after the test checkout and the duplicate webhook pass.
3. Resume one provider at a time, only after that provider's test account passes.
4. Enable loads and redemptions only for those passed providers.
5. Enable payouts only after the test payout passes.
6. Enable owner adjustments only, with the database guard still blocking everyone else.
