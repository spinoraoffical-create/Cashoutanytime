# Store automation foundation

Date: 17 October 2026

Project `zecitlewsynyioemsqna`. Production was not deployed. No portal login was attempted. No credit load or redemption was sent. Juwa was not modified. No hosted SQL was applied.

This is a mock-tested foundation. It is not unattended store operation.

## Confirmed functions

Juwa and Game Vault already create a player, read a balance, load, and redeem through their own API clients (`juwa-api.ts`, `gamevault-api.ts`). Those clients use an agent id and a secret, with numeric status codes. The new engine does not call them.

The four store portals named for this work are browser login pages. None of them has an official portal API in this repository.

| Provider | Portal page | Official portal API | What the repo can already call | Game records |
| --- | --- | --- | --- | --- |
| Orion Stars | `https://orionstars.vip:8781/Agent.aspx` | No | Terminal API client v1.2.6: `agentLogin`, `registerUser`, `queryInfo`, `recharge`, `redeem` on `/ws/service.ashx` | Not implemented |
| Milky Way | `https://milkywayapp.xyz:8781/default.aspx` | No | Terminal API client v1.2.3: the same five actions on `/ws/service.ashx` | Not implemented |
| Panda Master | `https://pandamaster.vip/Agent.aspx` | No | No provider client. The catalog link `https://pandamaster.vip:8888/index.html` is a player page. | Not implemented |
| Fire Kirin | `https://firekirin.xyz:8888/default.aspx?639278443848020008` | No | Terminal API client v1.0: the five actions plus `kickPlayerOut`. `firekirin-store.ts` can create a player on `Store.aspx` and reads the login CAPTCHA. This engine does not call that file. | Not implemented |

A store account can create players. A sub-distributor account cannot. The saved credentials are not labeled with that role, and the role was not read from a portal. Every live adapter therefore stays `unverified` and refuses account creation before any network call.

Terminal API methods above are present in source. They were not called in this pass, and they are not documentation of the Agent.aspx or `default.aspx` pages. The Fire Kirin owner URL and the existing `Store.aspx` URL were not shown to be the same session.

## API versus browser automation

Browser automation is not authorized. The instruction for this pass forbids logging in and forbids bypassing CAPTCHA, MFA, IP controls, or session limits. Fire Kirin’s known store login shows a CAPTCHA. Solving that image is out of scope.

A Terminal API path exists in code for Orion Stars, Milky Way, and Fire Kirin. Using it for unattended loads still needs a read-only `agentLogin` that returns code `200`, proof that the credential is a store account, and a separate approval before any recharge or redeem. Panda Master has neither an API client nor a portal adapter.

The live adapters return `Live store portal was not contacted. Browser automation is not authorized.` They do not open a socket.

## Worker architecture

`createStoreEngine()` is an in-process worker. It is not wired to `request_game_load`, `credit_wallet`, or `debit_wallet`.

- One queue per provider, then one lock per website player, so two providers do not share a session and one provider cannot run two transfers at once.
- The caller supplies the request id. The same id returns the stored result and does not call the adapter again.
- Load and redeem require an amount greater than zero, a game account mapped to that website user, a provider receipt, and a parsed balance. A button result with no receipt stays in `manual_review`.
- A missing balance is `manual_review`. The number 0 stays 0.
- An unknown provider result, a thrown worker error, or a receipt without a balance expires that provider session and holds the request. A later load or redeem for the same player is not sent.
- A session that is already expired is rejected before a new transfer is sent.
- Reconciliation matches only a confirmed receipt and the same balance. Anything else stays `manual_review`.
- The audit log stores the request id, provider, operation, state, and message. It has no password, cookie, or token field.
- `retryAllowed` is always false. A known failure can be attempted only as a new request id. An unknown credit result cannot.

Mock adapters implement the same interface and are the only adapters the tests execute successfully.

## Files

Created:

- `src/lib/store-automation/types.ts`
- `src/lib/store-automation/capabilities.ts`
- `src/lib/store-automation/parse.ts`
- `src/lib/store-automation/locks.ts`
- `src/lib/store-automation/adapters.ts`
- `src/lib/store-automation/orion-stars-adapter.ts`
- `src/lib/store-automation/milky-way-adapter.ts`
- `src/lib/store-automation/panda-master-adapter.ts`
- `src/lib/store-automation/fire-kirin-adapter.ts`
- `src/lib/store-automation/engine.ts`
- `src/lib/store-automation/index.ts`
- `scripts/store-automation.test.mjs`
- `scripts/dev-only/register-ts-ext.mjs`
- `scripts/dev-only/resolve-ts-ext.mjs`

No existing Juwa, Game Vault, or wallet file was edited.

## Tests

Command:

```powershell
node --import ./scripts/dev-only/register-ts-ext.mjs scripts/store-automation.test.mjs
```

Result: `store automation checks passed`.

The test covers live adapters refusing work, Panda Master having no client, a confirmed zero, a missing balance, duplicate request ids, ownership, a sub-distributor create, an unknown load, no second credit after that unknown result, an expired session, provider serialization, a worker exception, reconciliation, receipt-less success, and the absence of wallet, Juwa, Playwright, and HTTPS calls in the new engine.

These are mock tests. They are not live portal verification.

## Missing before unattended operation

1. Written permission to sign in to each store portal, or written confirmation that the Terminal API is the approved path for that store account.
2. A credential that is known to be a store account, not a sub-distributor, for each of the four games.
3. A read-only `agentLogin` from the host that will run the worker, with the provider code and message recorded. Production secret values cannot be read by the Vercel CLI on this machine, and `.env.local` does not contain these passwords.
4. Proof the existing proxy addresses are on the provider allow list. Vercel Functions do not have one static outbound IP. No new gateway was purchased.
5. For Fire Kirin, a portal flow that does not depend on solving the CAPTCHA, and confirmation of whether `default.aspx` and `Store.aspx` are the same agent session.
6. For Panda Master, the agent base URL, signing method, create, balance, load, redeem, and game-record endpoints, the error-code list, and the IP rule.
7. A game-record response sample for every provider. No endpoint for that operation is in the repo.
8. A named sandbox test before the engine is connected to the existing wallet reservation. Until then, players still use the current Juwa and Game Vault API paths, and these four store adapters do not move money.

## Blockers code cannot remove

- Authorization to log in has not been given.
- Store versus sub-distributor cannot be proven without an authorized session.
- Fire Kirin store login presents a CAPTCHA. Bypassing it is refused.
- Panda Master has no published integration in this project. Inventing endpoints would be a guess.
- The Terminal API and the store portal are different surfaces. A green Terminal API login would not, by itself, prove the Agent.aspx pages.
- Provider IP allow lists are controlled by the provider. This repository cannot make Vercel’s outbound address permanent.
- An unknown credit result must stay open until a person or a later provider receipt reconciles it. Retrying it in code would risk a second credit.
