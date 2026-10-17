# All game providers

Date: 17 October 2026

Project `zecitlewsynyioemsqna`. Live site `https://www.sweeptakehub.com` is still deployment `dpl_58Da2u81ovHBncLnj9MfVorL9QSm`. The safety fixes from this pass are on Preview `dpl_FtgqU4HYYhm7aZZXJtEcZSSaQFx1` only. No real game load or redemption was sent. The old Supabase project was not contacted.

Branch `restore/public-game-catalog`, commit `b6afbc6`. Uncommitted work was left in place. No secret file is tracked by Git.

## Catalog

Twelve active games: Fire Kirin, Juwa, Orion Stars, Game Vault, Vegas Sweeps, Milky Way, Panda Master, Cash Frenzy, VBlink, Mafia, Mr. All In One, Cash Machine.

Nineteen games stay inactive, including Game Room. Game Room has a provider client and stored credential names, but it is not in the public catalog.

## Status table

| Game | Provider client | Credentials configured | Account creation | Balance retrieval | Load support | Redeem support | Security | Overall status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fire Kirin | Yes. `firekirin-api.ts` | Production names present. Password is Production only. | NOT TESTED | NOT TESTED | Code exists. NOT TESTED live. | Code exists. NOT TESTED live. | Server check before a transfer. Secrets stay on the server. | PARTIALLY WORKING |
| Juwa | Yes. `juwa-api.ts` | Production and Preview names present. | VERIFIED WORKING. Owner confirmed a new account and the agent panel. | VERIFIED WORKING. Owner confirmed the balance matched the panel. | Code exists. NOT TESTED live. | Code exists. NOT TESTED live. | Server check before a transfer. Secrets stay on the server. | PARTIALLY WORKING |
| Orion Stars | Yes. `orionstars-api.ts` | Production and Preview names present. | NOT TESTED | NOT TESTED | Code exists. NOT TESTED live. | Code exists. NOT TESTED live. | Server check before a transfer. Secrets stay on the server. | PARTIALLY WORKING |
| Game Vault | Yes. `gamevault-api.ts` | Production names present. Secret is Production only. | NOT TESTED | NOT TESTED | Code exists. NOT TESTED live. | Code exists. NOT TESTED live. | Server check before a transfer. Secrets stay on the server. | PARTIALLY WORKING |
| Vegas Sweeps | Yes. `vegas-api.ts` | Production and Preview names present. | NOT TESTED | NOT TESTED | Code exists. NOT TESTED live. | Code exists. NOT TESTED live. | Server check before a transfer. Secrets stay on the server. | PARTIALLY WORKING |
| Milky Way | Yes. `milkyway-api.ts` | Production names present. Username is Production only. | NOT TESTED | NOT TESTED | Code exists. NOT TESTED live. | Code exists. NOT TESTED live. | Server check before a transfer. Secrets stay on the server. | PARTIALLY WORKING |
| Panda Master | No client in the repo. | No provider env names. | NOT IMPLEMENTED | NOT IMPLEMENTED | NOT IMPLEMENTED | NOT IMPLEMENTED | Load controls stay off when no client is configured. | NOT IMPLEMENTED |
| Cash Frenzy | Yes. `cashfrenzy-api.ts` | Production and Preview names present. | NOT TESTED | NOT TESTED | Code exists. NOT TESTED live. | Code exists. NOT TESTED live. | Shared fallback password removed. | PARTIALLY WORKING |
| VBlink | Yes. `vblink-portal.ts` | No `VBLINK_AGENT_USERNAME` or `VBLINK_AGENT_PASSWORD` on Vercel. | CONFIGURATION REQUIRED | CONFIGURATION REQUIRED | CONFIGURATION REQUIRED | CONFIGURATION REQUIRED | Request is refused until credentials exist. | CONFIGURATION REQUIRED |
| Mafia | Yes. `mafia-api.ts` | No `MAFIA_AGENT_USERNAME` or `MAFIA_AGENT_PASSWORD` on Vercel. | CONFIGURATION REQUIRED | CONFIGURATION REQUIRED | CONFIGURATION REQUIRED | CONFIGURATION REQUIRED | Request is refused until credentials exist. | CONFIGURATION REQUIRED |
| Mr. All In One | Yes. `mrallinone-api.ts` | Production and Preview names present. | NOT TESTED | NOT TESTED | Code exists. NOT TESTED live. | Code exists. NOT TESTED live. | Shared fallback password removed. | PARTIALLY WORKING |
| Cash Machine | Yes. `cashmachine-api.ts` | Production and Preview names present. | NOT TESTED | NOT TESTED | Code exists. NOT TESTED live. | Code exists. NOT TESTED live. | Shared fallback password removed. | PARTIALLY WORKING |

Credential values were not printed. A missing balance is not saved as zero. A confirmed zero remains zero. No provider sandbox call was made in this pass.

