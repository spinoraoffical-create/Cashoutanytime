# Staging end-to-end

Date: 18 October 2026

Production https://www.sweeptakehub.com and Supabase `zecitlewsynyioemsqna` were not changed. Production money controls were read after this work and all five are still off. Production login still returns 200.

## Staging

- URL: https://cashoutanytime-staging.vercel.app
- Vercel project: `cashoutanytime-staging` (`prj_F5JUrZrNKRm8IAIooOClXawfqWOF`)
- Deployment: `dpl_7bvY1kUxdLryeBu79kCxonwGFL8G`
- Database: Supabase `sweeptakehub-staging`, ref `kvawfdjangwoaaqhyxnf`
- The five `REAL_VALUE_*` switches are `on` in this project only.
- The five staging `real_value_controls` rows are enabled.
- `PAYDORA_API_KEY` is not set here. No game-agent passwords were copied here.
- A staging-only webhook secret is set. It is not the production secret.

Test account passwords are in `C:\Users\asus\AppData\Local\SweepstakesHubStaging\credentials.txt`. They are not in git.

| Account | Role |
| --- | --- |
| staging-owner@sweeptakehub.test | super admin |
| staging-staff@sweeptakehub.test | support agent |
| staging-store@sweeptakehub.test | store creator |
| staging-player@sweeptakehub.test | player |

## Financial guard

On the staging database, before the switches were turned on, a deposit ledger insert was rejected with `real value off`. After the five controls were enabled, the same insert was accepted inside a transaction that was rolled back. Turning deposits off inside a transaction blocked the insert again, and that transaction restored deposits to on. The ledger row count stayed 0 after those probes.

## Paydora

Paydora has no published sandbox for `https://cpcs.paydora.net/api/v1`. No checkout, charge, or payout was sent to that host.

The staging deposit-methods route returns 503: “Deposits are temporarily unavailable. Please try again later or contact support.” The deposits switch is on, and the route still stops because the API key is absent.

Signed callbacks were posted to the staging webhook with the staging secret. They are application tests, not events Paydora sent.

| Case | Result |
| --- | --- |
| Bad signature | 401 INVALID SIGNATURE |
| Paid, USD, $10.99, matching intent | 200. One credit of $16.49, which is $10.99 plus the 50% first-deposit bonus. |
| Same callback again | 200. No second credit. |
| Status failed | Stored as ignored. No credit. |
| Status cancelled | Stored as ignored. No credit. |
| Paid with no currency | Held. No credit. |
| Refund of the paid credit | Full $16.49 reversed. Player wallet is $0.00. Unpaid remainder $0.00. |

The paid callback also opened a Juwa reload of $16.49. The provider was not contacted. `game_api_debited` is false, `wallet_refunded` is true, and the error is “Game API credentials are not configured.” No game account was created.

Payout success, failure, and timeout were not run. A payout call without a sandbox key is classified as ambiguous and would leave the reservation pending. That call was not sent.

## Game providers

Juwa, Game Vault, Vegas Sweeps, Cash Frenzy, and Game Room are in the staging catalog. Game Room’s seed row was inactive and was turned on in staging only.

None of these five has a sandbox base URL or a provider-issued test agent in this project. They were not resumed. Staging has no agent passwords, so the site cannot log into the live panels.

The signed-in player page for Juwa says: “Juwa does not have a game connection on this site yet. Account creation, balance, load, and redeem stay off until it does.”

Missing for each of Juwa, Game Vault, Vegas Sweeps, Cash Frenzy, and Game Room:

- a sandbox or provider-approved test host
- a test agent login that is not the live production agent
- written permission to create an account, read a balance, load, and redeem on that host

## Customer and admin

Signed in on staging in the browser.

- Player `staging-player@sweeptakehub.test` reaches the home lobby. Wallet, cash-out ready, and freeplay show $0.00. Juwa, Game Vault, Vegas Sweeps, and Cash Frenzy are listed.
- Owner `staging-owner@sweeptakehub.test` opens `/admin` as Super Admin and `/admin/games`. The dashboard shows 4 players, 1 active store, 1 failed game load, and the rejected $10.99 deposit. Paydora webhook secret shows as configured. The Paydora API key is not configured.
- Staff and store accounts exist. Their sign-in screens were not clicked in this pass. The owner dashboard already counts the store account.

## Production activation is still blocked

1. Paydora sandbox base URL and test key, or written permission to use a named test mode. The exposed live key must stay revoked.
2. One Paydora-issued test deposit, signed webhook, and payout, including timeout.
3. Provider test hosts and test agents for Juwa, Game Vault, Vegas Sweeps, Cash Frenzy, and Game Room, then a lookup, balance, load, redeem, and duplicate test for each.
4. Written merchant approval and the sweepstakes legal requirements, including a free-entry method.
5. A private backup of the production identity image.

Do not turn on the production `REAL_VALUE_*` switches or the production database controls until those exist.
