import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ALERT_TEST_BODY,
  alertTestAccess,
  alertTestCompletion,
  alertTestDuplicateDecision,
  alertTestIsQueueEligible,
  alertTestTarget,
  alertTestVisibleStatus,
  alertText,
  botForCategory,
  classifyTelegramResponse,
  contactDisclosure,
  customerCommandAllowed,
  deliveryCheckAccess,
  deliveryCheckDuplicateDecision,
  deliveryCheckLeavesExistingJob,
  deliveryCheckScheduleDecision,
  customerWalletText,
  deliveryLatencyMs,
  deliveryPanelState,
  deliveryStatusAccess,
  duplicateJobDecision,
  enqueueDisposition,
  formatDeliveryLatency,
  formatRegisteredAt,
  incidentFingerprint,
  keepBusinessResult,
  keptPromptTask,
  maskEmail,
  maskPhone,
  promptClaimAllowed,
  promptLifecycleDecision,
  promptScheduleDecision,
  visibleDeliverySummary,
  incidentShouldSend,
  linkConsumeDecision,
  nextAttemptDecision,
  ownerCommandAllowed,
  parseCommand,
  paymentClaim,
  paymentTitle,
  PLAYERS_DELIVERY_CHECK_BODY,
  PLAYERS_DELIVERY_CHECK_EVENT,
  reportWindow,
  secretsMatch,
  signupAlertText,
  summarizeDelivery,
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

const {
  TELEGRAM_NETWORK_TIMEOUT_MS,
  SENDING_STALE_MS,
  WEBHOOK_PROCESS_ATTEMPTS,
  adminCashoutEventKey,
  countReport,
  TELEGRAM_DELIVERY_CRON,
  cashoutAlertPlan,
  fallbackAfterEnqueue,
  investigationEventKey,
  isDailyCron,
  isolatedTelegramTarget,
  legacyOutcomeFromSend,
  sanitizeSecurityAlert,
  webhookRecoveryDecision,
  formatOwnerCount,
  formatOwnerMoney,
  groupCommandRefusal,
  incidentSeverity,
  isPrivateTelegramChat,
  linkRedeemPlan,
  moneyAggregateReport,
  providerAlertCategory,
  staleSendingDecision,
  webhookReplayDecision,
  workerSummary,
} = await import("../src/lib/telegram/control/rules.ts");

assert.equal(TELEGRAM_NETWORK_TIMEOUT_MS > 0 && TELEGRAM_NETWORK_TIMEOUT_MS < SENDING_STALE_MS, true);
assert.equal(classifyTelegramResponse({ thrown: true }).outcome, "uncertain");
assert.equal(nextAttemptDecision({ attempts: 1, outcome: "uncertain", retryAfterSeconds: null, nowMs: 1_000 }).status, "uncertain");

assert.deepEqual(enqueueDisposition({ existingStatus: null, configured: false }), { action: "insert_unconfigured", legacy: true });
assert.deepEqual(enqueueDisposition({ existingStatus: null, configured: true }), { action: "insert_queued", legacy: false });
assert.deepEqual(enqueueDisposition({ existingStatus: "queued", configured: true }), { action: "owned", legacy: false });
assert.deepEqual(enqueueDisposition({ existingStatus: "sending", configured: true }), { action: "owned", legacy: false });
assert.deepEqual(enqueueDisposition({ existingStatus: "unconfigured", configured: false }), { action: "owned", legacy: false });
assert.deepEqual(enqueueDisposition({ existingStatus: "unconfigured", configured: true, legacyOutcome: "accepted" }), { action: "owned", legacy: false });
assert.deepEqual(enqueueDisposition({ existingStatus: "unconfigured", configured: true, legacyOutcome: "uncertain" }), { action: "owned", legacy: false });
assert.deepEqual(enqueueDisposition({ existingStatus: "unconfigured", configured: true, legacyOutcome: "attempt_started" }), { action: "owned", legacy: false });
assert.deepEqual(enqueueDisposition({ existingStatus: "unconfigured", configured: true, legacyOutcome: "unavailable" }), { action: "promote", legacy: false });
assert.deepEqual(enqueueDisposition({ existingStatus: "needs_investigation", configured: true, legacyOutcome: "unavailable" }), { action: "owned", legacy: false });
assert.equal(fallbackAfterEnqueue({ persisted: false, legacy: true }), "legacy");
assert.equal(fallbackAfterEnqueue({ persisted: true, legacy: true }), "legacy");
assert.equal(fallbackAfterEnqueue({ persisted: true, legacy: false }), "handled");
assert.equal(duplicateJobDecision({ status: "unconfigured", legacyOutcome: "unavailable" }, true), "promote");
assert.equal(duplicateJobDecision({ status: "unconfigured", legacyOutcome: "accepted" }, true), "skip");
assert.equal(duplicateJobDecision({ status: "accepted" }, true), "skip");