## Problems

### Panda Master has no provider client

1. Cause: the catalog lists Panda Master, and no file implements that provider.
2. Files: `src/lib/games.ts`, `src/lib/game-automation/provider-ready.ts`.
3. Fix: the game page now says it is not connected and does not offer create, load, or redeem. No client was invented.
4. Test: `scripts/game-load-outcome.test.mjs` checks that Panda Master is not a ready provider.
5. Blocker: a real client and authorized credentials.
6. Owner action: required before this game can create accounts or move money.

### VBlink and Mafia have clients but no Vercel credentials

1. Cause: the code looks for agent username and password env names that are not on the Vercel project.
2. Files: `src/lib/game-automation/vblink-portal.ts`, `src/lib/game-automation/mafia-api.ts`.
3. Fix: those games are treated as not ready, so the player sees “Not connected yet” instead of a transfer form.
4. Test: readiness returns false when the env names are empty. No live login was attempted.
5. Blocker: authorized agent credentials.
6. Owner action: required. Do not reuse a former partner’s login unless that use is authorized.

### A missing balance could be stored as zero

1. Cause: a successful balance check with no returned number fell back to the request amount, which can be zero.
2. File: `src/lib/actions/game-loads.ts`.
3. Fix: `confirmedCheckBalance` accepts only a real number. Zero stays zero. A missing number is held for review and is not shown as a confirmed zero.
4. Test: `scripts/game-load-outcome.test.mjs`.
5. Blocker: none for this rule. Live balance calls were not repeated.
6. Owner action: not required for the code fix. Preview has it. Production does not until a later deploy is approved.

### Four providers could save the password `123456`

1. Cause: Cash Frenzy, Cash Machine, Game Room, and Mr. All In One used that password when the caller omitted one.
2. Files: the four `*-service.ts` create-account functions. Game Room is inactive and was included so the same hole is closed.
3. Fix: account creation now stops if a password was not supplied. The normal signup path still generates a password first.
4. Test: the same script checks those files no longer contain `123456`.
5. Blocker: none.
6. Owner action: not required.

### Hosted stale-load function is still the stub

1. Cause: a read-only check of `public.fail_stale_game_loads` on `zecitlewsynyioemsqna` found no “held for review” text and did find a return-zero path.
2. File prepared locally: `supabase/migrations/20261017000200_hold_stale_game_loads_for_review.sql`.
3. Fix implemented: none on the hosted database.
4. Test: local `scripts/stale-load-hold.test.mjs` passed. The hosted function was only read.
5. Blocker: the safer function must not be applied without approval. It does not refund and does not change a wallet.
6. Owner action: required before that migration is applied. Rollback is to restore the current stub function.

## Follow-up, 17 October 2026

Production is still `dpl_58Da2u81ovHBncLnj9MfVorL9QSm`. No recharge, withdrawal, load, or redemption was sent. Juwa client code was not changed. The hosted stale-load function was only read.

### Terminal API versus the status-code dictionary

No 18-page provider PDF is in this repository. The only copied official dictionary is the Game Vault / Juwa list in `src/lib/game-automation/error-formatter.ts` and `src/lib/game-automation/juwa-api.ts`: success is code 0, and code 5 means the caller IP is not whitelisted. That dictionary does not apply to Fire Kirin, Orion Stars, or Milky Way.

Those three use a different Terminal API. Each client posts `action=agentLogin` to `/ws/service.ashx`, sends the agent password as an MD5 hash, and treats string code `200` plus an agent key as success. Later calls sign `lowercase(agentName + time + agentKey)`.

| Provider | Client version | Difference from the other two |
| --- | --- | --- |
| Fire Kirin | Terminal API v1.0 | Fixed host `firekirin.xyz:8033`. Later calls do not send `agentkey`. No special case for code `201`. Proxy is used only after a connection failure. |
| Orion Stars | Terminal API v1.2.6 | Default host `34.212.168.0:8033` with Host `orionstars.vip`. Later calls send `agentkey`. Code `201` is treated as session timeout or store-balance failure. |
| Milky Way | Terminal API v1.2.3 | Default host `47.252.40.52:8033` with Host `milkywayapp.xyz`. Later calls send `agentkey`. Code `201` can mean a bad signature, a disabled Terminal API permission, a session timeout, or a store-balance failure. |

These code meanings come from the client source. They were not confirmed on the wire in this pass.

### Read-only login

Authorized credentials for these three games are stored as Vercel Production secrets. They are not in `.env.local`. The Vercel CLI cannot download Production secret values into this machine, and the previously pulled env file does not contain usable secret values. No `agentLogin` call was made. No response code for authentication, agent permission, or IP whitelist was observed.

Proxy names that do exist on Vercel: `FIREKIRIN_PROXY_URL` (Production only), `MILKYWAY_PROXY_URL` (Production, Preview, Development), and `GAMEVAULT_PROXY_URL` (all three). `ORIONSTARS_PROXY_URL` is not defined. The Orion client falls back to `GAMEVAULT_PROXY_URL`.

