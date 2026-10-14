import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { visibleAdminNav } from "../src/lib/admin/nav.ts";

const page = readFileSync(new URL("../src/app/admin/payout-operations/page.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../src/app/admin/payout-operations/[id]/page.tsx", import.meta.url), "utf8");
const source = readFileSync(new URL("../src/lib/admin/payout-operations.ts", import.meta.url), "utf8");
const guard = readFileSync(new URL("../src/lib/admin/payout-operations-guard.ts", import.meta.url), "utf8");

assert.match(source, /adminListScope/);
assert.match(source, /readAgentScope/);
assert.match(source, /resolvePayoutReadPlan/);
assert.ok(source.indexOf("export async function resolvePayoutReadPlan") < source.indexOf("paydora_payout_requests"));
const resolverBody = source.slice(
  source.indexOf("export async function resolvePayoutReadPlan"),
  source.indexOf("export async function loadPayoutOperations")
);
assert.equal(resolverBody.includes("paydora_payout_requests"), false);

for (const file of [page, detail]) {
  assert.match(file, /resolvePayoutReadPlan/);
  assert.match(file, /redirect\("\/admin"\)/);
  assert.ok(file.indexOf("await resolvePayoutReadPlan") < file.indexOf("await loadPayoutOperation"));
  assert.equal(file.includes("paydora_payout_requests"), false);
  assert.equal(file.includes("payoutCashout"), false);
  assert.equal(file.includes("reserve_paydora_payout"), false);
  assert.equal(file.includes("fail_paydora_payout"), false);
}

assert.match(source, /id, user_id, amount, method, status/);
assert.equal(source.includes("idempotency_key"), false);
assert.equal(source.includes("destination_key"), false);
assert.equal(source.includes("provider_reference_id"), false);
assert.equal(source.includes("provider_withdrawal_id"), false);
assert.equal(source.includes("sk_live"), false);
assert.match(guard, /does not by itself show that a refund was posted/);
assert.match(guard, /Submitted does not mean paid/);
assert.match(guard, /Failed does not mean refunded/);

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