assert.equal(staleSendingDecision(0, SENDING_STALE_MS), "uncertain");
assert.equal(staleSendingDecision(0, SENDING_STALE_MS - 1), "leave");
assert.equal(nextAttemptDecision({ attempts: 1, outcome: "uncertain", retryAfterSeconds: 30, nowMs: 1_000 }).nextAttemptAt, null);

assert.equal(isPrivateTelegramChat("private"), true);
assert.equal(isPrivateTelegramChat("group"), false);
assert.equal(isPrivateTelegramChat("supergroup"), false);
assert.equal(isPrivateTelegramChat(undefined), false);
assert.equal(groupCommandRefusal().includes("private chat"), true);

assert.equal(webhookReplayDecision({ status: null, attempts: 0 }), "start");
assert.equal(webhookReplayDecision({ status: "received", attempts: 1 }), "retry");
assert.equal(webhookReplayDecision({ status: "failed", attempts: 2 }), "retry");
assert.equal(webhookReplayDecision({ status: "processed", attempts: 1 }), "duplicate");
assert.equal(webhookReplayDecision({ status: "failed", attempts: WEBHOOK_PROCESS_ATTEMPTS }), "stopped");

assert.equal(countReport(null, false).state, "unavailable");
assert.equal(countReport(0, false).state, "ready");
assert.equal(formatOwnerCount("Open tickets", null).includes("unavailable"), true);
assert.equal(formatOwnerCount("Open tickets", 0).includes("unavailable"), false);
assert.equal(formatOwnerCount("Open tickets", 0).includes("0"), true);
const partial = moneyAggregateReport({
  ok: true,
  confirmed: 10,
  confirmedCount: 1,
  pending: null,
  pendingCount: 1,
  failed: 0,
  failedCount: 0,
});
assert.equal(partial.state, "unavailable");
assert.equal(
  formatOwnerMoney("Deposits", {
    complete: true,
    confirmed: 10,
    confirmedCount: 1,
    pending: 4,
    pendingCount: 1,
    failed: 0,
    failedCount: 0,
    failedKnown: false,
  }).includes("failed"),
  false
);
assert.equal(
  formatOwnerMoney("Cash-outs", {
    complete: true,
    confirmed: 3,
    confirmedCount: 1,
    pending: 0,
    pendingCount: 0,
    failed: 2,
    failedCount: 1,
    failedKnown: true,
  }).includes("failed $2.00"),
  true
);
assert.equal(formatOwnerMoney("Deposits", null), "Deposits: unavailable");

assert.equal(adminCashoutEventKey(null), null);
assert.equal(adminCashoutEventKey(String(Date.now())), null);
assert.equal(adminCashoutEventKey("11111111-1111-1111-1111-111111111111"), "admin-cashout:11111111-1111-1111-1111-111111111111");

const ownerLink = { found: true, expired: false, consumed: false, replaced: false, purpose: "owner", expected: "owner", isSuperAdmin: false, privateChat: true, saveFailed: false };
assert.equal(linkRedeemPlan(ownerLink).consume, false);
assert.equal(linkRedeemPlan({ ...ownerLink, isSuperAdmin: true, saveFailed: true }).consume, false);
assert.equal(linkRedeemPlan({ ...ownerLink, isSuperAdmin: true, privateChat: false }).consume, false);
assert.equal(linkRedeemPlan({ ...ownerLink, isSuperAdmin: true }).consume, true);
assert.equal(linkRedeemPlan({ ...ownerLink, purpose: "customer", expected: "customer", isSuperAdmin: false }).consume, true);

assert.equal(providerAlertCategory("ECONNREFUSED", "unknown"), "provider_down");
assert.equal(providerAlertCategory("outcome unknown", "unknown"), "load_unknown");
assert.equal(providerAlertCategory("rejected", "failed"), "load_failed");
assert.equal(incidentSeverity("rate-limit"), "WARNING");
assert.equal(incidentSeverity("game-load"), "ERROR");

