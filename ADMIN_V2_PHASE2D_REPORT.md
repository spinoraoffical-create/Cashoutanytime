# Admin v2 Phase 2D report

Date: 14 October 2026. This phase restyles the existing game screens and stops the game catalog from sending saved provider secrets to the browser. Provider API clients, payment routes, wallet math, refunds, payout reservation, SQL functions, migrations, row security, authentication, staff permission definitions, and production data were not edited. Nothing was deployed, committed, or written to the database.

## 1. Routes inspected

| Route | What it already did | Who can open it |
| --- | --- | --- |
| `/admin/game-accounts` | Links into the game tools | Staff. An account with no matching tool is redirected to `/admin` |
| `/admin/games` | Edit public game info and save provider connection fields | `cms.manage` |
| `/admin/game-loads` | Load, reload, and redeem queue | Platform staff with `requests.manage` or Super Admin. A store or sub sees only players in that network |
| `/admin/failed-loads` | Redirects to `/admin/game-loads?status=failed` | Same as game loads |
| `/admin/game-balances` | Reads live coin totals from the existing provider clients | Super Admin |

There is no separate provider-health page. `RetryLoadButton` exists in the code and is not mounted on these screens. This phase did not add it.

Stored game-load statuses in the type are `pending`, `processing`, `completed`, `failed`, and `cancelled`. The queue page already loads `load`, `reload`, and `redeem`.

## 2. Existing features preserved

- Game edit still calls `upsertGameAction` with the same fields, including active, featured, live, and bonus percents.
- Webhook and provider connection save still uses `authorize("cms.manage")` and the same `game_server_configs` upsert.
- A blank webhook secret, username, or password now keeps the saved value. A blank API address still clears that override, as before.
- The load queue still uses the same query, live refresh, search, failed-only link, and player scope.
- Complete and Failed still call `adminUpdateGameLoadStatus`. No second confirmation was added, because these buttons did not have one.
- A cancelled button was not added. Cancelled rows are explained when that status is already stored.
- The live coin page still calls `loadLiveGameBalances`. No extra provider call was added.

## 3. Provider information displayed

- Whether a provider connection is saved, without the username or password.
- Whether the webhook switch is on or off, and the public webhook address.
- The API address override, because clearing that field is how the default provider address is restored.
- Live coin rows: game name, store coins, player coins, player count, and the existing read status.
- A read that does not answer is labeled a read error. It is not described as proof that a provider transaction failed.

Saved webhook secrets, agent usernames, and agent passwords are no longer placed in the edit form.

## 4. UI improvements

- Game center, the catalog, the load queue, and live coins use the navy cards, status badges, and short explanations.
- Loading skeletons were added for those four routes.
- Pending, processing, completed, failed, and cancelled each have a plain-language line.
- Processing says a slow response is not proof the provider transaction failed.
- Complete and Failed say they change the request and can change the player wallet.
- Empty and error text on the live coin table says when no provider read is available.

## 5. Files changed

- `src/app/admin/games/page.tsx`
- `src/app/admin/games/loading.tsx`
- `src/app/admin/game-accounts/page.tsx`
- `src/app/admin/game-accounts/loading.tsx`
- `src/app/admin/game-loads/loading.tsx`
- `src/app/admin/game-balances/page.tsx`
- `src/app/admin/game-balances/loading.tsx`
- `src/components/admin/admin-wallet-loads-panels.tsx`
- `src/components/admin/admin-wallet-loads-sidebar-panel.tsx`
- `src/components/admin/game-load-actions.tsx`
- `src/components/admin/ui/admin-status-badge.tsx`
- `src/lib/admin/game-load-status.ts`
- `scripts/game-center-ui.test.mjs`
- `ADMIN_V2_PHASE2D_REPORT.md`

## 6. Tests passed

- `npx tsc --noEmit` — exit 0
- `node scripts/admin-nav-v2.test.mjs` — passed
- `node scripts/staff-access.test.mjs` — passed
- `node scripts/admin-list-scope.test.mjs` — passed
- `node scripts/game-center-ui.test.mjs` — passed
- `node scripts/game-load-outcome.test.mjs` — passed
- `node scripts/live-game-balances.test.mjs` — passed
- `node scripts/financial-trust.test.mjs` — passed
- `node scripts/firekirin-api.test.mjs` — passed
- `node scripts/auto-money.test.mjs` — passed
- `npx next build` — exit 0

The game UI test checks that the load page still scopes by parent, Complete and Failed stay wired without a new confirmation, the catalog no longer prints saved secrets into the form, and live coins stay Super Admin only.

## 7. Tests failed

None of the checks in section 6 failed.

## 8. Unverified behavior

- Signed-in browser use is NOT VERIFIED. A live Super Admin, store, and sub-creator session was not opened.
- The production site was not deployed.
- No SQL was run, and no provider panel was opened from this session.

## 9. Remaining risks

- The load panel still shows the player's game login and game password so staff can finish a load in the provider panel. That is the player's game sign-in, not the provider API secret.
- A saved webhook secret, username, or password cannot be cleared by emptying the field. Empty keeps the saved value so the secret is not sent to the browser.
- The load queue still shows `error_message` from the stored request. That text could include provider wording.
- Store and sub load lists still stop at 1,000 players. That limit was not changed.
- Complete and Failed can still change a wallet, and they still run on the first click. The label states that. The action itself was not changed.
- Opening live game coins still contacts the existing provider clients. That call was already part of the page.
