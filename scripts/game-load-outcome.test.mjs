import assert from "node:assert/strict";

import { readFileSync } from "node:fs";

import {
  adminFinancialStatusDecision,
  classifyProviderOutcome,
  completionApplies,
  mayRefundLoad,
  PROVIDER_OUTCOME_UNVERIFIED,
  closeRefundedRejection,
  secondLoadBlocked,
  STALE_LOAD_CHECK_FAILED,
  confirmedCheckBalance,
  staleLoadRpcDecision,
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
assert.equal(closeRefundedRejection({
  outcome: "confirmed_failure",
  loadType: "load",
  walletRefunded: true,
  status: "pending",
}), true);
assert.equal(closeRefundedRejection({
  outcome: "confirmed_failure",
  loadType: "load",
  walletRefunded: false,
  status: "pending",
}), false);
assert.equal(closeRefundedRejection({
  outcome: "unknown",
  loadType: "load",
  walletRefunded: false,
  status: "pending",
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

const misleadingHold = "Needs review abc. ";
assert.equal(classifyProviderOutcome({ success: false, error: misleadingHold }), "confirmed_failure");
assert.equal(
  adminFinancialStatusDecision({ status: "pending", loadType: "load" }).reason,
  PROVIDER_OUTCOME_UNVERIFIED
);

assert.equal(classifyProviderOutcome({ success: false, error: "Account not found" }), "confirmed_failure");
assert.equal(mayRefundLoad({
  outcome: "confirmed_failure",
  loadType: "load",
  gameApiDebited: false,
  walletRefunded: false,
}), true);
assert.equal(
  adminFinancialStatusDecision({ status: "pending", loadType: "load" }).reason,
  PROVIDER_OUTCOME_UNVERIFIED
);

assert.equal(classifyProviderOutcome({ success: false, error: "provider timed out" }), "unknown");
assert.equal(mayRefundLoad({
  outcome: "unknown",
  loadType: "load",
  gameApiDebited: false,
  walletRefunded: false,
}), false);
assert.equal(
  adminFinancialStatusDecision({ status: "processing", loadType: "load" }).reason,
  PROVIDER_OUTCOME_UNVERIFIED
);

assert.equal(classifyProviderOutcome({ success: false, error: "" }), "unknown");
assert.equal(
  adminFinancialStatusDecision({ status: "pending", loadType: "reload" }).reason,
  PROVIDER_OUTCOME_UNVERIFIED
);

assert.equal(mayRefundLoad({
  outcome: "confirmed_failure",
  loadType: "create_account",
  gameApiDebited: false,
  walletRefunded: false,
}), false);
assert.equal(
  adminFinancialStatusDecision({ status: "pending", loadType: "create_account" }).reason,
  PROVIDER_OUTCOME_UNVERIFIED
);
assert.equal(
  adminFinancialStatusDecision({ status: "pending", loadType: "new_account" }).reason,
  PROVIDER_OUTCOME_UNVERIFIED
);

function clickFailed(row) {
  const decision = adminFinancialStatusDecision(row);
  if (decision.reason !== "already_settled") return row;
  return row;
}
let openLoad = { status: "pending", loadType: "load", refunds: 0 };
openLoad = clickFailed(openLoad);
openLoad = clickFailed(openLoad);
assert.equal(openLoad.refunds, 0);
assert.equal(openLoad.status, "pending");
assert.equal(adminFinancialStatusDecision({ status: "failed", loadType: "load" }).reason, "already_settled");

const rpcSuccess = staleLoadRpcDecision({ rpcFailed: false, healedCount: 2 });
assert.equal(rpcSuccess.healed, 2);
assert.equal(rpcSuccess.appRefund, false);
assert.equal(rpcSuccess.error, undefined);

const rpcFailure = staleLoadRpcDecision({ rpcFailed: true, healedCount: 4 });
assert.equal(rpcFailure.healed, 0);
assert.equal(rpcFailure.appRefund, false);
assert.equal(rpcFailure.error, STALE_LOAD_CHECK_FAILED);

assert.equal(classifyProviderOutcome({ success: false, error: "provider timed out" }), "unknown");
let openAfterRpcFailure = { status: "pending", refunds: 0, outcome: "unknown" };
if (rpcFailure.appRefund) {
  openAfterRpcFailure = { status: "failed", refunds: 1, outcome: "confirmed_failure" };
}
assert.equal(openAfterRpcFailure.status, "pending");
assert.equal(openAfterRpcFailure.refunds, 0);
assert.equal(openAfterRpcFailure.outcome, "unknown");
assert.equal(mayRefundLoad({
  outcome: "unknown",
  loadType: "load",
  gameApiDebited: false,
  walletRefunded: false,
}), false);
assert.equal(mayRefundLoad({
  outcome: "confirmed_failure",
  loadType: "load",
  gameApiDebited: false,
  walletRefunded: false,
}), true);

const adminAction = readFileSync(new URL("../src/lib/actions/game-loads.ts", import.meta.url), "utf8");
const healFn = adminAction.slice(
  adminAction.indexOf("export async function healStaleGameLoads"),
  adminAction.indexOf("export async function cancelMyGameLoad")
);
assert.match(healFn, /fail_my_stale_game_load/);
assert.match(healFn, /staleLoadRpcDecision/);
assert.equal(healFn.includes("finishGameLoad"), false);
assert.match(adminAction, /finishGameLoad\(\{/);
const adminFn = adminAction.slice(adminAction.indexOf("export async function adminUpdateGameLoadStatus"));
assert.match(adminFn, /adminFinancialStatusDecision/);
assert.equal(adminFn.includes("finishGameLoad"), false);
assert.equal(adminFn.includes("cancel_game_load_service"), false);
assert.match(adminAction, /holdUnknownGameLoad/);
assert.match(adminAction, /finishGameLoad\(\{/);

const panel = readFileSync(new URL("../src/components/admin/admin-wallet-loads-sidebar-panel.tsx", import.meta.url), "utf8");
assert.match(panel, /Account creation/);
assert.match(panel, /Game account creation/);

assert.equal(confirmedCheckBalance(0), 0);
assert.equal(confirmedCheckBalance(12.5), 12.5);
assert.equal(confirmedCheckBalance(undefined), null);
assert.equal(confirmedCheckBalance(null), null);
assert.equal(confirmedCheckBalance(Number.NaN), null);
assert.match(adminAction, /confirmedCheckBalance\(result\.redeemedAmount\)/);
assert.equal(adminAction.includes('loadType === "check_balance" ? input.amount'), false);

const services = [
  "../src/lib/game-automation/cashfrenzy-service.ts",
  "../src/lib/game-automation/cashmachine-service.ts",
  "../src/lib/game-automation/gameroom-service.ts",
  "../src/lib/game-automation/mrallinone-service.ts",
].map((file) => readFileSync(new URL(file, import.meta.url), "utf8"));
for (const source of services) {
  assert.equal(source.includes('"123456"'), false);
  assert.match(source, /A game password is required/);
}
const ready = readFileSync(new URL("../src/lib/game-automation/provider-ready.ts", import.meta.url), "utf8");
assert.match(ready, /panda-master|default:\s*\n\s*return false/);
assert.equal(ready.includes('case "panda-master"'), false);
const landing = readFileSync(new URL("../src/components/games/game-landing-client.tsx", import.meta.url), "utf8");
assert.match(landing, /Not connected yet/);

console.log("game load outcome checks passed");