const worker = workerSummary({ attempted: 2, accepted: 1, failed: 0, uncertain: 1, retryPending: 0, recovered: 1, promoted: 3 });
assert.equal(worker.processed, 2);
assert.equal(worker.processed === 8, false);
assert.equal(worker.recovered, 1);
assert.equal(worker.promoted, 3);

assert.equal(legacyOutcomeFromSend({ configured: true, ok: true, thrown: false }), "accepted");
assert.equal(legacyOutcomeFromSend({ configured: true, ok: null, thrown: true }), "uncertain");
assert.equal(legacyOutcomeFromSend({ configured: false, ok: null, thrown: false }), "unavailable");
assert.equal(legacyOutcomeFromSend({ configured: true, ok: false, thrown: false }), "unavailable");
assert.equal(cashoutAlertPlan(null).kind, "investigate");
assert.equal(cashoutAlertPlan("not-a-row").kind, "investigate");
assert.equal(cashoutAlertPlan("11111111-1111-1111-1111-111111111111").kind, "event");
const investigation = investigationEventKey("22222222-2222-2222-2222-222222222222");
assert.equal(investigation, "investigate:22222222-2222-2222-2222-222222222222");
assert.equal(investigation?.startsWith("admin-cashout:"), false);

const leaked = sanitizeSecurityAlert({
  area: "kyc",
  code: "inc_abc1234",
  outcome: "failed",
  message: "upload failed bearer sk_live_secret user@example.com 4111111111111111",
});
assert.equal(leaked.text.includes("bearer"), false);
assert.equal(leaked.text.includes("sk_live"), false);
assert.equal(leaked.text.includes("@"), false);
assert.equal(leaked.text.includes("4111"), false);
assert.equal(leaked.text.includes("Area: kyc"), true);
assert.equal(leaked.text.includes("inc_abc1234"), true);
assert.equal(sanitizeSecurityAlert({ area: "passport-scan", code: "raw error", message: "token=abc" }).text.includes("token"), false);
assert.equal(sanitizeSecurityAlert({ area: "passport-scan" }).area, "app");

assert.equal(webhookReplayDecision({ status: "exhausted", attempts: 5 }), "stopped");
assert.equal(webhookReplayDecision({ status: "reviewed", attempts: 1 }), "duplicate");
assert.equal(webhookRecoveryDecision({ status: "exhausted", action: "reopen" }), "reopen");
assert.equal(webhookRecoveryDecision({ status: "exhausted", action: "dismiss" }), "dismiss");
assert.equal(webhookRecoveryDecision({ status: "processed", action: "reopen" }), "refuse");
assert.equal(webhookRecoveryDecision({ status: "failed", action: "dismiss" }), "refuse");

assert.equal(isDailyCron(TELEGRAM_DELIVERY_CRON), true);
assert.equal(isDailyCron("15 * * * *"), false);
assert.equal(isDailyCron("* * * * *"), false);
assert.equal(isolatedTelegramTarget("https://zecitlewsynyioemsqna.supabase.co"), "production");
assert.equal(isolatedTelegramTarget("https://www.sweeptakehub.com"), "production");
assert.equal(isolatedTelegramTarget("http://127.0.0.1:54321"), "isolated");
assert.equal(isolatedTelegramTarget(""), "missing");

assert.equal(alertTestAccess({ isSuperAdmin: false, bot: "payments" }).ok, false);
assert.equal(alertTestAccess({ isSuperAdmin: true, bot: "owner" }).ok, false);
assert.equal(alertTestAccess({ isSuperAdmin: true, bot: "support" }).ok, false);
assert.equal(alertTestAccess({ isSuperAdmin: true, bot: "payments" }).ok, true);

const targets = ["payments", "players", "errors"].map((bot) => alertTestTarget(bot));
assert.equal(new Set(targets.map((item) => item.eventKey)).size, 3);
for (const target of targets) {
  assert.equal(target.body, ALERT_TEST_BODY);
  assert.equal(target.category, "control_test");
  assert.equal(target.eventKey, `bot-test:${target.bot}`);
  assert.equal(target.bot === "owner" || target.bot === "support", false);
  assert.equal(alertTestIsQueueEligible("sending"), false);
}
assert.equal(targets[0].eventKey.includes("players"), false);
assert.equal(targets[1].eventKey.includes("payments"), false);

