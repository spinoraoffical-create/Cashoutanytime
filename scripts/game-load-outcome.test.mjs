import assert from "node:assert/strict";

import {
  classifyProviderOutcome,
  completionApplies,
  mayRefundLoad,
  secondLoadBlocked,
} from "../src/lib/game-automation/load-outcome.ts";

assert.equal(classifyProviderOutcome({ success: true }), "confirmed_success");
assert.equal(mayRefundLoad({
  outcome: "confirmed_success",
  loadType: "load",
  gameApiDebited: true,
  walletRefunded: false,
}), false);

assert.equal(classifyProviderOutcome({ success: false, error: "Account not found" }), "confirmed_failure");
assert.equal(mayRefundLoad({
  outcome: "confirmed_failure",
  loadType: "load",
  gameApiDebited: false,
  walletRefunded: false,
}), true);

assert.equal(classifyProviderOutcome({ success: false, error: "Fire Kirin API connection timed out after 15s" }), "unknown");
assert.equal(mayRefundLoad({
  outcome: "unknown",
  loadType: "load",
  gameApiDebited: false,
  walletRefunded: false,
}), false);
assert.equal(secondLoadBlocked("pending"), true);

assert.equal(classifyProviderOutcome({ success: true, error: "late response" }), "confirmed_success");
assert.equal(mayRefundLoad({
  outcome: "confirmed_success",
  loadType: "load",
  gameApiDebited: true,
  walletRefunded: false,
}), false);

assert.equal(completionApplies("completed"), false);
assert.equal(completionApplies("pending"), true);

assert.equal(mayRefundLoad({
  outcome: "confirmed_failure",
  loadType: "load",
  gameApiDebited: false,
  walletRefunded: true,
}), false);

assert.equal(secondLoadBlocked("processing"), true);
assert.equal(secondLoadBlocked("completed"), false);

assert.equal(classifyProviderOutcome({ success: false, error: "worker interrupted before the provider answered" }), "unknown");
assert.equal(mayRefundLoad({
  outcome: "unknown",
  loadType: "reload",
  gameApiDebited: false,
  walletRefunded: false,
}), false);

assert.equal(classifyProviderOutcome({ success: false, error: "socket hang up" }), "unknown");
assert.equal(completionApplies("pending"), true);

console.log("game load outcome checks passed");
