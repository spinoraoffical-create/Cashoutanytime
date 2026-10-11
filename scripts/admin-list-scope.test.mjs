import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adminListScope, idsOrNone, UNMATCHED_SCOPE_ID } from "../src/lib/admin/list-scope.ts";

const storeId = "store-1";
const subId = "sub-1";

const storeWithPermission = adminListScope({
  isSuperAdmin: false,
  hasStaffPermission: true,
  scopeStatus: "ok",
  scope: { level: "store", parentIds: [storeId, subId] },
});
assert.equal(storeWithPermission.mode, "network");
if (storeWithPermission.mode === "network") {
  assert.deepEqual(storeWithPermission.parentIds, [storeId, subId]);
}

const subCreator = adminListScope({
  isSuperAdmin: false,
  hasStaffPermission: true,
  scopeStatus: "ok",
  scope: { level: "sub", parentIds: [subId] },
});
assert.equal(subCreator.mode, "network");
if (subCreator.mode === "network") assert.deepEqual(subCreator.parentIds, [subId]);

const superAdmin = adminListScope({
  isSuperAdmin: true,
  hasStaffPermission: true,
  scopeStatus: "ok",
  scope: { level: "platform", parentIds: [storeId, subId] },
});
assert.equal(superAdmin.mode, "all");

const superAdminWhoIsStore = adminListScope({
  isSuperAdmin: true,
  hasStaffPermission: true,
  scopeStatus: "ok",
  scope: { level: "store", parentIds: [storeId] },
});
assert.equal(superAdminWhoIsStore.mode, "network");

const missingScope = adminListScope({
  isSuperAdmin: true,
  hasStaffPermission: true,
  scopeStatus: "missing",
  scope: null,
});
assert.equal(missingScope.mode, "deny");

const unavailable = adminListScope({
  isSuperAdmin: false,
  hasStaffPermission: true,
  scopeStatus: "unavailable",
  scope: { level: "platform", parentIds: [] },
});
assert.equal(unavailable.mode, "deny");

const invalidParents = adminListScope({
  isSuperAdmin: false,
  hasStaffPermission: true,
  scopeStatus: "ok",
  scope: { level: "store", parentIds: [storeId, ""] },
});
assert.equal(invalidParents.mode, "deny");

const unknownLevel = adminListScope({
  isSuperAdmin: true,
  hasStaffPermission: true,
  scopeStatus: "ok",
  scope: { level: "partner", parentIds: [storeId] },
});
assert.equal(unknownLevel.mode, "deny");

const emptyNetwork = adminListScope({
  isSuperAdmin: false,
  hasStaffPermission: true,
  scopeStatus: "ok",
  scope: { level: "sub", parentIds: [] },
});
assert.equal(emptyNetwork.mode, "deny");

const staffWithoutAgent = adminListScope({
  isSuperAdmin: false,
  hasStaffPermission: true,
  scopeStatus: "ok",
  scope: null,
});
assert.equal(staffWithoutAgent.mode, "all");

assert.deepEqual(idsOrNone([]), [UNMATCHED_SCOPE_ID]);
assert.deepEqual(idsOrNone([storeId]), [storeId]);

for (const name of ["deposits/page.tsx", "payouts/page.tsx", "crm/page.tsx"]) {
  const source = readFileSync(new URL(`../src/app/admin/${name}`, import.meta.url), "utf8");
  assert.match(source, /adminListScope/);
  assert.match(source, /readAgentScope/);
  assert.equal(source.includes("network && !platform"), false);
}

const crm = readFileSync(new URL("../src/lib/data/admin-crm.ts", import.meta.url), "utf8");
const scoped = crm.slice(crm.indexOf("export async function getCrmOverviewForParents"));
assert.match(crm, /admin-crm-overview-stats/);
assert.equal(scoped.includes("admin_crm_overview_stats"), false);
assert.match(scoped, /parent_agent_id/);
assert.match(crm, /parentIds && parentIds.length === 0/);

const scope = readFileSync(new URL("../src/lib/agents/scope.ts", import.meta.url), "utf8");
assert.match(scope, /status: "missing"/);
assert.match(scope, /if \(result\.status !== "ok"\) return null/);

console.log("admin list scope checks passed");
