# Provider readiness matrix

Date: 17 October 2026

Read-only query on `zecitlewsynyioemsqna` at the time of this report. No provider was called. No account was created. No coins were loaded or redeemed. A configured credential name from an earlier env-name check is not proof that load or redeem works.

| Provider | Catalog | Pause row | Balance read | Account create | Load | Redeem | Reconciliation | Real-value status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Juwa | Active | No | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Disabled |
| Game Vault | Active | No | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Disabled |
| Vegas Sweeps | Active | No | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Disabled |
| Cash Frenzy | Active | No | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Disabled |
| Cash Machine | Active | No | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Disabled |
| Game Room | Active | No | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Disabled |
| Mr All In One | Active | No | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Disabled |
| Mafia | Active | No | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Disabled. No provider credential was verified this session |
| Fire Kirin | Inactive | Paused | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Disabled |
| Milky Way | Inactive | Paused | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Disabled |
| Orion Stars | Inactive | Paused | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Disabled |
| Panda Master | Inactive | No pause row | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Disabled |
| VBlink | Inactive | No pause row | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Disabled |

The pause table only has Fire Kirin, Milky Way, and Orion Stars. It does not pause Juwa, Game Vault, Vegas Sweeps, Cash Frenzy, Cash Machine, Game Room, Mr All In One, or Mafia. Those eight stay active in the catalog. Real transfers stay off in the local application until `REAL_VALUE_GAME_LOADS` or `REAL_VALUE_REDEMPTIONS` is exactly `on`. That protection is not on the live deployment yet.

Earlier zero-dollar game-load rows are not proof of a successful transfer.
