import assert from "node:assert/strict";

import { adminListScope } from "../src/lib/admin/list-scope.ts";
import {
  APPROVED_HOLD_NOTES,
  NETWORK_LOOKUP_ERROR,
  SAFE_PROVIDER_REFERENCES,
  SAFE_PROVIDER_STATUSES,
  planPayoutQuery,
  payoutStatusHelp,
  showExact,
  showHoldNote,
  showPayoutMethod,
  showProviderReference,
  showProviderStatus,
} from "../src/lib/admin/payout-operations-guard.ts";

const storeDecision = adminListScope({
  isSuperAdmin: false,
  hasStaffPermission: true,
  scopeStatus: "ok",
  scope: { level: "store", parentIds: ["store-1", "sub-1"] },
});
const subDecision = adminListScope({
  isSuperAdmin: false,
  hasStaffPermission: true,
  scopeStatus: "ok",
  scope: { level: "sub", parentIds: ["sub-1"] },
});
const platformStaff = adminListScope({
  isSuperAdmin: false,
  hasStaffPermission: true,
  scopeStatus: "ok",
  scope: null,
});
const outsider = adminListScope({
  isSuperAdmin: false,
  hasStaffPermission: false,
  scopeStatus: "ok",
  scope: null,
});

assert.equal(outsider.mode, "deny");
assert.deepEqual(
  planPayoutQuery({ decision: outsider, networkLookup: { ok: true, userIds: ["player-a", "player-b"] } }),
  { action: "deny" }
);

const missingScope = adminListScope({
  isSuperAdmin: true,
  hasStaffPermission: true,
  scopeStatus: "missing",
  scope: null,
});
assert.equal(planPayoutQuery({ decision: missingScope, networkLookup: { ok: true, userIds: ["player-a"] } }).action, "deny");

assert.equal(platformStaff.mode, "all");
assert.deepEqual(planPayoutQuery({ decision: platformStaff, networkLookup: null }), {
  action: "query",
  scope: { mode: "all" },
});
assert.deepEqual(planPayoutQuery({ decision: platformStaff, networkLookup: { ok: false } }), {
  action: "query",
  scope: { mode: "all" },
});

assert.equal(storeDecision.mode, "network");
assert.deepEqual(
  planPayoutQuery({ decision: storeDecision, networkLookup: { ok: true, userIds: ["player-store"] } }),
  { action: "query", scope: { mode: "network", userIds: ["player-store"] } }
);
const storePlan = planPayoutQuery({
  decision: storeDecision,
  networkLookup: { ok: true, userIds: ["player-store"] },
});
if (storePlan.action === "query" && storePlan.scope.mode === "network") {
  assert.equal(storePlan.scope.userIds.includes("store-1"), false);
  assert.equal(storePlan.scope.userIds.includes("sub-1"), false);
  assert.equal(storePlan.scope.userIds.includes("player-sub"), false);
}

assert.equal(subDecision.mode, "network");
assert.deepEqual(
  planPayoutQuery({ decision: subDecision, networkLookup: { ok: true, userIds: ["player-sub"] } }),
  { action: "query", scope: { mode: "network", userIds: ["player-sub"] } }
);

assert.deepEqual(
  planPayoutQuery({ decision: storeDecision, networkLookup: { ok: true, userIds: [] } }),
  { action: "empty" }
);
assert.deepEqual(planPayoutQuery({ decision: subDecision, networkLookup: { ok: true, userIds: [] } }), {
  action: "empty",
});

const lookupFailed = planPayoutQuery({ decision: storeDecision, networkLookup: { ok: false } });
assert.equal(lookupFailed.action, "error");
if (lookupFailed.action === "error") assert.equal(lookupFailed.message, NETWORK_LOOKUP_ERROR);
assert.equal(planPayoutQuery({ decision: subDecision, networkLookup: null }).action, "error");
assert.equal(JSON.stringify(lookupFailed).includes('"mode":"all"'), false);

assert.deepEqual(showHoldNote("Risk review"), { state: "visible", value: "Risk review" });
assert.deepEqual(showHoldNote("Above the automatic cash-out limit"), {
  state: "visible",
  value: "Above the automatic cash-out limit",
});
assert.deepEqual(showHoldNote("Automatic cash out is off until a limit is set"), {
  state: "visible",
  value: "Automatic cash out is off until a limit is set",
});
assert.equal(APPROVED_HOLD_NOTES.length, 3);
assert.equal(showHoldNote("Risk review sk_live_abc").state, "hidden");
assert.equal(showHoldNote("Bearer secret-token").state, "hidden");
assert.equal(showHoldNote("").state, "empty");

assert.equal(SAFE_PROVIDER_REFERENCES.length, 0);
assert.equal(showProviderReference("wd_live_key_123").state, "hidden");
assert.equal(showProviderReference("sk_live_51").state, "hidden");
assert.equal(showExact("raw provider response {token:abc}", SAFE_PROVIDER_REFERENCES).state, "hidden");
assert.equal(showProviderReference("").state, "empty");

assert.deepEqual(showProviderStatus("paid"), { state: "visible", value: "Paid" });
assert.deepEqual(showProviderStatus("SUBMITTED"), { state: "visible", value: "Submitted" });
assert.equal(SAFE_PROVIDER_STATUSES.includes("paid"), true);
assert.equal(showProviderStatus("api key rejected: sk_live_secret").state, "hidden");
assert.equal(showProviderStatus("").state, "empty");

assert.deepEqual(showPayoutMethod("cashapp"), { state: "visible", value: "Cash App" });
assert.equal(showPayoutMethod("4111111111111111").state, "hidden");
assert.equal(showPayoutMethod("").state, "empty");

assert.match(payoutStatusHelp("submitted"), /Submitted does not mean paid/);
assert.match(payoutStatusHelp("failed"), /Failed does not mean refunded/);
assert.match(payoutStatusHelp("failed"), /does not by itself show that a refund was posted/);
assert.match(payoutStatusHelp("manual_review"), /requires investigation/);

console.log("payout operations security checks passed");
