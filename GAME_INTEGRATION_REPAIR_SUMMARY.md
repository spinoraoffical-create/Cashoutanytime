# Game integration repair summary

Date: 17 October 2026

## Fully verified

Juwa account creation and Juwa balance retrieval. The owner confirmed the website balance matched the Juwa agent panel. No other live provider operation was confirmed in this pass.

## Partially working

Fire Kirin, Juwa (load and redeem still untested), Orion Stars, Game Vault, Vegas Sweeps, Milky Way, Cash Frenzy, Mr. All In One, and Cash Machine. Each has a server client and the Production credential names it requires. None of those load or redeem paths were executed with real money.

## Credentials required

VBlink and Mafia. The clients exist. The Vercel project has no agent username or password for either one.

## Missing provider client

Panda Master. It stays in the catalog and does not offer transfers.

Game Room is inactive. It has a client and credential names, and it is not one of the 12 public games.

## Bugs fixed

- A balance check with no number is held for review instead of being saved as zero.
- Cash Frenzy, Cash Machine, Game Room, and Mr. All In One no longer fall back to the password `123456`.
- A game with no ready provider shows “Not connected yet” and hides create, load, and redeem.

## Tests added

`scripts/game-load-outcome.test.mjs` covers a confirmed zero, a missing balance, the password fallback, and Panda Master staying unready.

Also run: typecheck, stale-load hold, financial trust, and live-game balance display checks. All passed.

## Financial safety blockers

- Do not send live loads or redeems until each provider is approved for a named test.
- The hosted `fail_stale_game_loads` function is still the stub that returns zero. The local replacement only marks rows for review and does not refund. It was not applied.
- Unknown provider results stay open. They are not auto-refunded.

## Production readiness

Not ready to call every game fully working. Production was not updated in this follow-up. Preview `dpl_FtgqU4HYYhm7aZZXJtEcZSSaQFx1` has the safety fixes and is not the live site. The live site remains `dpl_58Da2u81ovHBncLnj9MfVorL9QSm`. Live loads and redemptions stay disabled.

## Follow-up findings

The Game Vault / Juwa code list does not apply to Fire Kirin, Orion Stars, or Milky Way. Those three use Terminal API versions 1.0, 1.2.6, and 1.2.3. Their client success code is `200`. A live `agentLogin` was not sent because Production secret values cannot be read on this machine and `.env.local` does not contain them.

Vercel has no single static outbound IP. Proxy names already exist for Fire Kirin, Milky Way, and, through `GAMEVAULT_PROXY_URL`, Orion Stars. No new gateway was purchased. Whether those proxies are accepted is unconfirmed.

Panda Master still has no agent API specification. VBlink and Mafia still need `VBLINK_AGENT_USERNAME`, `VBLINK_AGENT_PASSWORD`, `MAFIA_AGENT_USERNAME`, and `MAFIA_AGENT_PASSWORD`.

## Stale-load approval

The hosted function still returns zero. The review replacement passed in a disposable Postgres 16 database: no wallet change, no credit, no debit, no refund, no second hold, and no access for the `authenticated` role. It is not applied. Rollback is to restore the current return-zero function. Owner approval is required before that SQL is run on `zecitlewsynyioemsqna`.
