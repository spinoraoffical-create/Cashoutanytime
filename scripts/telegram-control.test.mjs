import assert from "node:assert/strict";

import {
  alertText,
  botForCategory,
  classifyTelegramResponse,
  customerCommandAllowed,
  customerWalletText,
  duplicateJobDecision,
  incidentFingerprint,
  incidentShouldSend,
  linkConsumeDecision,
  nextAttemptDecision,
  ownerCommandAllowed,
  parseCommand,
  paymentClaim,
  paymentTitle,
  reportWindow,
  secretsMatch,
  summarizeMoney,
} from "../src/lib/telegram/control/rules.ts";

assert.equal(botForCategory("deposit_credited"), "payments");
assert.equal(botForCategory("signup"), "players");
assert.equal(botForCategory("load_unknown"), "errors");
assert.equal(botForCategory("webhook_rejected"), "errors");
assert.equal(botForCategory("payout_provider_paid"), "payments");

assert.equal(paymentClaim({ category: "payout_provider_paid", source: "admin" }), "admin_record");
assert.equal(paymentTitle("payout_provider_paid", "admin_record"), "Admin record only");
assert.equal(paymentClaim({ category: "payout_submitted", source: "provider" }), "requested");
assert.equal(paymentClaim({ category: "deposit_credited", source: "ledger" }), "wallet_recorded");
assert.equal(paymentClaim({ category: "refund_unknown", source: "provider" }), "unknown");

const text = alertText({
  category: "payout_provider_paid",
  source: "admin",
  reference: "wd_1",
  amount: 10,
  siteUrl: "https://www.sweeptakehub.com",
  adminPath: "/admin/payouts",
});
assert.equal(text.includes("not a provider confirmation"), true);
assert.equal(text.includes("Provider marked the cash-out paid"), false);

assert.equal(classifyTelegramResponse({ httpStatus: 200, ok: true }).outcome, "accepted");
assert.equal(classifyTelegramResponse({ httpStatus: 429 }).outcome, "retry");
assert.equal(classifyTelegramResponse({ httpStatus: 500 }).outcome, "retry");
assert.equal(classifyTelegramResponse({ httpStatus: 403, ok: false }).outcome, "failed");
assert.equal(classifyTelegramResponse({ thrown: true }).outcome, "uncertain");

const retry = nextAttemptDecision({ attempts: 1, outcome: "retry", retryAfterSeconds: 20, nowMs: 1_000 });
assert.equal(retry.status, "retry_pending");
assert.equal(nextAttemptDecision({ attempts: 5, outcome: "retry", retryAfterSeconds: 10, nowMs: 1_000 }).status, "failed");
assert.equal(nextAttemptDecision({ attempts: 1, outcome: "uncertain", retryAfterSeconds: null, nowMs: 1_000 }).status, "uncertain");

assert.equal(duplicateJobDecision(null), "create");
assert.equal(duplicateJobDecision({ status: "accepted" }), "skip");
assert.equal(duplicateJobDecision({ status: "failed" }), "skip");

assert.equal(secretsMatch("abc", "abc"), true);
assert.equal(secretsMatch("abc", "abd"), false);
assert.equal(secretsMatch("abc", "abcd"), false);
assert.equal(secretsMatch("", "abc"), false);

assert.equal(linkConsumeDecision({ found: false, expiresAtMs: 10, consumed: false, nowMs: 1 }), "missing");
assert.equal(linkConsumeDecision({ found: true, expiresAtMs: 10, consumed: true, nowMs: 1 }), "used");
assert.equal(linkConsumeDecision({ found: true, expiresAtMs: 5, consumed: false, nowMs: 10 }), "expired");
assert.equal(linkConsumeDecision({ found: true, expiresAtMs: 20, consumed: false, nowMs: 10 }), "ready");

const owner = { linked: true, purpose: "owner", isSuperAdmin: true, userId: "owner-1" };
assert.equal(ownerCommandAllowed(owner), true);
assert.equal(ownerCommandAllowed({ ...owner, isSuperAdmin: false }), false);
assert.equal(ownerCommandAllowed({ ...owner, purpose: "customer" }), false);
assert.equal(ownerCommandAllowed({ ...owner, linked: false }), false);

assert.equal(customerCommandAllowed({ linked: true, purpose: "customer", isSuperAdmin: false, userId: "p1" }, "p1"), true);
assert.equal(customerCommandAllowed({ linked: true, purpose: "customer", isSuperAdmin: false, userId: "p1" }, "p2"), false);
assert.equal(customerCommandAllowed({ linked: true, purpose: "owner", isSuperAdmin: true, userId: "p1" }, "p1"), false);

assert.equal(parseCommand("/today")?.name, "today");
assert.equal(parseCommand("/wallet@SupportBot extra")?.name, "wallet");
assert.equal(parseCommand("hello"), null);

assert.equal(incidentFingerprint("load", "timeout user 11111111-1111-1111-1111-111111111111"), incidentFingerprint("load", "timeout user 22222222-2222-2222-2222-222222222222"));
assert.equal(incidentShouldSend({ severity: "ERROR", lastSentMs: 0, nowMs: 10 * 60 * 1000 }), false);
assert.equal(incidentShouldSend({ severity: "ERROR", lastSentMs: 0, nowMs: 31 * 60 * 1000 }), true);
assert.equal(incidentShouldSend({ severity: "CRITICAL", lastSentMs: null, nowMs: 1 }), true);

const window = reportWindow(Date.parse("2026-10-19T18:00:00.000Z"), "today", "America/New_York");
assert.equal(window.timeZone, "America/New_York");
const rows = [
  { status: "paid", amount: 10, at: window.startIso },
  { status: "submitted", amount: 4, at: window.startIso },
  { status: "failed", amount: 2, at: window.startIso },
];
const summary = summarizeMoney(rows, window.startIso, window.endIso);
assert.equal(summary.state, "ready");
if (summary.state === "ready") {
  assert.equal(summary.confirmed, 10);
  assert.equal(summary.pending, 4);
  assert.equal(summary.failed, 2);
}
assert.equal(summarizeMoney(null, window.startIso, window.endIso).state, "unavailable");

assert.equal(customerWalletText({ linked: false, balance: 5 }).includes("not linked"), true);
assert.equal(customerWalletText({ linked: true, balance: 12.5 }).includes("$12.50"), true);
assert.equal(customerWalletText({ linked: true, balance: 12.5 }).includes("cannot deposit"), true);

console.log("telegram-control.test.mjs passed");
