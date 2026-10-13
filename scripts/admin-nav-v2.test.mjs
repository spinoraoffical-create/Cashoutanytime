import assert from "node:assert/strict";

import { visibleAdminNav } from "../src/lib/admin/nav.ts";

const labels = visibleAdminNav({
  isSuperAdmin: true,
  permissions: new Set(),
  roles: ["super_admin"],
}).map((section) => section.label);

for (const label of [
  "Dashboard",
  "Player CRM",
  "Financial Center",
  "Game Center",
  "Store Center",
  "Marketing Center",
  "Automation Center",
  "Rewards Center",
  "Verification Center",
  "Security Center",
  "Analytics Center",
  "Settings",
]) {
  assert.ok(labels.includes(label), label);
}

const store = visibleAdminNav({
  isSuperAdmin: false,
  permissions: new Set(["requests.manage", "support.manage"]),
  roles: ["store_creator"],
});
const storeHrefs = store.flatMap((section) => [section.href, ...section.children.map((child) => child.href)]);
assert.equal(storeHrefs.includes("/admin/support"), false);
assert.equal(storeHrefs.includes("/admin/chat"), false);
assert.equal(storeHrefs.includes("/admin/kyc"), false);
assert.equal(storeHrefs.includes("/admin/fraud"), false);

const contentAdmin = visibleAdminNav({
  isSuperAdmin: false,
  permissions: new Set(["cms.manage", "users.manage"]),
  roles: ["admin"],
});
const contentHrefs = contentAdmin.flatMap((section) => [section.href, ...section.children.map((child) => child.href)]);
assert.equal(contentHrefs.includes("/admin/kyc"), false);
assert.equal(contentHrefs.includes("/admin/users"), true);

const reviewer = visibleAdminNav({
  isSuperAdmin: false,
  permissions: new Set(["kyc.manage"]),
  roles: ["admin"],
});
const reviewerHrefs = reviewer.flatMap((section) => section.children.map((child) => child.href));
assert.equal(reviewerHrefs.includes("/admin/kyc"), true);

console.log("admin nav v2 checks passed");