for (const status of ["sending", "queued", "accepted", "failed", "uncertain", "retry_pending"]) {
  assert.equal(alertTestDuplicateDecision({ status }), "keep");
}
assert.equal(alertTestDuplicateDecision(null), "create");
assert.equal(alertTestVisibleStatus("accepted"), "accepted");
assert.equal(alertTestVisibleStatus("sending"), null);

const refused = alertTestCompletion({ httpStatus: 429, ok: false, description: "Too Many Requests bot123:ABCDEFsecretvalue" });
assert.equal(refused.status, "failed");
assert.equal(refused.nextAttemptAt, null);
assert.equal(alertTestIsQueueEligible(refused.status), false);
assert.equal(refused.error.includes("bot123:"), false);
const accepted = alertTestCompletion({ httpStatus: 200, ok: true });
assert.equal(accepted.status, "accepted");
assert.equal(accepted.nextAttemptAt, null);
assert.equal(alertTestCompletion({ thrown: true }).status, "uncertain");
assert.equal(alertTestCompletion({ httpStatus: 400, ok: false, description: "chat not found" }).status, "failed");

const firstDeposit = enqueueDisposition({ existingStatus: null, configured: true });
assert.equal(firstDeposit.action, "insert_queued");
const sameDeposit = enqueueDisposition({ existingStatus: "queued", configured: true });
assert.equal(sameDeposit.action, "owned");
const scheduled = promptScheduleDecision({ inserted: true, status: "queued", jobId: "job-1" });
assert.equal(scheduled.schedule, true);
assert.equal(scheduled.jobId, "job-1");
assert.equal(promptScheduleDecision({ inserted: false, status: "queued", jobId: "job-1" }).schedule, false);
assert.equal(promptScheduleDecision({ inserted: true, status: "unconfigured", jobId: "job-1" }).schedule, false);
assert.equal(promptScheduleDecision({ inserted: true, status: "queued", jobId: null }).schedule, false);
assert.equal(alertTestIsQueueEligible("queued"), true);

assert.equal(promptClaimAllowed("queued"), true);
assert.equal(promptClaimAllowed("retry_pending"), true);
assert.equal(promptClaimAllowed("sending"), false);
assert.equal(promptClaimAllowed("accepted"), false);
assert.equal(promptClaimAllowed("uncertain"), false);
const raced = ["queued", "sending"].filter(promptClaimAllowed);
assert.equal(raced.length, 1);

assert.equal(classifyTelegramResponse({ httpStatus: 429 }).outcome, "retry");
assert.equal(classifyTelegramResponse({ httpStatus: 500 }).outcome, "retry");
assert.equal(classifyTelegramResponse({ thrown: true }).outcome, "uncertain");
assert.equal(nextAttemptDecision({ attempts: 1, outcome: "retry", retryAfterSeconds: 30, nowMs: 1_000 }).status, "retry_pending");
assert.equal(nextAttemptDecision({ attempts: 1, outcome: "uncertain", retryAfterSeconds: null, nowMs: 1_000 }).nextAttemptAt, null);
assert.equal(nextAttemptDecision({ attempts: 1, outcome: "failed", retryAfterSeconds: null, nowMs: 1_000 }).status, "failed");

const credited = { ok: true, depositId: "dep_1" };
assert.equal(keepBusinessResult(credited).ok, true);
assert.equal(keepBusinessResult(credited).depositId, "dep_1");

