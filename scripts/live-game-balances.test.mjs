import assert from "node:assert/strict";
import { ADMIN_NAV, canSeeNavItem } from "../src/lib/admin/nav.ts";
import {
  coinText,
  playerListFinished,
  sumPlayerScores,
} from "../src/lib/admin/live-game-balances.ts";

assert.equal(sumPlayerScores([{ score: 100 }, { score: 16 }, { score: null }]), 116);
assert.equal(coinText(100), "100");
assert.equal(coinText(16.5), "16.50");
assert.equal(coinText(null), "—");
assert.equal(playerListFinished({ page: 1, rowCount: 100, seen: 100, total: 250 }), false);
assert.equal(playerListFinished({ page: 3, rowCount: 50, seen: 250, total: 250 }), true);

const item = ADMIN_NAV.flatMap((section) => section.children).find((child) => child.href === "/admin/game-balances");
assert.ok(item);
assert.equal(item.superOnly, true);
assert.equal(
  canSeeNavItem({ isSuperAdmin: true, permissions: new Set(), roles: ["super_admin"] }, item),
  true
);
assert.equal(
  canSeeNavItem(
    { isSuperAdmin: false, permissions: new Set(["requests.manage"]), roles: ["store_creator"] },
    item
  ),
  false
);

console.log("live game coins ok");
