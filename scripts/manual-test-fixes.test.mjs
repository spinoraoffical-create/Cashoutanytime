import assert from "node:assert/strict";

import { parseExplorerQuery, walletMovementCount } from "../src/lib/admin/transaction-explorer.ts";
import { depositMissingCredit, duplicateDescriptions, duplicatePayoutPairs, ownerLoadState, rejectedLoadMissingRefund, uncertainProviderMessage } from "../src/lib/admin/reconciliation-rules.ts";
import { parseAdminTransactionUserId } from "../src/lib/admin/transaction-selection.ts";
import { categorizeAdminTransactionPanel } from "../src/lib/wallet/transaction-display.ts";
import { depositRecordNote, isOnlinePaymentProof } from "../src/lib/payments/deposit-record-display.ts";
import { formatGameAutomationError } from "../src/lib/game-automation/error-formatter.ts";
import {
  displayedLoadError,
  loadRefundNotice,
  mayRefundLoad,
  classifyProviderOutcome,
} from "../src/lib/game-automation/load-outcome.ts";

const playerId = "6ad4858b-1253-4abc-8def-0123456789ab";
assert.equal(parseAdminTransactionUserId(playerId), playerId);
assert.equal(parseAdminTransactionUserId(`  ${playerId}  `), playerId);
assert.equal(parseAdminTransactionUserId([playerId]), playerId);
assert.equal(parseAdminTransactionUserId(""), null);
assert.equal(parseAdminTransactionUserId("not-a-user"), null);
assert.equal(parseAdminTransactionUserId("Select a user above"), null);

const rows = [
  { source: "game_load", wallet_type: "current", transaction_type: "debit" },
  { source: "game_load_refund", wallet_type: "current", transaction_type: "credit" },
  { source: "game_redeem", wallet_type: "cashout", transaction_type: "credit" },
  { source: "deposit", wallet_type: "current", transaction_type: "credit" },
  { source: "withdrawal", wallet_type: "current", transaction_type: "debit" },
  { source: "daily_task", wallet_type: "bonus", transaction_type: "credit" },
];
assert.deepEqual(rows.map((row) => categorizeAdminTransactionPanel(row)), [
  "deposit",
  "deposit",
  "deposit",
  "deposit",
  "deposit",
  "bonus",
]);

assert.equal(isOnlinePaymentProof("paydora/payment"), true);
assert.equal(isOnlinePaymentProof("deposit-proofs/user/file.jpg"), false);
assert.deepEqual(depositRecordNote("Paid online"), { label: "System record", text: "Paid online" });
assert.equal(depositRecordNote("Paid online · order").label, "System record");
assert.deepEqual(depositRecordNote("Player typed this"), { label: "Note", text: "Player typed this" });
assert.equal(depositRecordNote("  "), null);

const providerMessage = formatGameAutomationError({ code: 6, message: "insufficient agent balance" }, 5);
assert.equal(providerMessage.includes("100% refunded"), false);
assert.equal(providerMessage.includes("refunded"), false);
assert.equal(classifyProviderOutcome({ success: false, error: providerMessage }), "confirmed_failure");
assert.equal(mayRefundLoad({
  outcome: "confirmed_failure",
  loadType: "load",
  gameApiDebited: false,
  walletRefunded: false,
}), true);
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
  walletRefunded: true,
}), false);

const storedLie = "GameVault agent balance is insufficient (code 6). Your funds have been 100% refunded to your wallet balance.";
assert.equal(
  displayedLoadError(storedLie, false),
  "GameVault agent balance is insufficient (code 6). The wallet refund is not confirmed."
);
assert.equal(
  displayedLoadError(storedLie, true),
  "GameVault agent balance is insufficient (code 6). The wallet refund is recorded."
);
assert.equal(
  loadRefundNotice({ providerMessage, walletRefunded: false, refundExpected: true }).includes("not confirmed"),
  true
);
assert.equal(
  loadRefundNotice({ providerMessage: "socket hang up", walletRefunded: false, refundExpected: false }),
  "socket hang up"
);

assert.equal(parseExplorerQuery("player43137").kind, "text");
assert.equal(parseExplorerQuery(playerId).kind, "uuid");
assert.equal(walletMovementCount([
  { at: "a", group: "wallet", title: "debit", detail: "", evidence: "wallet_transactions", verified: true },
  { at: "b", group: "request", title: "load", detail: "", evidence: "game_load_requests", verified: false },
]), 1);
assert.equal(rejectedLoadMissingRefund({
  id: "load",
  amount: 5,
  load_type: "load",
  status: "pending",
  wallet_refunded: false,
  game_api_debited: false,
  error_message: "GameVault agent balance is insufficient (code 6). Your funds have been 100% refunded to your wallet balance.",
  created_at: "2026-10-18T10:56:29.000Z",
  game_username: "player43137",
}), true);
assert.equal(rejectedLoadMissingRefund({
  id: "load",
  amount: 5,
  load_type: "load",
  status: "pending",
  wallet_refunded: true,
  game_api_debited: false,
  error_message: "code 6",
  created_at: "2026-10-18T10:56:29.000Z",
  game_username: "player43137",
}), false);
assert.equal(uncertainProviderMessage("Provider connection timed out"), true);
assert.equal(uncertainProviderMessage("code 6 insufficient agent balance"), false);
assert.equal(depositMissingCredit({ webhookStatus: "processed", eventName: "deposit.paid", ledgerCredit: false }), true);
assert.equal(depositMissingCredit({ webhookStatus: "processed", eventName: "deposit.paid", ledgerCredit: true }), false);
const incident = {
  id: "load",
  amount: 5,
  load_type: "load",
  status: "pending",
  wallet_refunded: false,
  game_api_debited: false,
  error_message: "GameVault agent balance is insufficient (code 6). Your funds have been 100% refunded to your wallet balance.",
  created_at: "2026-10-18T10:56:29.000Z",
  game_username: "player43137",
};
assert.equal(ownerLoadState(incident), "Reconciliation required");
assert.equal(ownerLoadState({ ...incident, wallet_refunded: true, error_message: "code 6" }), "Refunded");
assert.equal(duplicateDescriptions([
  { userId: "a", amount: 16.49, description: "Deposit confirmed" },
  { userId: "a", amount: 16.49, description: "Deposit confirmed" },
]).length, 1);
assert.equal(duplicateDescriptions([{ userId: "a", amount: 1, description: "" }]).length, 0);
assert.deepEqual(duplicatePayoutPairs([
  { id: "p1", userId: "a", amount: 20, createdAt: "2026-10-18T01:00:00.000Z", status: "submitted" },
  { id: "p2", userId: "a", amount: 20, createdAt: "2026-10-18T01:00:30.000Z", status: "submitted" },
]), ["p2"]);

console.log("manual test fix checks passed");