assert.equal(deliveryStatusAccess(false), false);
assert.equal(visibleDeliverySummary(false, []), null);
assert.equal(deliveryPanelState({ queryFailed: false, isSuperAdmin: false, rows: [] }).kind, "hidden");
assert.equal(deliveryPanelState({ queryFailed: true, isSuperAdmin: true, rows: [] }).kind, "unavailable");
const emptyPanel = deliveryPanelState({ queryFailed: false, isSuperAdmin: true, rows: [] });
assert.equal(emptyPanel.kind, "ready");
if (emptyPanel.kind === "ready") {
  assert.equal(emptyPanel.summary.counts.queued, 0);
  assert.equal(emptyPanel.summary.counts.sending, 0);
  assert.equal(emptyPanel.summary.counts.accepted, 0);
  assert.equal(emptyPanel.summary.counts.failed, 0);
  assert.equal(emptyPanel.summary.counts.uncertain, 0);
  assert.equal(emptyPanel.summary.lastSuccess, null);
  assert.equal(emptyPanel.summary.problems.length, 0);
}
const panel = visibleDeliverySummary(true, [
  { status: "accepted", bot: "payments", category: "deposit_credited", createdAt: "2026-10-20T03:00:00.000Z", updatedAt: "2026-10-20T03:00:02.000Z", lastError: null },
  { status: "failed", bot: "errors", category: "load_failed", createdAt: "2026-10-20T03:00:00.000Z", updatedAt: "2026-10-20T03:00:04.000Z", lastError: "bot999:SECRETVALUE chat not found" },
  { status: "queued", bot: "players", category: "signup", createdAt: "2026-10-20T03:01:00.000Z", updatedAt: "2026-10-20T03:01:00.000Z", lastError: null },
]);
assert.equal(panel?.counts.accepted, 1);
assert.equal(panel?.counts.failed, 1);
assert.equal(panel?.counts.queued, 1);
assert.equal(summarizeDelivery([{ status: "retry_pending", bot: "payments", category: "deposit_credited", createdAt: "2026-10-20T03:00:00.000Z", updatedAt: "2026-10-20T03:00:00.000Z", lastError: null }]).counts.queued, 1);
assert.equal(panel?.counts.sending, 0);
assert.equal(panel?.counts.uncertain, 0);
assert.equal(panel?.lastSuccess?.bot, "payments");
assert.equal(panel?.lastSuccess?.latencyMs, 2000);
assert.equal(formatDeliveryLatency(2000), "2 s");
assert.equal(deliveryLatencyMs("bad", "bad"), null);
assert.equal(panel?.problems[0]?.error?.includes("SECRETVALUE"), false);
assert.equal(panel?.problems[0]?.error?.includes("chat not found"), true);
assert.equal(promptLifecycleDecision({ actionStillRunning: false, jobId: "signup-job" }), "leave_queued");
assert.equal(promptLifecycleDecision({ actionStillRunning: true, jobId: null }), "leave_queued");
assert.equal(promptLifecycleDecision({ actionStillRunning: true, jobId: "signup-job" }), "register");
assert.equal(alertTestIsQueueEligible("queued"), true);

const signupSource = readFileSync(new URL("../src/lib/actions/auth.ts", import.meta.url), "utf8");
const signupStart = signupSource.indexOf("export async function finalizeRegistrationAfterSignUp");
const signupEnd = signupSource.indexOf("export async function saveUserContactInfo");
const signupFn = signupSource.slice(signupStart, signupEnd);
assert.equal(signupFn.includes("void import("), false);
assert.equal(signupFn.includes("await safePaymentAlert("), true);
assert.equal(signupFn.indexOf("await safePaymentAlert(") < signupFn.lastIndexOf("return { ok: true }"), true);

const fullSignup = signupAlertText({
  displayName: "Alex Rivera",
  playerId: "player-1",
  email: "alex.rivera@example.com",
  phone: "+1 202 555 0148",
  emailVerified: false,
  phoneVerified: false,
  registeredAt: "2026-10-20T04:55:00.000Z",
  accountStatus: "Active",
  source: "email",
  disclosure: "full",
  adminUrl: "https://www.sweeptakehub.com/admin/users",
});
assert.equal(fullSignup.includes("Alex Rivera"), true);
assert.equal(fullSignup.includes("alex.rivera@example.com"), true);
assert.equal(fullSignup.includes("+1 202 555 0148"), true);
assert.equal(fullSignup.includes("Email verification: Unverified"), true);
assert.equal(fullSignup.includes("Phone verification: Unverified"), true);
assert.equal(fullSignup.includes(formatRegisteredAt("2026-10-20T04:55:00.000Z")), true);
assert.equal(fullSignup.includes("Account status: Active"), true);
assert.equal(fullSignup.includes("Source: email"), true);

const noPhone = signupAlertText({
  displayName: "Alex Rivera",
  playerId: "player-1",
  email: "alex.rivera@example.com",
  phone: null,
  emailVerified: false,
  phoneVerified: null,
  registeredAt: "2026-10-20T04:55:00.000Z",
  accountStatus: "Active",
  source: "email",
  disclosure: "full",
});
assert.equal(noPhone.includes("Phone: Not provided"), true);
assert.equal(noPhone.includes("Phone verification: Unknown"), true);

