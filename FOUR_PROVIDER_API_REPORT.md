# Four provider API report

Read-only checks were run from this computer on 17 Oct 2026. No recharge, redemption, account creation, password change, or other money movement was sent. Production was not deployed. No database migration was applied. Credentials stay in server-side environment variables and are not printed here.

The balance methods for Fire Kirin, Milky Way, and Orion Stars are the official Terminal API (`agentLogin` returns the agent balance, `queryInfo` returns a player balance). They are not browser logins to the agent panel. The older Fire Kirin store script, which reads a CAPTCHA image in a browser, was not used.

This computer’s router sends `orionstars.vip` and `milkywayapp.xyz` to `127.0.0.1`. Public DNS does not. The checks below used the public addresses and the official host name. That local DNS problem is not a provider IP whitelist.

| Game | API documentation received | Authentication working | Balance reading | Account creation | Recharge | Redemption | IP whitelist required | Remaining blockers |
|---|---|---|---|---|---|---|---|---|
| Fire Kirin | YES | YES | WORKING (agent balance only) | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNKNOWN | Player balance, create, recharge, redeem, and password reset were not called. The August 2026 document lists port 8034; that port did not accept a connection. Login succeeded on port 8033. Vercel’s outbound address was not tested. |
| Milky Way | YES | YES | WORKING (agent balance only) | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNKNOWN | Player balance, create, recharge, redeem, and password reset were not called. Recharge and redeem have no provider transaction id, so a repeat is blocked only inside one running server. Vercel’s outbound address was not tested. |
| Orion Stars | YES | NO | FAILED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNKNOWN | The saved login was rejected: “Login failed. Please check and try again.” The same rejection came back when the note’s title was tried as the agent name, and when the shared password used by the other two games was tried. This was not an IP-whitelist message. The exact agent name and password still need to be confirmed, and Terminal API must be enabled on that agent. |
| Panda Master | NO | NO | FAILED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNKNOWN | No API document matches Panda Master. No client was invented. The agent panel was not opened. |

## What each document is

- Fire Kirin: `FK Game API.docx`, version 1.0, revised 18 Aug 2026. Address in the document: `https://firekirin.xyz:8034/ws/service.ashx`.
- Milky Way: `MW Terminal API-v1.2.3- En.docx`. Address: `https://milkywayapp.xyz:8033/ws/service.ashx`.
- Orion Stars: `OS Terminal API-v1.2.6- En.docx`, dated 28 Jul 2026. Address: `https://orionstars.vip:8033/ws/service.ashx`.
- Panda Master: no matching document. The FastApi PDF and the two Juwa screenshots in the same zip belong to other games.

None of the three Terminal API documents mention an IP whitelist. Juwa and Game Vault do, and those rules were not applied to these games.

## What was verified on the wire

- Fire Kirin `agentLogin` on port 8033 returned a session. The agent balance was a real zero, not a missing value. Port 8034 timed out before any login was sent.
- Milky Way `agentLogin` returned a session and a numeric agent balance. The amount is not recorded here.
- Orion Stars `agentLogin` reached the server and returned “Login failed. Please check and try again.” No session and no balance were returned.
- Panda Master had nothing safe to call.

Player lookup, player balance, account creation, recharge, redemption, and password reset were not sent, so they stay unverified.

## What the code now does

Fire Kirin, Milky Way, and Orion Stars clients follow the documented login, player lookup, balance, recharge, redeem, and password-reset actions. A missing balance stays unknown and is not stored as zero. A recharge or redeem needs a request id. After a timeout or any result that is not a clear success or a clear failure, that request is not sent again by the same server process. A failed balance check after a transfer is treated as unknown and is not refunded. Orion Stars `resetAgentPasswd` and jackpot settings are not implemented, because those calls would change the agent account. Panda Master is still not marked ready, so a load cannot debit a wallet for it.

The duplicate-transfer guard lives in memory. Fire Kirin can also send the documented transaction id. Milky Way and Orion Stars have no such field in their documents, so a process restart can lose the guard. That needs a database record before those transfers go live, and that migration has not been written or applied.

## Not done

No live recharge, redemption, account creation, or password reset. No Production deploy. No hosted SQL. Juwa was not changed. Vercel’s outbound IP was not proven. The existing proxy addresses were not used for these checks.
