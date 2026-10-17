# Account creation readiness

No player account was created. No coins were loaded or redeemed. No migration was applied. Nothing was deployed. Panda Master was not included.

Account creation is prepared and disarmed. `TERMINAL_ACCOUNT_CREATION_ARMED` is false, so `registerUser` is not called.

## Error 201

Fire Kirin and Milky Way agent login still succeed. Login does not use the signed formula.

`getgamelist` does not need a player account. It uses the same documented signature as every later call: MD5 of the lowercased agent name, a new timestamp, and the lowercased agent key. Both providers returned code 201 and the message `Signature error.`

That is the same failure previously seen on player lookup. It is not caused by a missing player. The agent panels have no players, and this call does not ask for one.

The published example hash still matches the documented formula. The sample `registerUser` URL in the documents uses a different signature value that does not match that formula. Those sample links are placeholders. The formula was not changed.

Orion Stars `checkAccountName` for an unused name returned code 200 and status available. `queryInfo` for that same name returned code 201 and `The account does not exist. Please check and try again.` Orion signed calls work, and a missing player is reported clearly.

## What to ask Fire Kirin and Milky Way

Send this to each provider separately:

Agent login (`action=agentLogin`) succeeds and returns an agentKey. The next call uses a new timestamp and `sign = MD5(lowercase(agentName) + time + lowercase(agentKey))`, which is the formula in the Terminal API document. `action=getgamelist` then returns code 201 and `Signature error.` `action=queryInfo` returns the same message. This agent has no player accounts. Please enable signed Terminal API calls for this agent, or send the exact signature string the server checks. Fire Kirin port 8034 does not accept a connection; login works on port 8033. Please confirm which port serves signed calls. Please reply with one working signed example for this agent. Do not send a password.

## Creation workflow

All three documents create a player with `action=registerUser`. The account is 6 to 32 letters or numbers. Orion’s name check allows 6 to 25. The password is sent as an MD5. The signature is the same formula as the other signed calls.

The prepared workflow does four things:

1. It refuses to run while creation is disarmed.
2. It requires a signed read to succeed first. Fire Kirin and Milky Way use `getgamelist`. Orion Stars uses `checkAccountName`.
3. It creates a name only when that read says the name is available, or player lookup clearly says the account does not exist. A signature error, a timeout, or any other unclear lookup does not create an account.
4. After `registerUser` returns 200, `queryInfo` must return 200 and a numeric balance, including zero. Anything else stays unconfirmed, is not saved, and is not sent again for that name in the same process.

A second create for a held name is refused. The documents do not define a provider transaction id for `registerUser`, and no new database table was added, so two different servers could still race. The supervised test should be one account from one process.

## Readiness

| Game | Supervised account test | Still blocked |
| --- | --- | --- |
| Orion Stars | Ready for one account. Signed name check and missing-account lookup both worked. | The create call itself has not been sent, so create permission is unproven until that one test. Coin load and redeem stay off. |
| Fire Kirin | Not ready. | Every signed call returns `Signature error.` Ask the provider the questions above. |
| Milky Way | Not ready. | Same signature error. Ask the provider the questions above. |
| Panda Master | Excluded. | No Terminal API document. |
