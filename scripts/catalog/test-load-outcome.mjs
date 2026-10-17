import assert from "node:assert/strict";
import {
  adminFinancialStatusDecision,
  classifyProviderOutcome,
  mayRefundLoad,
  staleLoadRpcDecision,
} from "../../src/lib/game-automation/load-outcome.ts";

assert.equal(classifyProviderOutcome({ success: true }), "confirmed_success");
assert.equal(classifyProviderOutcome({ success: false, error: "timed out" }), "unknown");
assert.equal(classifyProviderOutcome({ success: false, error: "player not found" }), "confirmed_failure");

assert.equal(
  mayRefundLoad({
    outcome: "unknown",
    loadType: "load",
    gameApiDebited: false,
    walletRefunded: false,
  }),
  false
);
assert.equal(
  mayRefundLoad({
    outcome: "confirmed_failure",
    loadType: "load",
    gameApiDebited: true,
    walletRefunded: false,
  }),
  false
);
assert.equal(
  mayRefundLoad({
    outcome: "confirmed_failure",
    loadType: "load",
    gameApiDebited: false,
    walletRefunded: true,
  }),
  false
);
assert.equal(
  mayRefundLoad({
    outcome: "confirmed_failure",
    loadType: "load",
    gameApiDebited: false,
    walletRefunded: false,
  }),
  true
);
assert.equal(
  mayRefundLoad({
    outcome: "confirmed_failure",
    loadType: "redeem",
    gameApiDebited: false,
    walletRefunded: false,
  }),
  false
);

const rpcFailed = staleLoadRpcDecision({ rpcFailed: true, healedCount: 4 });
assert.equal(rpcFailed.appRefund, false);
assert.equal(rpcFailed.healed, 0);

const rpcOk = staleLoadRpcDecision({ rpcFailed: false, healedCount: 2 });
assert.equal(rpcOk.appRefund, false);
assert.equal(rpcOk.healed, 2);

assert.equal(adminFinancialStatusDecision({ status: "pending" }).proceed, false);
assert.equal(adminFinancialStatusDecision({ status: "completed" }).reason, "already_settled");

console.log("load-outcome checks passed");
