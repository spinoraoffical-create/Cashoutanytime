# Admin v2 Phase 2C report

Date: 13 October 2026. This phase restyles the existing store and sub-creator screens. Payment routes, wallet math, payout reservation, refunds, game providers, migrations, SQL functions, row security, authentication, staff permission definitions, and production data were not edited. Nothing was deployed, committed, or written to the database.

## 1. Routes inspected

| Route | What it already did | Who can open it |
| --- | --- | --- |
| `/admin` for a store or sub | Store home with player, load, deposit, and commission counts | Store or sub session |
| `/admin/agents` | Links into store tools | `requireStaff`, then the same tool rules as before |
| `/admin/sub-creators` | Search, filter, create, edit, activate, export, and password reset | `requireAgentScope`. A sub-creator is redirected to `/admin/players` |
| `/admin/sub-creators/export` | Existing export | Unchanged |
| `/admin/players` | Assigned players, parent filter, and move | `requireAgentScope`. A sub-creator cannot move players |
| `/admin/players/export` | Existing export | Unchanged |
| `/admin/agent-inbox` | Player chat for the signed-in creator | Store or sub. Other staff see the explanation only |
| `/admin/agent-reports` | Link to player transactions | Platform, store, or sub. Others redirect to `/admin` |
| `/admin/player-transactions` | Existing scoped transaction report | Unchanged in this phase |

There is no separate store settings route and no `/admin/stores/[id]` page. The existing account view is `/admin/sub-creators?focus=`. Commission data that already exists is `agent_accounts.commission_bps` and the `agent_commissions` total on the store home. There is no commission payout screen.

## 2. Existing features preserved

- Create store, create sub-creator, edit, activate, deactivate, bulk deactivate, password reset, referral link, export, and the player link still call the same actions.
- The same confirmation prompts still run before deactivate, bulk deactivate, password reset, and player move.
- Store creation stays limited to a platform session. A store still creates sub-creators only under itself.
- A sub-creator still cannot open the directory and still cannot move players.
- Player search, parent filter, export, and move still use `loadNetworkPlayers` and `movePlayerAction`.
- Store-home counts still use the same profile, game-load, deposit, and `agent_commissions` queries.
- The wallet total on the directory is still the sum of the wallet balances already loaded for the visible accounts.
- The focus view still shows that account's stored wallet and stored commission rate. It does not calculate profit.

## 3. Store hierarchy implementation

The hierarchy shown in the interface is the one already stored:

Platform, then a store (`agent_accounts.tier = store_creator`), then a sub-creator (`tier = sub_creator` with `parent_id` pointing at the store), then players whose `profiles.parent_agent_id` points at that store or sub-creator.

A player assigned directly to a store has no sub-creator. The player table shows a dash in that case. The directory account view counts only players whose parent is that account, and it lists sub-creators already present in the loaded directory.

## 4. UI improvements

- Store center, the directory, the store home, reports, player chat, and the player list use the navy cards, status badges, and short explanations.
- The directory has loading, empty, and error states. A failed load says the list is unavailable instead of looking like an empty business.
- The focus link opens an account overview with assigned players, sub-creators, and the stored wallet and commission rate.
- Labels distinguish a store, a sub-creator, and a player.
- Buttons that create accounts, change accounts, or move players say that they do not send a payment or change a wallet.
- The commission figure is described as stored commission records. The screen does not pay commission.

## 5. Files changed

- `src/app/admin/agents/page.tsx`
- `src/app/admin/agents/loading.tsx`
- `src/app/admin/sub-creators/page.tsx`
- `src/app/admin/sub-creators/loading.tsx`
- `src/app/admin/agent-reports/page.tsx`
- `src/app/admin/agent-inbox/page.tsx`
- `src/app/admin/players/page.tsx`
- `src/components/admin/sub-creators-manager.tsx`
- `src/components/admin/agent-home.tsx`
- `src/components/admin/network-players.tsx`
- `src/components/admin/store-hierarchy.tsx`
- `src/components/admin/store-account-focus.tsx`
- `scripts/store-center-ui.test.mjs`
- `ADMIN_V2_PHASE2C_REPORT.md`

## 6. Tests passed

- `npx tsc --noEmit` — exit 0
- `node scripts/admin-nav-v2.test.mjs` — passed
- `node scripts/staff-access.test.mjs` — passed
- `node scripts/admin-list-scope.test.mjs` — passed
- `node scripts/player-transactions.test.mjs` — passed
- `node scripts/store-center-ui.test.mjs` — passed
- `npx next build` — exit 0

The store UI test checks that the directory still loads through `requireAgentScope`, a sub-creator is still redirected, create and account actions are still wired, player move still requires confirmation, and the store home still reads `agent_commissions`.

## 7. Tests failed

None of the checks in section 6 failed.

## 8. Unverified behavior

- Signed-in browser use is NOT VERIFIED. A live store, sub-creator, and platform session was not opened.
- The production site was not deployed.
- No SQL was run.

## 9. Remaining risks

- Store and sub visibility still depends on the existing `requireAgentScope` and `parent_agent_id` checks. Those checks were not widened. A bug in that existing scope would still be able to list the wrong network.
- The directory account view lists sub-creators from the current filtered list. A status or search filter can hide a sub-creator from that card even though the account still exists.
- The store home still loads at most 1,000 players for the newest-player list and the 7-day count derived from that load. The separate player count query is unchanged.
- Stored commission and wallet figures are still shown. They are not a profit report, and this phase does not add a way to pay them.
