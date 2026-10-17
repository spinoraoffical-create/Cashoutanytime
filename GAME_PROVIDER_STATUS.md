# Game provider status

No provider was contacted. No credential was printed. No provider was enabled in `game_server_configs`.

A player cannot start an account, load, or redeem unless `isGameApiReady` is true. That check happens before `request_game_load`, so a missing login does not debit the wallet. The player sees “This game is not connected yet.”

| Game | Catalog | Integration in this repository | Turns on only when these exist | Status |
| --- | --- | --- | --- | --- |
| Fire Kirin | Active | Agent HTTP client in `firekirin-api.ts` | `FIREKIRIN_AGENT_USERNAME`, `FIREKIRIN_AGENT_PASSWORD` | CONFIGURATION MISSING |
| Juwa | Active | Agent HTTP client in `juwa-api.ts` | `JUWA_AGENT_ID`, `JUWA_SECRET_KEY` | CONFIGURATION MISSING |
| Orion Stars | Active | Agent HTTP client in `orionstars-api.ts` | `ORIONSTARS_AGENT_USERNAME`, `ORIONSTARS_AGENT_PASSWORD` | CONFIGURATION MISSING |
| Game Vault | Active | Agent HTTP client in `gamevault-api.ts` | `GAMEVAULT_AGENT_ID`, `GAMEVAULT_SECRET_KEY` | CONFIGURATION MISSING |
| Vegas Sweeps | Active | Agent HTTP client in `vegas-api.ts` | `VEGAS_AGENT_ID`, `VEGAS_SECRET_KEY` | CONFIGURATION MISSING |
| Milky Way | Active | Agent HTTP client in `milkyway-api.ts` | `MILKYWAY_AGENT_USERNAME`, `MILKYWAY_AGENT_PASSWORD` | CONFIGURATION MISSING |
| Panda Master | Active | No provider client | None in the repository | NOT IMPLEMENTED. Catalog only. Loads stay refused. |
| Cash Frenzy | Active | Agent client in `cashfrenzy-api.ts` | `CASHFRENZY_AGENT_USERNAME`, `CASHFRENZY_AGENT_PASSWORD` | CONFIGURATION MISSING |
| VBlink | Active | Portal client in `vblink-portal.ts` | `VBLINK_AGENT_USERNAME`, `VBLINK_AGENT_PASSWORD` | CONFIGURATION MISSING |
| Mafia | Active | Agent client in `mafia-api.ts` | `MAFIA_AGENT_USERNAME`, `MAFIA_AGENT_PASSWORD` | CONFIGURATION MISSING |
| Mr. All In One | Active | Agent client in `mrallinone-api.ts` | `MRALLINONE_AGENT_USERNAME`, `MRALLINONE_AGENT_PASSWORD` | CONFIGURATION MISSING |
| Cash Machine | Active | Agent client in `cashmachine-api.ts` | `CASHMACHINE_AGENT_USERNAME`, `CASHMACHINE_AGENT_PASSWORD` | CONFIGURATION MISSING |
| Ultra Panda, River Sweeps, Lucky Slots, High Stakes, Golden Dragon, Blue Dragon, Dragon Master, Game Room, Ace Book, Galaxy Games, Moolah, VB Game, Mega Spin, Lucky Lion, Pharaoh's Treasure, Ocean King, Fish Hunter, Monster Hunter, Buffalo Link | Inactive | Game Room has a client. The others do not. | Game Room uses `GAMEROOM_AGENT_USERNAME` and `GAMEROOM_AGENT_PASSWORD` | Inactive on purpose. Do not turn them on from this restoration. |
| Juwa 2.0 | Not in the repository | None | None | NOT IMPLEMENTED. Not invented. |

Hard-coded agent login pages exist as fallbacks in `src/lib/game-automation/config.ts` for several rooms. Those are public login pages, not credentials. They were not opened.

Automatic loading is intact as code: unknown provider results are held, confirmed failures can refund once, and a second open request is blocked. It is not intact as a live operation until each provider login is added and a non-live test is recorded.