Vercel Functions do not have one static outbound IP. A whitelist of the platform’s raw address will not stay valid. A new gateway was not purchased. The existing proxy settings are the gateway already configured, and they are unproven until a read-only `agentLogin` through that proxy returns code `200`. Fire Kirin will not switch to its proxy when the provider returns a JSON IP rejection; it switches only when the connection itself fails.

The read-only probe is `scripts/dev-only/terminal-login-probe.mjs`. It calls `agentLogin` only. It needs a shell that already has the Production secret values.

### Panda Master specification still missing

There is no provider client and no Panda Master environment variable. The catalog download address `https://pandamaster.vip:8888/index.html` is a player page, not an agent API. Before any integration, the owner needs the agent API base URL, the authentication and signing method, the account-creation endpoint, the balance endpoint, the load endpoint, the redemption endpoint, the error-code list, the IP rule, whether a sandbox exists, and written permission to use an agent account. None of those were invented.

### VBlink and Mafia credentials

Not present in `.env.local`. Not present on the Vercel project. Not present in the pulled Production env file.

Required names:

- `VBLINK_AGENT_USERNAME`
- `VBLINK_AGENT_PASSWORD`
- `MAFIA_AGENT_USERNAME`
- `MAFIA_AGENT_PASSWORD`

Optional overrides already supported by the clients: `VBLINK_API_URL` (default `https://gm.vblink777.club`) and `MAFIA_ADMIN_URL` (default `https://agentserver.mafia77777.com`).

### Stale-load hold, disposable database

Hosted `public.fail_stale_game_loads` on `zecitlewsynyioemsqna` was read again. It still returns zero, does not contain the review note, does not mention a refund, and does not mention a wallet balance.

The local replacement was applied only inside a disposable Postgres 16 container, then the container was removed. `scripts/catalog/test-stale-hold.sql` passed. Two stale rows were marked for review. The wallet stayed at 0. The ledger insert trigger, `credit_wallet`, `debit_wallet`, and `refund_game_load_wallet` were not called. A fresh row and a completed row were unchanged. The second call returned 0. The `authenticated` role was denied. The transaction was rolled back.

### Next action for each active game

| Game | Confirmed provider code | Next action |
| --- | --- | --- |
| Fire Kirin | None on the wire. Client success code is `200`. | Run read-only `agentLogin` where Production secrets are available. Do not recharge. |
| Juwa | Owner already confirmed account creation and balance. Load and redeem were not called. | Leave the client unchanged. A live load or redeem needs a separate approval. |
| Orion Stars | None on the wire. Client success code is `200`. Code `201` is a client-side failure class. | Same read-only `agentLogin`, through `GAMEVAULT_PROXY_URL` because Orion has no proxy name of its own. |
| Game Vault | Not called. Dictionary code 5 is the IP-whitelist failure for this family. | No live transfer. Confirm the existing proxy with a read-only balance call only after approval. |
| Vegas Sweeps | Not called. Same code family as Juwa. | No live transfer until a named test is approved. |
| Milky Way | None on the wire. Client success code is `200`. Code `201` can mean permission or signature failure. | Same read-only `agentLogin` through `MILKYWAY_PROXY_URL`. |
| Panda Master | No client. | Supply the agent API specification listed above. |
| Cash Frenzy | Not called. | No live transfer. Password fallback remains removed. |
| VBlink | Not called. | Add `VBLINK_AGENT_USERNAME` and `VBLINK_AGENT_PASSWORD` after confirming they are authorized. |
| Mafia | Not called. | Add `MAFIA_AGENT_USERNAME` and `MAFIA_AGENT_PASSWORD` after confirming they are authorized. |
| Mr. All In One | Not called. | No live transfer. Password fallback remains removed. |
| Cash Machine | Not called. | No live transfer. Password fallback remains removed. |

## Approval required before the hosted stale-load change

Do not apply `supabase/migrations/20261017000200_hold_stale_game_loads_for_review.sql` until the owner approves it.

- Function: `public.fail_stale_game_loads(integer, uuid, text)`
- Current hosted body: returns 0 and does not update a row
- Replacement: writes one `[held for review]` note, leaves status open, and does not change a wallet
- Test: disposable Postgres 16, `scripts/catalog/test-stale-hold.sql`, plus `scripts/stale-load-hold.test.mjs`
- Rollback: replace the function with the current hosted body that returns 0 and does not update `game_load_requests`

## What was not claimed

Live account creation, balance, load, and redeem were not run for any game except the Juwa account and balance the owner already confirmed. Buttons and client classes are not treated as proof. Player A versus Player B and staff-versus-owner permission checks were not repeated against live accounts in this pass. Server routes still require a signed-in player and refuse a game that is not ready.
