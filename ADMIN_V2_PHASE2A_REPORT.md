# Admin v2 Phase 2A report

Date: 13 October 2026. This phase renames one dashboard card and restyles the existing player, follow-up, ticket, and live-chat screens. Wallet math, payment code, refunds, game providers, migrations, row security, and staff permission checks were not edited. Nothing was deployed, committed, or written to the database.

## Files changed

- `src/app/admin/page.tsx`
- `src/app/admin/users/page.tsx`
- `src/app/admin/users/[id]/page.tsx`
- `src/app/admin/players/page.tsx`
- `src/app/admin/crm/page.tsx`
- `src/app/admin/support/page.tsx`
- `src/app/admin/support/[id]/page.tsx`
- `src/app/admin/chat/page.tsx`
- `src/components/admin/user-management-panel.tsx`
- `src/components/admin/network-players.tsx`
- `src/components/admin/crm-players-panel.tsx`
- `src/components/admin/ui/admin-data-table.tsx`
- `src/components/admin/ui/admin-section-card.tsx`
- `src/components/admin/ui/admin-status-badge.tsx`
- `src/lib/admin/nav.ts`
- `ADMIN_V2_PHASE2A_REPORT.md`

`eng.traineddata` stayed untracked.

## Audit finding

The owner dashboard card labeled "Failed webhooks" linked to `/admin/failed-loads`. That label is now "Failed Game Loads". The link and the count query were left as they were. The count still reads failed rows from `webhook_events`.

A second card, "Failed game loads", already links to the same page and counts failed rows from `game_load_requests`. Super Admin can now see both cards. The system-health line "Failed webhooks" still shows the webhook count and does not link to the game-load page.

## Existing features preserved

- `/admin/users` still requires `users.manage`, still searches name and email, and still opens `/admin/users/[id]`.
- `/admin/users/[id]` still checks `assertCanSeePlayer` before showing a profile.
- The profile still shows level, XP, coins, streak, play wallet, cash-out wallet, referral code, VIP, roles, identity status, and the assigned store or sub-creator.
- Coin ledger, deposit records, and game request records still load from the same queries.
- Support tickets on a player still appear only when `platformTicketAccess().tickets` is true, and each ticket still opens `/admin/support/[id]`.
- Account actions still call the same server actions: play-wallet adjustment, reward and XP adjustment, cash-out record, role save, ban, and delete. Delete still requires `users.delete`. Roles still require `users.roles`. Sub-creators still do not see those actions.
- `/admin/players` still uses `requireAgentScope` and `loadNetworkPlayers`. Search, parent filter, export, and move-selected still use the same routes and `movePlayerAction`.
- `/admin/crm` still uses `adminListScope`. The same segments and the same overview numbers are shown. The menu label is now "Player follow-up". The address and the `users.manage` check are unchanged.
- `/admin/support` and `/admin/support/[id]` still redirect stores and subs to `/admin/agent-inbox`, and still require Super Admin ticket access. Reply and ticket-status controls are unchanged.
- `/admin/chat` still uses the same inbox and the same access check. The page title was restyled. The chat component was not rebuilt.

## UI improvements

Player pages now use the navy cards, purple-to-blue filters, status badges, and the shared empty and error states. Search fields and tables keep the existing columns.

The player profile separates "Account details" from "Account actions". Details are described as read-only. The action card says that its buttons change the player. The ban control is labeled "Block access" or "Restore access" and still calls the existing ban action.

The follow-up page labels the stored fulfilled deposit total as "Fulfilled deposits" and says it is not profit. Network players explain that moving a player changes the store assignment and that opening a profile does not change a balance.

## Tests passed

- `npx tsc --noEmit`
- `node scripts/admin-nav-v2.test.mjs`
- `node scripts/staff-access.test.mjs`
- `node scripts/admin-list-scope.test.mjs`
- `node scripts/player-transactions.test.mjs`
- `npx next build` (existing image and hook warnings, exit 0)

## Tests failed

None.

## Unverified behavior

A signed-in desktop, tablet, and mobile pass was not taken. These pages require a staff session, and this pass did not sign anyone in or out. Live player rows, ticket threads, and the chat inbox were not clicked in a browser.

The owner reference image is still not in the project folder, so the screens follow the written navy, purple, and blue direction.

## Remaining issues

- The renamed dashboard card and the older "Failed game loads" card both open `/admin/failed-loads`, with different counts. A later pass can remove the webhook card or point it at a real webhook list. That was not done here.
- The player profile does not have a separate game-load history query. Game activity on that page is the deposit and game-request history that was already loaded.
- Live chat message layout was not redesigned. Only the page title and description changed.
- Management pages outside Player CRM still use their previous forms.
- The public site does not serve this work until a later deploy.