const missing = signupAlertText({
  displayName: null,
  playerId: "player-2",
  email: null,
  phone: " ",
  emailVerified: null,
  phoneVerified: null,
  registeredAt: null,
  accountStatus: null,
  source: null,
  disclosure: "full",
});
assert.equal(missing.includes("Name: Not provided"), true);
assert.equal(missing.includes("Email: Not provided"), true);
assert.equal(missing.includes("Registered: Unknown"), true);
assert.equal(missing.includes("Account status: Unknown"), true);
assert.equal(missing.includes("Source: Not provided"), true);

const injected = signupAlertText({
  displayName: "<b>@admin</b> & co",
  playerId: "player<script>",
  email: "a<b>@example.com",
  phone: "+1 <script>",
  emailVerified: true,
  phoneVerified: null,
  registeredAt: "not-a-date",
  accountStatus: "Active <i>",
  source: "email\n<b>hack</b>",
  disclosure: "full",
});
assert.equal(injected.includes("<b>@admin</b>"), false);
assert.equal(injected.includes("&lt;b&gt;@admin&lt;/b&gt;"), true);
assert.equal(injected.includes("Registered: Unknown"), true);
assert.equal(maskEmail("alex.rivera@example.com"), "a***@example.com");
assert.equal(maskPhone("+1 202 555 0148").endsWith("0148"), true);
assert.equal(maskPhone("+1 202 555 0148").includes("202"), false);

const masked = signupAlertText({
  displayName: "Alex Rivera",
  playerId: "player-1",
  email: "alex.rivera@example.com",
  phone: "+12025550148",
  emailVerified: false,
  phoneVerified: null,
  registeredAt: "2026-10-20T04:55:00.000Z",
  accountStatus: "Active",
  source: "email",
  disclosure: "masked",
});
assert.equal(masked.includes("alex.rivera@example.com"), false);
assert.equal(masked.includes("a***@example.com"), true);
assert.equal(masked.includes("12025550148"), false);
assert.equal(masked.includes("***0148"), true);
assert.equal(contactDisclosure({ destinationChatId: "100", ownerPrivateChatId: "100" }), "full");
assert.equal(contactDisclosure({ destinationChatId: "-100123", ownerPrivateChatId: "100" }), "masked");
assert.equal(contactDisclosure({ destinationChatId: "200", ownerPrivateChatId: "100" }), "masked");
assert.equal(contactDisclosure({ destinationChatId: "100", ownerPrivateChatId: null }), "masked");

assert.equal(classifyTelegramResponse({ httpStatus: 200, ok: true }).outcome, "accepted");
assert.equal(classifyTelegramResponse({ thrown: true }).outcome, "uncertain");
assert.equal(nextAttemptDecision({ attempts: 1, outcome: "uncertain", retryAfterSeconds: null, nowMs: 1_000 }).nextAttemptAt, null);
assert.equal(nextAttemptDecision({ attempts: 1, outcome: "retry", retryAfterSeconds: 30, nowMs: 1_000 }).status, "retry_pending");
assert.equal(classifyTelegramResponse({ httpStatus: 429 }).outcome, "retry");
assert.equal(classifyTelegramResponse({ httpStatus: 500 }).outcome, "retry");
assert.equal(enqueueDisposition({ existingStatus: "queued", configured: true }).action, "owned");
assert.equal(promptClaimAllowed("sending"), false);
assert.equal(promptScheduleDecision({ inserted: true, status: "queued", jobId: "job-9" }).jobId, "job-9");

let promptFinished = false;
const promptTask = keptPromptTask(async () => {
  await Promise.resolve();
  promptFinished = true;
});
const running = promptTask();
assert.equal(promptFinished, false);
await running;
assert.equal(promptFinished, true);
const deliverySource = readFileSync(new URL("../src/lib/telegram/control/delivery.ts", import.meta.url), "utf8");
const scheduleStart = deliverySource.indexOf("function schedulePromptDelivery");
const scheduleFn = deliverySource.slice(scheduleStart, deliverySource.indexOf("async function signupBody"));
assert.equal(scheduleFn.includes("void deliverQueuedJobById"), false);
assert.equal(scheduleFn.includes("keptPromptTask"), true);

