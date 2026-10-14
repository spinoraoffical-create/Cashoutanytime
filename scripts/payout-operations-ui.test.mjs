import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { visibleAdminNav } from "../src/lib/admin/nav.ts";

const page = readFileSync(new URL("../src/app/admin/payout-operations/page.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../src/app/admin/payout-operations/[id]/page.tsx", import.meta.url), "utf8");
const source = readFileSync(new URL("../src/lib/admin/payout-operations.ts", import.meta.url), "utf8");

for (const file of [page, detail]) {
  assert.match(file, /adminListScope/);
  assert.match(file, /readAgentScope/);
  assert.match(file, /redirect\("\/admin"\)/);
  assert.equal(file.includes("payoutCashout"), false);
  assert.equal(file.includes("reserve_paydora_payout"), false);
  assert.equal(file.includes("fail_paydora_payout"), false);
}

assert.match(source, /id, user_id, amount, method, status/);
assert.equal(source.includes("idempotency_key"), false);
assert.equal(source.includes("destination_key"), false);
assert.match(source, /does not by itself show that a refund was posted/);

const manager = visibleAdminNav({
  isSuperAdmin: false,
  permissions: new Set(["cms.manage", "analytics.read"]),
  roles: ["manager"],
}).flatMap((section) => [section.href, ...section.children.map((child) => child.href)]);
assert.equal(manager.includes("/admin/payout-operations"), false);

const cashier = visibleAdminNav({
  isSuperAdmin: false,
  permissions: new Set(["requests.manage"]),
  roles: ["admin"],
}).flatMap((section) => [section.href, ...section.children.map((child) => child.href)]);
assert.equal(cashier.includes("/admin/payout-operations"), true);

console.log("payout operations ui checks passed");
