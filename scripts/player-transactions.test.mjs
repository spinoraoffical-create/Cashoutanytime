import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canSeeNavItem } from "../src/lib/admin/nav.ts";
import {
  filterTransactions,
  parentIdsForStore,
  parseTransactionQuery,
  rechargeAmounts,
  transactionAudience,
  transactionTotal,
} from "../src/lib/admin/player-transactions.ts";

const store = "store-a";
const sub = "sub-a";
const other = "store-b";
const agents = [
  { userId: store, tier: "store_creator", parentId: null },
  { userId: sub, tier: "sub_creator", parentId: store },
  { userId: other, tier: "store_creator", parentId: null },
  { userId: "sub-b", tier: "sub_creator", parentId: other },
];
const storeParents = parentIdsForStore(store, agents);
assert.deepEqual(storeParents, [store, sub]);

const stores = [
  { id: store, name: "Store A", parentIds: storeParents },
  { id: other, name: "Store B", parentIds: parentIdsForStore(other, agents) },
];

const storeView = transactionAudience({
  level: "store",
  isSuperAdmin: false,
  parentIds: storeParents,
  storeFilter: other,
  stores,
});
assert.equal(storeView.mode, "rows");
if (storeView.mode === "rows") assert.deepEqual(storeView.parentIds, [store, sub]);

const subView = transactionAudience({
  level: "sub",
  isSuperAdmin: false,
  parentIds: [sub],
  storeFilter: store,
  stores,
});
assert.equal(subView.mode, "rows");
if (subView.mode === "rows") assert.deepEqual(subView.parentIds, [sub]);

const adminView = transactionAudience({
  level: "platform",
  isSuperAdmin: true,
  parentIds: [],
  storeFilter: null,
  stores,
});
assert.equal(adminView.mode, "rows");
if (adminView.mode === "rows") assert.equal(adminView.parentIds, null);

const adminStore = transactionAudience({
  level: "platform",
  isSuperAdmin: true,
  parentIds: [],
  storeFilter: store,
  stores,
});
assert.equal(adminStore.mode, "rows");
if (adminStore.mode === "rows") assert.deepEqual(adminStore.parentIds, [store, sub]);

const unknownStore = transactionAudience({
  level: "platform",
  isSuperAdmin: true,
  parentIds: [],
  storeFilter: "missing-store",
  stores,
});
assert.equal(unknownStore.mode, "rows");
if (unknownStore.mode === "rows") assert.deepEqual(unknownStore.parentIds, []);

assert.equal(
  transactionAudience({
    level: null,
    isSuperAdmin: false,
    parentIds: [],
    storeFilter: null,
    stores,
  }).mode,
  "deny"
);

const quotes = [{ requestId: "load-1", depositKey: "dep-1", baseAmount: 10, finalCredit: 15 }];
assert.deepEqual(rechargeAmounts({ id: "load-1", sourceKey: null }, quotes), { collected: 10, creditSpent: 15 });
assert.deepEqual(rechargeAmounts({ id: "other", sourceKey: "auto:dep-1" }, quotes), { collected: 10, creditSpent: 15 });
assert.deepEqual(rechargeAmounts({ id: "none", sourceKey: "manual" }, quotes), { collected: null, creditSpent: null });

function row(partial) {
  return {
    playerName: "Ada",
    email: "ada@example.com",
    game: "Juwa",
    createdAt: "2026-10-02T15:00:00.000Z",
    status: "completed",
    collected: null,
    creditSpent: null,
    redeemAmount: null,
    ...partial,
  };
}

const rows = [
  row({ id: "1", kind: "recharge", parentAgentId: store, playerName: "Ada", email: "ada@example.com", collected: 10, creditSpent: 15 }),
  row({ id: "2", kind: "recharge", parentAgentId: sub, playerName: "Bea", email: "bea@example.com", collected: 20, creditSpent: 22, createdAt: "2026-10-08T12:00:00.000Z" }),
  row({ id: "3", kind: "recharge", parentAgentId: other, playerName: "Cam", email: "cam@example.com", collected: 99, creditSpent: 100 }),
  row({ id: "4", kind: "recharge", parentAgentId: store, status: "failed", creditSpent: 5 }),
  row({ id: "5", kind: "redeem", parentAgentId: sub, redeemAmount: 40 }),
  row({ id: "6", kind: "recharge", parentAgentId: null, creditSpent: 8 }),
];

const visible = filterTransactions(rows, {
  kind: "recharge",
  query: "",
  status: "completed",
  from: null,
  to: null,
  parentIds: [store, sub],
});
assert.deepEqual(visible.map((item) => item.id), ["1", "2"]);
assert.equal(transactionTotal(visible, "recharge"), 37);
assert.notEqual(transactionTotal(visible, "recharge"), 30);

const byEmail = filterTransactions(rows, {
  kind: "recharge",
  query: "BEA@",
  status: "all",
  from: "2026-10-01",
  to: "2026-10-31",
  parentIds: [store, sub],
});
assert.deepEqual(byEmail.map((item) => item.id), ["2"]);

const redeems = filterTransactions(rows, {
  kind: "redeem",
  query: "ada",
  status: "completed",
  from: null,
  to: null,
  parentIds: [sub],
});
assert.deepEqual(redeems.map((item) => item.id), ["5"]);
assert.equal(transactionTotal(redeems, "redeem"), 40);

const everyone = filterTransactions(rows, {
  kind: "recharge",
  query: "",
  status: "completed",
  from: null,
  to: null,
  parentIds: null,
});
assert.deepEqual(everyone.map((item) => item.id), ["1", "2", "3", "6"]);

assert.equal(parseTransactionQuery({}).kind, "recharge");
assert.equal(parseTransactionQuery({}).status, "completed");
assert.equal(parseTransactionQuery({ tab: "redeem", status: "failed", from: "2026-10-01", to: "nope" }).kind, "redeem");
assert.equal(parseTransactionQuery({ from: "2026-10-01", to: "nope" }).to, null);

const navItem = { permission: null, roleAny: ["super_admin", "store_creator", "sub_creator"] };
assert.equal(canSeeNavItem({ isSuperAdmin: false, permissions: new Set(), roles: ["store_creator"] }, navItem), true);
assert.equal(canSeeNavItem({ isSuperAdmin: false, permissions: new Set(), roles: ["sub_creator"] }, navItem), true);
assert.equal(canSeeNavItem({ isSuperAdmin: true, permissions: new Set(), roles: ["super_admin"] }, navItem), true);
assert.equal(canSeeNavItem({ isSuperAdmin: false, permissions: new Set(["requests.manage"]), roles: ["admin"] }, navItem), false);

const page = readFileSync(new URL("../src/app/admin/player-transactions/page.tsx", import.meta.url), "utf8");
const data = readFileSync(new URL("../src/lib/admin/player-transactions-data.ts", import.meta.url), "utf8");
assert.equal(page.includes("commission"), false);
assert.equal(data.includes("agent_commissions"), false);
assert.match(page, /Credit spent/);
assert.match(page, /Collected/);

console.log("player transaction checks passed");