const registration = keepBusinessResult({ ok: true, userId: "player-1" });
assert.equal(registration.ok, true);
assert.equal(paymentTitle("deposit_credited", "wallet_recorded"), "Wallet credit recorded");
assert.equal(botForCategory("signup"), "players");
assert.equal(botForCategory("deposit_credited"), "payments");
assert.equal(botForCategory("load_failed"), "errors");

assert.equal(deliveryCheckAccess(false).ok, false);
assert.equal(deliveryCheckAccess(true).ok, true);
assert.equal(contactDisclosure({ destinationChatId: "100", ownerPrivateChatId: "100" }), "full");
assert.equal(contactDisclosure({ destinationChatId: "-100123", ownerPrivateChatId: "100" }), "masked");
assert.equal(contactDisclosure({ destinationChatId: "200", ownerPrivateChatId: "100" }), "masked");
assert.equal(deliveryCheckDuplicateDecision(null), "create");
assert.equal(deliveryCheckDuplicateDecision({ status: "queued" }), "keep");
assert.equal(deliveryCheckDuplicateDecision({ status: "accepted" }), "keep");
assert.equal(deliveryCheckScheduleDecision({
  inserted: true,
  status: "queued",
  jobId: "check-1",
  eventKey: PLAYERS_DELIVERY_CHECK_EVENT,
}).jobId, "check-1");
assert.equal(deliveryCheckScheduleDecision({
  inserted: true,
  status: "queued",
  jobId: "signup-queued",
  eventKey: "signup:existing-queued",
}).schedule, false);
assert.equal(deliveryCheckScheduleDecision({
  inserted: true,
  status: "uncertain",
  jobId: "signup-uncertain",
  eventKey: "signup:existing-uncertain",
}).schedule, false);
assert.equal(deliveryCheckLeavesExistingJob("signup:existing-queued"), true);
assert.equal(deliveryCheckLeavesExistingJob("signup:existing-uncertain"), true);
assert.equal(deliveryCheckLeavesExistingJob(PLAYERS_DELIVERY_CHECK_EVENT), false);
assert.equal(PLAYERS_DELIVERY_CHECK_BODY, "Players delivery check. This is not a signup and contains no player information.");
assert.equal(classifyTelegramResponse({ httpStatus: 200, ok: true }).outcome, "accepted");
assert.equal(nextAttemptDecision({ attempts: 1, outcome: "accepted", retryAfterSeconds: null, nowMs: 1_000 }).status, "accepted");
assert.equal(classifyTelegramResponse({ thrown: true }).outcome, "uncertain");
assert.equal(nextAttemptDecision({ attempts: 1, outcome: "uncertain", retryAfterSeconds: null, nowMs: 1_000 }).nextAttemptAt, null);
const checkSource = readFileSync(new URL("../src/lib/telegram/control/delivery.ts", import.meta.url), "utf8");
const checkStart = checkSource.indexOf("export async function sendPlayersDeliveryCheck");
const checkFn = checkSource.slice(checkStart, checkSource.indexOf("export async function sendOwnerTest"));
assert.equal(checkFn.includes("schedulePromptDelivery(plan.jobId)"), true);
assert.equal(checkFn.includes("processTelegramDeliveryQueue"), false);
assert.equal(checkFn.includes('status: "queued"'), true);
assert.equal(checkFn.includes("attempt_count: 0"), true);
assert.equal(checkFn.includes("PLAYERS_DELIVERY_CHECK_EVENT"), true);
const actionSource = readFileSync(new URL("../src/lib/actions/admin/telegram-center.ts", import.meta.url), "utf8");
const actionStart = actionSource.indexOf("export async function sendPlayersDeliveryCheckAction");
const actionFn = actionSource.slice(actionStart, actionSource.indexOf("export async function sendTelegramAlertTestAction"));
assert.equal(actionFn.includes("deliveryCheckAccess"), true);
assert.equal(actionFn.includes("processTelegramDeliveryQueue"), false);

assert.equal(ownerCommandAllowed({ linked: true, purpose: "owner", isSuperAdmin: true, userId: "owner-1" }), true);
assert.equal(parseCommand("/help")?.name, "help");
assert.equal(customerCommandAllowed({ linked: true, purpose: "customer", isSuperAdmin: false, userId: "p1" }, "p1"), true);

console.log("telegram-control.test.mjs passed");
