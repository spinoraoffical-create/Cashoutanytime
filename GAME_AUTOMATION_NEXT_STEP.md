# Game automation next step

17 October 2026. One Orion Stars test account was created. No coins were loaded or redeemed. Nothing was deployed. Wallet functions were not changed. Fire Kirin, Milky Way, and Panda Master were not changed.

## Orion Stars result

On 17 October 2026 the account-claim migration was applied only through the linked project `zecitlewsynyioemsqna`. The old project was not used. `registerUser` was sent once for `coaunused1`. `queryInfo` returned code 200 and player balance 0. The saved row is `confirmed`. A second claim returns `hold`. Automatic player creation stays disarmed. No coins were loaded or redeemed. Nothing was deployed.

The player password was not stored. The Orion Stars website panel was not opened. The account is visible to the official agent API. The migration is now on `zecitlewsynyioemsqna`. It does not change wallet balances.

## Fire Kirin and Milky Way signed API

The documented signature is what the code sends.

- `agentLogin` does not use a signature. It sends the MD5 password and a timestamp. It succeeds and returns `agentKey`.
- The next call uses that `agentKey`, not the password. The code reads `agentKey` or `agentkey`.
- The signature is MD5 of the lowercased agent name, a new timestamp, and the lowercased agent key. The published example hash matches this formula.
- Each signed call uses a new timestamp. The login timestamp is not reused.
- Parameter names match the documents: `agentName`, `time`, `sign`, and `account` on lookup. The password is not part of the signature.
- The request is a POST with those fields on the query string, the same transport as the successful login.
- `getgamelist` needs no player. It returned code 201 and `Signature error.` on both providers. Lookup returned the same message.
- Millisecond and 10-digit timestamps both received that message. The sign string is under the 63-character note.
- Fire Kirin port 8033 is open and is where login succeeds. Port 8034, listed in the Fire Kirin document, still times out. Signed calls were not moved to a different formula.

Player balance, account creation, recharge, and redeem on these two games all require that signature. Those calls stay blocked. Agent balance is available from the unsigned login response.

## Agent panels

These pages were requested and not logged in to:

| Page | Result |
| --- | --- |
| Fire Kirin `Store.aspx` and `default.aspx` on port 8888 | HTTP 500. No login form. |
| Orion Stars `Agent.aspx` on port 8781 | HTTP 500. No login form. |
| Milky Way `default.aspx` on port 8781 | HTTP 500. No login form. |

No panel showed player creation, balance, recharge, or redeem. Those workflows are not verified.

`firekirin-store.ts` expects a CAPTCHA image and reads it with optical character recognition. That file was not run. Orion Stars and Milky Way have no panel automation. A panel fallback is not available.

## Architecture now

1. Orion Stars `coaunused1` exists in the agent API with balance 0. Automatic creation for other players stays off.
2. Fire Kirin and Milky Way Terminal API calls that need a signature stay blocked. There is no verified panel fallback.
3. Coin recharge and redeem in the uncommitted code call the transfer ledger. That ledger is not installed, so those changes were not deployed.
4. The new account record does not debit or credit the wallet.

## Deploy stop

The transfer ledger migration is now installed on `zecitlewsynyioemsqna`. Fire Kirin, Milky Way, and Orion Stars are paused. Wallet fingerprints and the five game-load rows were unchanged. Nothing was committed, pushed, or deployed. Git has no author name or email.
