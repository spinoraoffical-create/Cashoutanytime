/** Pure Telegram control rules. No database, no network, no secrets. */

export const TELEGRAM_BOTS = ["payments", "players", "errors", "owner", "support"] as const;
export type TelegramBotKey = (typeof TELEGRAM_BOTS)[number];

export const REPORT_TIMEZONE = "America/New_York";

export const BOT_ENV: Record<TelegramBotKey, { token: string; secret: string; chat: string }> = {
  payments: {
    token: "TELEGRAM_PAYMENTS_BOT_TOKEN",
    secret: "TELEGRAM_PAYMENTS_WEBHOOK_SECRET",
    chat: "TELEGRAM_PAYMENTS_CHAT_ID",
  },
  players: {
    token: "TELEGRAM_PLAYERS_BOT_TOKEN",
    secret: "TELEGRAM_PLAYERS_WEBHOOK_SECRET",
    chat: "TELEGRAM_PLAYERS_CHAT_ID",
  },
  errors: {
    token: "TELEGRAM_ERRORS_BOT_TOKEN",
    secret: "TELEGRAM_ERRORS_WEBHOOK_SECRET",
    chat: "TELEGRAM_ERRORS_CHAT_ID",
  },
  owner: {
    token: "TELEGRAM_OWNER_BOT_TOKEN",
    secret: "TELEGRAM_OWNER_WEBHOOK_SECRET",
    chat: "TELEGRAM_OWNER_CHAT_ID",
  },
  support: {
    token: "TELEGRAM_SUPPORT_BOT_TOKEN",
    secret: "TELEGRAM_SUPPORT_WEBHOOK_SECRET",
    chat: "TELEGRAM_SUPPORT_CHAT_ID",
  },
};

export const LINK_PEPPER_ENV = "TELEGRAM_LINK_PEPPER";

export type AlertCategory =
  | "deposit_requested"
  | "deposit_confirmed"
  | "deposit_failed"
  | "deposit_credited"
  | "payout_requested"
  | "payout_submitted"
  | "payout_provider_paid"
  | "payout_failed"
  | "refund_confirmed"
  | "refund_unknown"
  | "duplicate_financial"
  | "reconciliation"
  | "load_requested"
  | "signup"
  | "email_verified"
  | "phone_verified"
  | "ticket_opened"
  | "ticket_escalated"
  | "account_status"
  | "provider_down"
  | "load_failed"
  | "load_unknown"
  | "refund_mismatch"
  | "webhook_rejected"
  | "payout_provider_error"
  | "database_down"
  | "cron_failed"
  | "telegram_delivery_failed"
  | "unauthorized_admin"
  | "app_error";

const PAYMENT_CATEGORIES = new Set<AlertCategory>([
  "deposit_requested",
  "deposit_confirmed",
  "deposit_failed",
  "deposit_credited",
  "payout_requested",
  "payout_submitted",
  "payout_provider_paid",
  "payout_failed",
  "refund_confirmed",
  "refund_unknown",
  "duplicate_financial",
  "reconciliation",
]);

const PLAYER_CATEGORIES = new Set<AlertCategory>([
  "load_requested",
  "signup",
  "email_verified",
  "phone_verified",
  "ticket_opened",
  "ticket_escalated",
  "account_status",
]);

export function botForCategory(category: AlertCategory): TelegramBotKey {
  if (PAYMENT_CATEGORIES.has(category)) return "payments";
  if (PLAYER_CATEGORIES.has(category)) return "players";
  return "errors";
}

export type DeliveryOutcome = "accepted" | "retry" | "failed" | "uncertain";

export function classifyTelegramResponse(input: {
  httpStatus?: number | null;
  ok?: boolean | null;
  description?: string | null;
  thrown?: boolean;
}): { outcome: DeliveryOutcome; retryAfterSeconds: number | null } {
  if (input.thrown || input.httpStatus == null) {
    return { outcome: "uncertain", retryAfterSeconds: null };
  }
  if (input.httpStatus === 429) {
    return { outcome: "retry", retryAfterSeconds: 30 };
  }
  if (input.httpStatus >= 500) {
    return { outcome: "retry", retryAfterSeconds: 60 };
  }
  if (input.httpStatus >= 400) {
    return { outcome: "failed", retryAfterSeconds: null };
  }
  if (input.ok) return { outcome: "accepted", retryAfterSeconds: null };
  return { outcome: "uncertain", retryAfterSeconds: null };
}

export function parseRetryAfter(header: string | null | undefined): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3600) return null;
  return Math.ceil(seconds);
}

const MAX_ATTEMPTS = 5;

export function nextAttemptDecision(input: {
  attempts: number;
  outcome: DeliveryOutcome;
  retryAfterSeconds: number | null;
  nowMs: number;
}): { status: "accepted" | "failed" | "uncertain" | "retry_pending"; nextAttemptAt: string | null } {
  if (input.outcome === "accepted") return { status: "accepted", nextAttemptAt: null };
  if (input.outcome === "uncertain") return { status: "uncertain", nextAttemptAt: null };
  if (input.outcome === "failed") return { status: "failed", nextAttemptAt: null };
  if (input.attempts >= MAX_ATTEMPTS) return { status: "failed", nextAttemptAt: null };
  const wait = Math.min(3600, Math.max(input.retryAfterSeconds ?? 0, 30 * 2 ** Math.max(0, input.attempts - 1)));
  return { status: "retry_pending", nextAttemptAt: new Date(input.nowMs + wait * 1000).toISOString() };
}

export type DeliveryJobStatus =
  | "queued"
  | "sending"
  | "accepted"
  | "failed"
  | "retry_pending"
  | "uncertain"
  | "unconfigured"
  | "duplicate"
  | "needs_investigation";

export type LegacyOutcome = "not_used" | "attempt_started" | "accepted" | "uncertain" | "unavailable" | "skipped";

/** Hobby cron is once a day. This sweep only recovers leftovers. */
export const TELEGRAM_DELIVERY_CRON = "20 8 * * *";

export const PRODUCTION_TELEGRAM_TARGETS = ["zecitlewsynyioemsqna", "sweeptakehub.com"] as const;

/** Network budget for one Telegram HTTP call. A timeout is an uncertain outcome. */
export const TELEGRAM_NETWORK_TIMEOUT_MS = 8_000;

/** A send claim older than this is marked uncertain and is not sent again. */
export const SENDING_STALE_MS = 120_000;

export const WEBHOOK_PROCESS_ATTEMPTS = 5;

export function duplicateJobDecision(
  existing: { status: string; legacyOutcome?: LegacyOutcome | null } | null,
  configured = false
): "create" | "skip" | "promote" {
  const disposition = enqueueDisposition({
    existingStatus: (existing?.status as DeliveryJobStatus | undefined) ?? null,
    configured,
    legacyOutcome: existing?.legacyOutcome ?? null,
  });
  if (disposition.action === "insert_queued" || disposition.action === "insert_unconfigured") return "create";
  if (disposition.action === "promote") return "promote";
  return "skip";
}

/**
 * Promote an unconfigured job only when the legacy sender is known not to have sent it.
 * accepted and uncertain stay put. attempt_started stays put until the outcome is recorded.
 */
export function enqueueDisposition(input: {
  existingStatus: DeliveryJobStatus | null;
  configured: boolean;
  legacyOutcome?: LegacyOutcome | null;
}): { action: "insert_queued" | "insert_unconfigured" | "promote" | "owned"; legacy: boolean } {
  if (input.existingStatus == null) {
    if (input.configured) return { action: "insert_queued", legacy: false };
    return { action: "insert_unconfigured", legacy: true };
  }
  if (input.existingStatus === "needs_investigation") return { action: "owned", legacy: false };
  if (
    input.existingStatus === "unconfigured" &&
    input.configured &&
    input.legacyOutcome === "unavailable"
  ) {
    return { action: "promote", legacy: false };
  }
  return { action: "owned", legacy: false };
}

/** Legacy API acceptance is not a read receipt and must not be sent again on the new bot. */
export function legacyOutcomeFromSend(input: {
  configured: boolean;
  ok: boolean | null;
  thrown: boolean;
}): LegacyOutcome {
  if (!input.configured) return "unavailable";
  if (input.ok === true) return "accepted";
  if (input.thrown || input.ok == null) return "uncertain";
  return "unavailable";
}

export function isDailyCron(schedule: string): boolean {
  return /^\d{1,2} \d{1,2} \* \* \*$/.test(schedule);
}

export function isolatedTelegramTarget(url: string | null | undefined): "isolated" | "production" | "missing" {
  const value = url?.trim().toLowerCase() ?? "";
  if (!value) return "missing";
  if (PRODUCTION_TELEGRAM_TARGETS.some((item) => value.includes(item))) return "production";
  return "isolated";
}

/** Once a job row exists and the new system owns it, the old sender must not run. */
export function fallbackAfterEnqueue(input: { persisted: boolean; legacy: boolean }): "handled" | "legacy" {
  if (!input.persisted) return "legacy";
  if (input.legacy) return "legacy";
  return "handled";
}

export function staleSendingDecision(updatedAtMs: number, nowMs: number): "uncertain" | "leave" {
  if (!Number.isFinite(updatedAtMs) || !Number.isFinite(nowMs)) return "leave";
  if (nowMs - updatedAtMs >= SENDING_STALE_MS) return "uncertain";
  return "leave";
}

export function webhookReplayDecision(input: {
  status: "received" | "processed" | "failed" | "exhausted" | "reviewed" | null;
  attempts: number;
}): "start" | "retry" | "duplicate" | "stopped" {
  if (input.status == null) return "start";
  if (input.status === "processed" || input.status === "reviewed") return "duplicate";
  if (input.status === "exhausted" || input.attempts >= WEBHOOK_PROCESS_ATTEMPTS) return "stopped";
  return "retry";
}

/** Reopen does not run the command. It only allows Telegram to deliver that same update id again. */
export function webhookRecoveryDecision(input: {
  status: string;
  action: "reopen" | "dismiss";
}): "reopen" | "dismiss" | "refuse" {
  if (input.status !== "exhausted") return "refuse";
  return input.action;
}

export function isPrivateTelegramChat(chatType: string | null | undefined): boolean {
  return chatType === "private";
}

export function groupCommandRefusal(): string {
  return "Open a private chat with this bot. Linking, balances, and reports are not answered in a group.";
}

export function countReport(
  count: number | null,
  failed: boolean
): { state: "unavailable" } | { state: "ready"; count: number } {
  if (failed || count == null || !Number.isFinite(count)) return { state: "unavailable" };
  return { state: "ready", count };
}

export function formatOwnerMoney(
  label: string,
  input: {
    complete?: boolean;
    confirmed: number | null;
    confirmedCount: number | null;
    pending: number | null;
    pendingCount: number | null;
    failed: number | null;
    failedCount: number | null;
    failedKnown: boolean;
  } | null
): string {
  if (!input || input.complete === false) return `${label}: unavailable`;
  const required = [input.confirmed, input.confirmedCount, input.pending, input.pendingCount];
  if (required.some((value) => value == null || !Number.isFinite(value))) return `${label}: unavailable`;
  const confirmed = `confirmed $${(input.confirmed as number).toFixed(2)} (${input.confirmedCount})`;
  const pending = `pending $${(input.pending as number).toFixed(2)} (${input.pendingCount})`;
  if (!input.failedKnown) return `${label}: ${confirmed}, ${pending}`;
  if (input.failed == null || input.failedCount == null || !Number.isFinite(input.failed) || !Number.isFinite(input.failedCount)) {
    return `${label}: unavailable`;
  }
  return `${label}: ${confirmed}, ${pending}, failed $${input.failed.toFixed(2)} (${input.failedCount})`;
}

export function formatOwnerCount(label: string, count: number | null): string {
  const report = countReport(count, count == null);
  if (report.state === "unavailable") return `${label}: unavailable`;
  return `${label}: ${report.count}`;
}

export function moneyAggregateReport(input: {
  ok: boolean;
  confirmed: number | null;
  confirmedCount: number | null;
  pending: number | null;
  pendingCount: number | null;
  failed: number | null;
  failedCount: number | null;
} | null): { state: "unavailable" } | {
  state: "ready";
  confirmed: number;
  confirmedCount: number;
  pending: number;
  pendingCount: number;
  failed: number;
  failedCount: number;
} {
  if (!input?.ok) return { state: "unavailable" };
  const values = [input.confirmed, input.confirmedCount, input.pending, input.pendingCount, input.failed, input.failedCount];
  if (values.some((value) => value == null || !Number.isFinite(value))) return { state: "unavailable" };
  return {
    state: "ready",
    confirmed: input.confirmed as number,
    confirmedCount: input.confirmedCount as number,
    pending: input.pending as number,
    pendingCount: input.pendingCount as number,
    failed: input.failed as number,
    failedCount: input.failedCount as number,
  };
}

const TRANSACTION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A cash-out alert key exists only when the ledger row id is already known. */
export function adminCashoutEventKey(transactionId: string | null | undefined): string | null {
  const id = transactionId?.trim() ?? "";
  if (!TRANSACTION_ID.test(id)) return null;
  return `admin-cashout:${id}`;
}

export function cashoutAlertPlan(transactionId: string | null | undefined): { kind: "event"; eventKey: string } | { kind: "investigate" } {
  const eventKey = adminCashoutEventKey(transactionId);
  if (!eventKey) return { kind: "investigate" };
  return { kind: "event", eventKey };
}

export function investigationEventKey(nonce: string | null | undefined): string | null {
  const id = nonce?.trim() ?? "";
  if (!TRANSACTION_ID.test(id)) return null;
  return `investigate:${id}`;
}

const INCIDENT_AREAS = ["audit", "game-load", "rate-limit", "kyc", "telegram", "app"] as const;
const INCIDENT_OUTCOMES = ["timeout", "unavailable", "rejected", "unknown", "failed", "audit"] as const;

/** Telegram receives only these fields. The raw message is never copied. */
export function sanitizeSecurityAlert(input: {
  area?: string | null;
  code?: string | null;
  outcome?: string | null;
  message?: string | null;
}): { area: string; code: string | null; outcome: string; text: string } {
  const area = (INCIDENT_AREAS as readonly string[]).includes(input.area ?? "") ? (input.area as string) : "app";
  const code = /^inc_[a-z0-9_]{4,48}$/i.test(input.code ?? "") ? (input.code as string) : null;
  const outcome = (INCIDENT_OUTCOMES as readonly string[]).includes(input.outcome ?? "") ? (input.outcome as string) : "failed";
  const lines = [`Area: ${area}`, code ? `Code: ${code}` : "Code: unavailable", `Outcome: ${outcome}`];
  return { area, code, outcome, text: lines.join("\n") };
}

export function linkRedeemPlan(input: {
  found: boolean;
  expired: boolean;
  consumed: boolean;
  replaced: boolean;
  purpose: "owner" | "customer" | null;
  expected: "owner" | "customer";
  isSuperAdmin: boolean;
  privateChat: boolean;
  saveFailed: boolean;
}): { consume: boolean; message: string } {
  if (!input.privateChat) return { consume: false, message: groupCommandRefusal() };
  if (!input.found || input.expired || input.consumed || input.replaced) {
    return { consume: false, message: "That code is missing, expired, or already used." };
  }
  if (input.purpose !== input.expected) return { consume: false, message: "That code is for a different bot." };
  if (input.expected === "owner" && !input.isSuperAdmin) {
    return { consume: false, message: "That account is not an owner. The code was not used." };
  }
  if (input.saveFailed) return { consume: false, message: "The link was not saved. Use the same code again." };
  return { consume: true, message: input.expected === "owner" ? "Owner chat linked." : "This chat is linked." };
}

/**
 * A later payout webhook may notify only when the payout row actually changed.
 * A failed refund can be duplicate while reserved or submitted still becomes failed.
 * A row that was already failed stays silent.
 */
export function payoutWebhookAlert(input: {
  kind: "paid" | "failed" | "ignored";
  priorStatus?: string | null;
  rpc: { updated?: boolean; status?: string; duplicate?: boolean } | null;
}): { notify: "paid" | "failed" } | { notify: null } {
  if (input.kind === "paid" && input.rpc?.updated === true && input.rpc.status === "paid") {
    return { notify: "paid" };
  }
  if (input.kind === "failed" && input.rpc?.status === "failed") {
    const prior = input.priorStatus?.trim().toLowerCase() ?? "";
    const opened = prior === "reserved" || prior === "submitted";
    if (input.rpc.duplicate !== true || opened) return { notify: "failed" };
  }
  return { notify: null };
}

export function providerAlertCategory(message: string, outcome: "unknown" | "failed"): AlertCategory {
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|service unavailable|bad gateway|gateway timeout/i.test(message)) {
    return "provider_down";
  }
  if (outcome === "unknown") return "load_unknown";
  return "load_failed";
}

export function incidentSeverity(area: string): Severity {
  if (area === "rate-limit") return "WARNING";
  return "ERROR";
}

export function workerSummary(input: {
  attempted: number;
  accepted: number;
  failed: number;
  uncertain: number;
  retryPending: number;
  recovered: number;
  promoted: number;
}): {
  processed: number;
  accepted: number;
  failed: number;
  uncertain: number;
  retryPending: number;
  recovered: number;
  promoted: number;
} {
  return {
    processed: input.attempted,
    accepted: input.accepted,
    failed: input.failed,
    uncertain: input.uncertain,
    retryPending: input.retryPending,
    recovered: input.recovered,
    promoted: input.promoted,
  };
}

export type PaymentClaim = "requested" | "provider_confirmed" | "wallet_recorded" | "failed" | "unknown" | "admin_record";

/** An admin button never becomes a provider confirmation. */
export function paymentClaim(input: { category: AlertCategory; source: "provider" | "ledger" | "admin" }): PaymentClaim {
  if (input.source === "admin") return "admin_record";
  if (input.category === "deposit_confirmed" || input.category === "payout_provider_paid" || input.category === "refund_confirmed") {
    return input.source === "provider" || input.source === "ledger" ? "provider_confirmed" : "unknown";
  }
  if (input.category === "deposit_credited") return "wallet_recorded";
  if (input.category === "deposit_failed" || input.category === "payout_failed") return "failed";
  if (input.category === "refund_unknown" || input.category === "load_unknown") return "unknown";
  return "requested";
}

export function paymentTitle(category: AlertCategory, claim: PaymentClaim): string {
  if (claim === "admin_record") return "Admin record only";
  const titles: Partial<Record<AlertCategory, string>> = {
    deposit_requested: "Deposit started",
    deposit_confirmed: "Provider marked the deposit paid",
    deposit_failed: "Deposit failed",
    deposit_credited: "Wallet credit recorded",
    payout_requested: "Cash-out requested",
    payout_submitted: "Cash-out sent to the provider",
    payout_provider_paid: "Provider marked the cash-out paid",
    payout_failed: "Cash-out failed",
    refund_confirmed: "Refund recorded",
    refund_unknown: "Refund not confirmed",
    duplicate_financial: "Duplicate money event",
    reconciliation: "Reconciliation item",
    load_requested: "Game request opened",
    signup: "New registration",
    email_verified: "Email confirmed",
    phone_verified: "Phone confirmed",
    ticket_opened: "New support ticket",
    ticket_escalated: "Support escalation",
    account_status: "Account status change",
    provider_down: "Game provider unavailable",
    load_failed: "Game load failed",
    load_unknown: "Game load outcome unknown",
    refund_mismatch: "Refund mismatch",
    webhook_rejected: "Payment webhook rejected",
    payout_provider_error: "Payout provider error",
    database_down: "Database connectivity failure",
    cron_failed: "Scheduled job failed",
    telegram_delivery_failed: "Telegram delivery failed",
    unauthorized_admin: "Repeated unauthorized admin attempt",
    app_error: "Application error",
  };
  return titles[category] ?? "Alert";
}

export function alertText(input: {
  category: AlertCategory;
  source: "provider" | "ledger" | "admin";
  reference: string;
  amount?: number | null;
  detail?: string | null;
  adminPath?: string | null;
  siteUrl: string;
}): string {
  const claim = paymentClaim(input);
  const lines = [`<b>${escapeHtml(paymentTitle(input.category, claim))}</b>`];
  if (claim === "admin_record") {
    lines.push("This is an admin panel record. It is not a provider confirmation.");
  }
  if (claim === "unknown") {
    lines.push("The outcome is not confirmed.");
  }
  if (typeof input.amount === "number" && Number.isFinite(input.amount)) {
    lines.push(`Amount: $${input.amount.toFixed(2)}`);
  }
  if (input.detail) lines.push(escapeHtml(input.detail).slice(0, 240));
  lines.push(`Reference: ${escapeHtml(input.reference).slice(0, 80)}`);
  if (input.adminPath && input.adminPath.startsWith("/") && !input.adminPath.startsWith("//")) {
    lines.push(`<a href="${escapeHtml(input.siteUrl.replace(/\/$/, "") + input.adminPath)}">Open in admin</a>`);
  }
  lines.push("Telegram accepted this message does not mean a person read it.");
  return lines.join("\n");
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type ContactDisclosure = "full" | "masked";

/** Full contact details only when the destination is the linked owner's private chat. */
export function contactDisclosure(input: {
  destinationChatId: string | null | undefined;
  ownerPrivateChatId: string | null | undefined;
}): ContactDisclosure {
  const destination = input.destinationChatId?.trim() ?? "";
  const owner = input.ownerPrivateChatId?.trim() ?? "";
  if (!destination || !owner) return "masked";
  if (destination.startsWith("-") || owner.startsWith("-")) return "masked";
  if (!/^\d+$/.test(destination) || !/^\d+$/.test(owner)) return "masked";
  return destination === owner ? "full" : "masked";
}

export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  const name = at > 0 ? trimmed.slice(0, at) : "";
  const domain = at > 0 ? trimmed.slice(at + 1) : "";
  if (!name || !domain || domain.includes(" ")) return "Not provided";
  return `${name.slice(0, 1)}***@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "Not provided";
  return `***${digits.slice(-4)}`;
}

export function verificationLabel(value: boolean | null): "Verified" | "Unverified" | "Unknown" {
  if (value === true) return "Verified";
  if (value === false) return "Unverified";
  return "Unknown";
}

export function formatRegisteredAt(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${hours}:${minutes} UTC`;
}

export type SignupNotice = {
  displayName: string | null;
  playerId: string;
  email: string | null;
  phone: string | null;
  emailVerified: boolean | null;
  phoneVerified: boolean | null;
  registeredAt: string | null;
  accountStatus: string | null;
  source: string | null;
};

function contactLine(value: string | null | undefined, disclosure: ContactDisclosure, kind: "email" | "phone"): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "Not provided";
  const shown = disclosure === "full" ? trimmed : kind === "email" ? maskEmail(trimmed) : maskPhone(trimmed);
  return escapeHtml(shown);
}

/** Players signup notice. Uses only the fields passed in. */
export function signupAlertText(input: SignupNotice & { disclosure: ContactDisclosure; adminUrl?: string | null }): string {
  const lines = [
    "<b>New registration</b>",
    "",
    `Name: ${input.displayName?.trim() ? escapeHtml(input.displayName.trim()) : "Not provided"}`,
    `Player ID: ${input.playerId.trim() ? escapeHtml(input.playerId.trim()) : "Unknown"}`,
    `Email: ${contactLine(input.email, input.disclosure, "email")}`,
    `Phone: ${contactLine(input.phone, input.disclosure, "phone")}`,
    `Email verification: ${verificationLabel(input.emailVerified)}`,
    `Phone verification: ${verificationLabel(input.phoneVerified)}`,
    `Registered: ${formatRegisteredAt(input.registeredAt)}`,
    `Account status: ${input.accountStatus?.trim() ? escapeHtml(input.accountStatus.trim()) : "Unknown"}`,
    `Source: ${input.source?.trim() ? escapeHtml(input.source.trim()) : "Not provided"}`,
  ];
  if (input.adminUrl && input.adminUrl.startsWith("https://")) lines.push(`<a href="${escapeHtml(input.adminUrl)}">Open in admin</a>`);
  return lines.join("\n");
}

/** after() keeps the function alive only when the callback returns its promise. */
export function keptPromptTask(task: () => Promise<void>): () => Promise<void> {
  return async () => {
    try {
      await task();
    } catch {
      /* The queued row stays available for the daily cron. */
    }
  };
}

export function secretsMatch(given: string | null | undefined, expected: string | null | undefined): boolean {
  const left = given ?? "";
  const right = expected ?? "";
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export function isTelegramBotKey(value: string): value is TelegramBotKey {
  return (TELEGRAM_BOTS as readonly string[]).includes(value);
}

export const ALERT_TEST_BOTS = ["payments", "players", "errors"] as const;
export type AlertTestBot = (typeof ALERT_TEST_BOTS)[number];
export const ALERT_TEST_BODY = "Telegram Control Center test. This is not a payment, player event, or error.";
export type AlertTestStatus = "accepted" | "failed" | "uncertain";

export function isAlertTestBot(value: string): value is AlertTestBot {
  return (ALERT_TEST_BOTS as readonly string[]).includes(value);
}

export const PLAYERS_DELIVERY_CHECK_EVENT = "delivery-check:players";
export const PLAYERS_DELIVERY_CHECK_BODY =
  "Players delivery check. This is not a signup and contains no player information.";

export function deliveryCheckAccess(isSuperAdmin: boolean): { ok: true } | { ok: false; error: string } {
  if (!isSuperAdmin) return { ok: false, error: "Only an owner can run this check." };
  return { ok: true };
}

/** Any existing diagnostic row is kept. A second click must not insert or send. */
export function deliveryCheckDuplicateDecision(existing: { status: string } | null): "create" | "keep" {
  if (!existing) return "create";
  return "keep";
}

/** Schedule only the new diagnostic job. Every other event key stays untouched. */
export function deliveryCheckScheduleDecision(input: {
  inserted: boolean;
  status: string | null;
  jobId: string | null;
  eventKey: string;
}): { schedule: boolean; jobId: string | null } {
  if (input.eventKey !== PLAYERS_DELIVERY_CHECK_EVENT) return { schedule: false, jobId: null };
  if (!input.inserted || input.status !== "queued" || !input.jobId) return { schedule: false, jobId: null };
  return { schedule: true, jobId: input.jobId };
}

/** Existing signup and other jobs are outside this check. */
export function deliveryCheckLeavesExistingJob(eventKey: string): boolean {
  return eventKey !== PLAYERS_DELIVERY_CHECK_EVENT;
}

export function alertTestAccess(input: { isSuperAdmin: boolean; bot: string }): { ok: true; bot: AlertTestBot } | { ok: false; error: string } {
  if (!input.isSuperAdmin) return { ok: false, error: "Only an owner can send a bot test." };
  if (!isAlertTestBot(input.bot)) return { ok: false, error: "That bot cannot be tested from here." };
  return { ok: true, bot: input.bot };
}

export function alertTestTarget(bot: AlertTestBot): { bot: AlertTestBot; eventKey: string; body: string; category: "control_test" } {
  return { bot, eventKey: `bot-test:${bot}`, body: ALERT_TEST_BODY, category: "control_test" };
}

/** An existing test row is kept. A repeated click must not send another message. */
export function alertTestDuplicateDecision(existing: { status: string } | null): "create" | "keep" {
  if (!existing) return "create";
  return "keep";
}

export function alertTestVisibleStatus(status: string): AlertTestStatus | null {
  if (status === "accepted" || status === "failed" || status === "uncertain") return status;
  return null;
}

/** Due-queue selection is queued or retry_pending. A test must never match it. */
export function alertTestIsQueueEligible(status: string): boolean {
  return status === "queued" || status === "retry_pending";
}

export function safeTelegramTestError(description: string | null | undefined): string | null {
  if (!description?.trim()) return null;
  const text = description
    .replace(/bot\d+:[A-Za-z0-9_-]+/gi, "[redacted]")
    .replace(/\b\d{6,}:[A-Za-z0-9_-]{20,}\b/g, "[redacted]")
    .replace(/bearer\s+\S+/gi, "bearer [redacted]")
    .replace(/https?:\/\/\S+/gi, "[link]")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 180);
}

/** One attempt. Retry and refusal both finish as failed so the daily worker cannot send the test again. */
export function alertTestCompletion(input: {
  httpStatus?: number | null;
  ok?: boolean | null;
  thrown?: boolean;
  description?: string | null;
}): { status: AlertTestStatus; nextAttemptAt: null; error: string | null } {
  const classified = classifyTelegramResponse(input);
  const error = safeTelegramTestError(input.description);
  if (classified.outcome === "accepted") return { status: "accepted", nextAttemptAt: null, error: null };
  if (classified.outcome === "uncertain") {
    return { status: "uncertain", nextAttemptAt: null, error: error ?? "Telegram did not answer before the timeout." };
  }
  return { status: "failed", nextAttemptAt: null, error: error ?? "Telegram refused the test." };
}

/**
 * Next.js runs after() only when it is registered before the server action returns.
 * A signup that returns first leaves the inserted job queued for the daily cron.
 */
export function promptLifecycleDecision(input: {
  actionStillRunning: boolean;
  jobId: string | null;
}): "register" | "leave_queued" {
  if (!input.actionStillRunning || !input.jobId) return "leave_queued";
  return "register";
}

/** Schedule a send only for a job that was just queued. Anything else stays for the daily cron. */
export function promptScheduleDecision(input: {
  inserted: boolean;
  status: string | null;
  jobId: string | null;
}): { schedule: boolean; jobId: string | null } {
  if (!input.inserted || input.status !== "queued" || !input.jobId) return { schedule: false, jobId: null };
  return { schedule: true, jobId: input.jobId };
}

/** The sender may claim only a waiting row. sending, accepted, failed, and uncertain are not claimed again. */
export function promptClaimAllowed(status: string): boolean {
  return status === "queued" || status === "retry_pending";
}

export function deliveryStatusAccess(isSuperAdmin: boolean): boolean {
  return isSuperAdmin;
}

export function deliveryLatencyMs(createdAt: string, updatedAt: string): number | null {
  const start = Date.parse(createdAt);
  const end = Date.parse(updatedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return end - start;
}

export function formatDeliveryLatency(ms: number | null): string | null {
  if (ms == null) return null;
  if (ms < 1000) return `${ms} ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min`;
}

export type DeliverySnapshot = {
  status: string;
  bot: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string | null;
};

export function summarizeDelivery(rows: DeliverySnapshot[]): {
  counts: Record<"queued" | "sending" | "accepted" | "failed" | "uncertain", number>;
  lastSuccess: { at: string; bot: string; category: string; latencyMs: number | null } | null;
  problems: Array<{ status: "failed" | "uncertain"; bot: string; category: string; error: string | null; latencyMs: number | null }>;
} {
  const counts = { queued: 0, sending: 0, accepted: 0, failed: 0, uncertain: 0 };
  let lastSuccess: { at: string; bot: string; category: string; latencyMs: number | null } | null = null;
  const problems: Array<{ status: "failed" | "uncertain"; bot: string; category: string; error: string | null; latencyMs: number | null }> = [];
  for (const row of rows) {
    if (row.status === "queued" || row.status === "retry_pending") counts.queued += 1;
    else if (row.status === "sending" || row.status === "accepted" || row.status === "failed" || row.status === "uncertain") {
      counts[row.status] += 1;
    }
    const latencyMs = deliveryLatencyMs(row.createdAt, row.updatedAt);
    if (row.status === "accepted" && (!lastSuccess || Date.parse(row.updatedAt) > Date.parse(lastSuccess.at))) {
      lastSuccess = { at: row.updatedAt, bot: row.bot, category: row.category, latencyMs };
    }
    if ((row.status === "failed" || row.status === "uncertain") && problems.length < 5) {
      problems.push({
        status: row.status,
        bot: row.bot,
        category: row.category,
        error: safeTelegramTestError(row.lastError),
        latencyMs,
      });
    }
  }
  return { counts, lastSuccess, problems };
}

export function visibleDeliverySummary(isSuperAdmin: boolean, rows: DeliverySnapshot[]) {
  if (!deliveryStatusAccess(isSuperAdmin)) return null;
  return summarizeDelivery(rows);
}

export function deliveryPanelState(input: {
  queryFailed: boolean;
  isSuperAdmin: boolean;
  rows: DeliverySnapshot[];
}):
  | { kind: "hidden" }
  | { kind: "unavailable" }
  | { kind: "ready"; summary: ReturnType<typeof summarizeDelivery> } {
  if (!deliveryStatusAccess(input.isSuperAdmin)) return { kind: "hidden" };
  if (input.queryFailed) return { kind: "unavailable" };
  return { kind: "ready", summary: summarizeDelivery(input.rows) };
}

/** Alert work cannot replace the business result that was already saved. */
export function keepBusinessResult<T>(result: T): T {
  return result;
}

export function webhookPath(bot: TelegramBotKey): string {
  return `/api/telegram/${bot}`;
}

export type LinkDecision = "ready" | "expired" | "used" | "missing";

export function linkConsumeDecision(input: {
  found: boolean;
  expiresAtMs: number | null;
  consumed: boolean;
  nowMs: number;
}): LinkDecision {
  if (!input.found) return "missing";
  if (input.consumed) return "used";
  if (input.expiresAtMs == null || input.expiresAtMs <= input.nowMs) return "expired";
  return "ready";
}

export type CommandActor = {
  linked: boolean;
  purpose: "owner" | "customer" | null;
  isSuperAdmin: boolean;
  userId: string | null;
};

export function ownerCommandAllowed(actor: CommandActor): boolean {
  return actor.linked && actor.purpose === "owner" && actor.isSuperAdmin && Boolean(actor.userId);
}

export function customerCommandAllowed(actor: CommandActor, requestedUserId: string | null): boolean {
  if (!actor.linked || actor.purpose !== "customer" || !actor.userId) return false;
  if (!requestedUserId) return true;
  return actor.userId === requestedUserId;
}

export function parseCommand(text: string | null | undefined): { name: string; arg: string } | null {
  const trimmed = (text ?? "").trim();
  if (!trimmed.startsWith("/")) return null;
  const [head, ...rest] = trimmed.split(/\s+/);
  const name = head.slice(1).split("@")[0].toLowerCase();
  if (!/^[a-z]+$/.test(name) || name.length > 32) return null;
  return { name, arg: rest.join(" ").slice(0, 80) };
}

export const OWNER_COMMANDS = [
  "start",
  "help",
  "today",
  "yesterday",
  "deposits",
  "payouts",
  "pending",
  "failedloads",
  "reconcile",
  "players",
  "signups",
  "tickets",
  "health",
  "report",
] as const;

export const CUSTOMER_COMMANDS = ["start", "help", "link", "wallet", "status", "ticket", "unlink"] as const;

export function incidentFingerprint(source: string, message: string): string {
  const text = `${source}|${message}`
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "#")
    .replace(/\d+/g, "#")
    .slice(0, 180);
  return text;
}

export type Severity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export function incidentShouldSend(input: {
  severity: Severity;
  lastSentMs: number | null;
  nowMs: number;
}): boolean {
  if (input.lastSentMs == null) return true;
  const gap = input.nowMs - input.lastSentMs;
  if (input.severity === "CRITICAL") return gap >= 15 * 60 * 1000;
  if (input.severity === "ERROR") return gap >= 30 * 60 * 1000;
  if (input.severity === "WARNING") return gap >= 2 * 60 * 60 * 1000;
  return gap >= 24 * 60 * 60 * 1000;
}

export type MoneyRow = { status: string; amount: number | null; at: string };

export function reportWindow(nowMs: number, which: "today" | "yesterday", timeZone = REPORT_TIMEZONE) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date(nowMs));
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const startToday = zonedMidnightUtc(year, month, day, timeZone);
  const start = which === "today" ? startToday : startToday - 24 * 60 * 60 * 1000;
  const end = which === "today" ? startToday + 24 * 60 * 60 * 1000 : startToday;
  return {
    timeZone,
    label: which === "today" ? "Today" : "Yesterday",
    startIso: new Date(start).toISOString(),
    endIso: new Date(end).toISOString(),
  };
}

function zonedMidnightUtc(year: number, month: number, day: number, timeZone: string): number {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offset = timeZoneOffsetMs(new Date(utcGuess), timeZone);
  return utcGuess - offset;
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  return asUtc - date.getTime();
}

export function summarizeMoney(rows: MoneyRow[] | null, startIso: string, endIso: string) {
  if (!rows) return { state: "unavailable" as const };
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  let confirmed = 0;
  let pending = 0;
  let failed = 0;
  let confirmedCount = 0;
  let pendingCount = 0;
  let failedCount = 0;
  for (const row of rows) {
    const at = Date.parse(row.at);
    if (!Number.isFinite(at) || at < start || at >= end) continue;
    const amount = Number(row.amount);
    const safe = Number.isFinite(amount) ? amount : 0;
    const status = row.status.toLowerCase();
    if (["paid", "credited", "completed", "confirmed"].includes(status)) {
      confirmed += safe;
      confirmedCount += 1;
    } else if (["failed", "rejected", "cancelled", "canceled", "expired"].includes(status)) {
      failed += safe;
      failedCount += 1;
    } else {
      pending += safe;
      pendingCount += 1;
    }
  }
  return {
    state: "ready" as const,
    confirmed: roundMoney(confirmed),
    pending: roundMoney(pending),
    failed: roundMoney(failed),
    confirmedCount,
    pendingCount,
    failedCount,
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function customerWalletText(input: { linked: boolean; balance: number | null }): string {
  if (!input.linked) return "This Telegram chat is not linked. Open the website while signed in and use Link Telegram.";
  if (input.balance == null || !Number.isFinite(input.balance)) return "Cash-out balance is unavailable.";
  return `Cash-out balance: $${input.balance.toFixed(2)}\nThis chat cannot deposit, cash out, or change the account.`;
}

export function boundedList<T>(rows: T[] | null, limit: number): { state: "unavailable" } | { state: "ready"; shown: T[]; truncated: boolean } {
  if (!rows) return { state: "unavailable" };
  const cap = Math.max(1, Math.min(limit, 20));
  return { state: "ready", shown: rows.slice(0, cap), truncated: rows.length > cap };
}

/** Business rows before this instant are not compared with delivery jobs. */
export const TELEGRAM_COVERAGE_CUTOFF = "2026-10-20T00:00:00.000Z";

export const DELIVERY_COUNT_STATUSES = [
  "queued",
  "retry_pending",
  "sending",
  "accepted",
  "failed",
  "uncertain",
  "unconfigured",
  "duplicate",
  "needs_investigation",
] as const;

export type DeliveryCountStatus = (typeof DELIVERY_COUNT_STATUSES)[number];

export type ExactDeliveryCounts = {
  counts: Record<DeliveryCountStatus, number>;
  other: number;
  total: number;
};

/**
 * Counts are database totals. Retry pending stays separate from queued.
 * A non-admin receives nothing, including when totals were already loaded.
 */
export function exactDeliveryCounts(input: {
  isSuperAdmin: boolean;
  queryFailed: boolean;
  counts: Partial<Record<DeliveryCountStatus, number | null>>;
  total: number | null;
}): { kind: "hidden" } | { kind: "unavailable" } | { kind: "ready"; summary: ExactDeliveryCounts } {
  if (!deliveryStatusAccess(input.isSuperAdmin)) return { kind: "hidden" };
  if (input.queryFailed || input.total == null || !Number.isFinite(input.total) || input.total < 0) {
    return { kind: "unavailable" };
  }
  const counts = {} as Record<DeliveryCountStatus, number>;
  let known = 0;
  for (const status of DELIVERY_COUNT_STATUSES) {
    const value = input.counts[status];
    if (value == null || !Number.isFinite(value) || value < 0) return { kind: "unavailable" };
    counts[status] = value;
    known += value;
  }
  const other = input.total - known;
  if (other < 0) return { kind: "unavailable" };
  return { kind: "ready", summary: { counts, other, total: input.total } };
}

export type CoverageVerdict = "confirmed_missing" | "callback_not_observed";

export type RecoveryKind =
  | "signup"
  | "ticket"
  | "escalation"
  | "game_request"
  | "game_provider"
  | "payout_paid"
  | "payout_failed"
  | "deposit_credited"
  | "deposit_reversed"
  | "incident";

export type CoverageCandidate = {
  reference: string;
  bot: "payments" | "players" | "errors";
  eventType: string;
  eventKey: string;
  occurredAt: string;
  eligible: boolean;
  suppressed: boolean;
  callbackRequired: boolean;
  recoverable?: boolean;
  scanComplete?: boolean;
  reason: string;
};

export type CoverageFinding = {
  reference: string;
  bot: CoverageCandidate["bot"];
  eventType: string;
  eventKey: string;
  occurredAt: string;
  reason: string;
  verdict: CoverageVerdict;
  recovery: "eligible" | "not_eligible";
  recoveryKind: RecoveryKind | null;
  scanComplete: boolean;
};

function onOrAfterCutoff(occurredAt: string, cutoff: string): boolean | null {
  const at = Date.parse(occurredAt);
  const cut = Date.parse(cutoff);
  if (!Number.isFinite(at) || !Number.isFinite(cut)) return null;
  return at >= cut;
}

/** A stored job of any status, including uncertain or failed, means the alert is not missing. */
export function coverageMatch(input: {
  candidate: CoverageCandidate;
  cutoff: string;
  existingEventKeys: readonly string[];
}): CoverageVerdict | null {
  const candidate = input.candidate;
  if (!candidate.eligible || candidate.suppressed) return null;
  if (!candidate.reference.trim() || !candidate.eventKey.trim()) return null;
  const included = onOrAfterCutoff(candidate.occurredAt, input.cutoff);
  if (included !== true) return null;
  if (input.existingEventKeys.includes(candidate.eventKey)) return null;
  if (candidate.callbackRequired) return "callback_not_observed";
  return "confirmed_missing";
}

export function coverageFindings(input: {
  cutoff: string;
  candidates: readonly CoverageCandidate[];
  existingEventKeys: readonly string[];
}): { confirmed: CoverageFinding[]; unproven: CoverageFinding[] } {
  const present = new Set(input.existingEventKeys);
  const byKey = new Map<string, CoverageFinding>();
  for (const candidate of input.candidates) {
    if (present.has(candidate.eventKey)) continue;
    const verdict = coverageMatch({ candidate, cutoff: input.cutoff, existingEventKeys: input.existingEventKeys });
    if (!verdict) continue;
    const current = byKey.get(candidate.eventKey);
    if (current?.verdict === "confirmed_missing") continue;
    const recoverable = verdict === "confirmed_missing" && candidate.recoverable !== false && !candidate.callbackRequired;
    byKey.set(candidate.eventKey, {
      reference: candidate.reference,
      bot: candidate.bot,
      eventType: candidate.eventType,
      eventKey: candidate.eventKey,
      occurredAt: candidate.occurredAt,
      reason: candidate.reason,
      verdict,
      recovery: recoverable ? "eligible" : "not_eligible",
      recoveryKind: recoverable ? recoveryKindFor(candidate.eventKey) : null,
      scanComplete: candidate.scanComplete !== false,
    });
  }
  const confirmed: CoverageFinding[] = [];
  const unproven: CoverageFinding[] = [];
  for (const finding of byKey.values()) {
    if (finding.verdict === "confirmed_missing") confirmed.push(finding);
    else unproven.push(finding);
  }
  return { confirmed, unproven };
}

export function coveragePanelState(input: {
  isSuperAdmin: boolean;
  queryFailed: boolean;
  truncated: boolean;
  cutoff: string;
  candidates: readonly CoverageCandidate[];
  existingEventKeys: readonly string[];
}):
  | { kind: "hidden" }
  | { kind: "unavailable" }
  | { kind: "ready"; cutoff: string; truncated: boolean; confirmed: CoverageFinding[]; unproven: CoverageFinding[] } {
  if (!deliveryStatusAccess(input.isSuperAdmin)) return { kind: "hidden" };
  if (input.queryFailed) return { kind: "unavailable" };
  const findings = coverageFindings(input);
  return { kind: "ready", cutoff: input.cutoff, truncated: input.truncated, ...findings };
}

export function signupCoverageCandidate(input: {
  userId: string;
  occurredAt: string;
  registrationCompleted: boolean;
}): CoverageCandidate {
  return {
    reference: input.userId,
    bot: "players",
    eventType: "Signup",
    eventKey: `signup:${input.userId}`,
    recoverable: input.registrationCompleted,
    occurredAt: input.occurredAt,
    eligible: true,
    suppressed: false,
    callbackRequired: !input.registrationCompleted,
    reason: input.registrationCompleted
      ? "Registration completed far enough to store the signup alert, and no job exists."
      : "A profile exists, but this account does not show the registration completion that stores the signup alert.",
  };
}

export function emailCoverageCandidate(input: { userId: string; occurredAt: string }): CoverageCandidate {
  return {
    reference: input.userId,
    bot: "players",
    eventType: "Email confirmation",
    eventKey: `email-verified:${input.userId}`,
    recoverable: false,
    occurredAt: input.occurredAt,
    eligible: true,
    suppressed: false,
    callbackRequired: true,
    reason: "Email is confirmed, but this alert is stored only when the confirmation callback runs. This record does not prove that callback ran.",
  };
}

export function ticketCoverageCandidate(input: { ticketId: string; occurredAt: string }): CoverageCandidate {
  return {
    reference: input.ticketId,
    bot: "players",
    eventType: "Support ticket",
    eventKey: `ticket:${input.ticketId}`,
    occurredAt: input.occurredAt,
    eligible: true,
    suppressed: false,
    callbackRequired: false,
    reason: "A player ticket was saved and the ticket alert is stored in that same action, but no job exists.",
  };
}

export function escalationCoverageCandidate(input: { conversationId: string; occurredAt: string }): CoverageCandidate {
  return {
    reference: input.conversationId,
    bot: "players",
    eventType: "Chat escalation",
    eventKey: `escalation:${input.conversationId}`,
    occurredAt: input.occurredAt,
    eligible: true,
    suppressed: false,
    callbackRequired: false,
    reason: "A player asked for a person and that chat update stores an alert, but no job exists.",
  };
}

const NOTIFY_LOAD_TYPES = new Set(["create_account", "new_account", "load", "redeem"]);

export function gameRequestCandidate(input: {
  id: string;
  loadType: string;
  status: string;
  occurredAt: string;
}): CoverageCandidate | null {
  if (input.status.trim().toLowerCase() !== "completed") return null;
  const type = input.loadType.trim().toLowerCase();
  if (type === "check_balance") return null;
  const notified = NOTIFY_LOAD_TYPES.has(type);
  if (!notified && type !== "reload") return null;
  return {
    reference: input.id,
    bot: "players",
    eventType: "Game request",
    eventKey: `game-request:${input.id}`,
    recoverable: notified && type !== "new_account" && type !== "reload",
    occurredAt: input.occurredAt,
    eligible: true,
    suppressed: false,
    callbackRequired: !notified,
    reason: notified
      ? "A completed game request of this type stores a Players alert after the result, and no job exists."
      : "A completed reload is not always sent through the player action that stores this alert.",
  };
}

export function gameProviderCandidate(input: {
  id: string;
  status: string;
  errorMessage: string | null;
  sourceKey: string | null;
  occurredAt: string;
}): CoverageCandidate | null {
  if ((input.sourceKey ?? "").startsWith("auto:") || (input.sourceKey ?? "").startsWith("auto-account:")) return null;
  const held = (input.errorMessage ?? "").startsWith("Needs review");
  const failed = input.status.trim().toLowerCase() === "failed";
  if (!held && !failed) return null;
  return {
    reference: input.id,
    bot: "errors",
    eventType: "Game provider result",
    eventKey: `game-provider:${input.id}`,
    recoverable: held,
    occurredAt: input.occurredAt,
    eligible: true,
    suppressed: false,
    callbackRequired: !held,
    reason: held
      ? "An unknown game result stores an Errors alert while the request stays open, and no job exists."
      : "A failed game load is alerted from the player fulfillment path. This row does not prove that path ran.",
  };
}

export function payoutCoverageCandidate(input: {
  status: string;
  idempotencyKey: string;
  occurredAt: string;
}): CoverageCandidate | null {
  const status = input.status.trim().toLowerCase();
  const key = input.idempotencyKey.trim();
  if (!key) return null;
  if (status === "paid") {
    return {
      reference: key,
      bot: "payments",
      eventType: "Payout paid",
      eventKey: `payout:${key}:paid`,
      occurredAt: input.occurredAt,
      eligible: true,
      suppressed: false,
      callbackRequired: false,
      reason: "A payout that reached paid stores a Payments alert for that transition, and no job exists.",
    };
  }
  if (status === "failed") {
    return {
      reference: key,
      bot: "payments",
      eventType: "Payout failed",
      eventKey: `payout-failed:${key}`,
      occurredAt: input.occurredAt,
      eligible: true,
      suppressed: false,
      callbackRequired: false,
      reason: "A payout that reached failed stores a Payments alert for that transition, and no job exists.",
    };
  }
  if (status === "submitted") {
    return {
      reference: key,
      bot: "payments",
      eventType: "Payout submitted",
      eventKey: `payout:${key}:submitted`,
      recoverable: false,
      occurredAt: input.occurredAt,
      eligible: true,
      suppressed: false,
      callbackRequired: true,
      reason: "A submitted payout is notified on the original success response. A duplicate provider response can record submitted without an alert, and this row does not show which one it was.",
    };
  }
  return null;
}

export function depositCreditCandidate(input: {
  paymentId: string;
  direction: string;
  occurredAt: string;
}): CoverageCandidate | null {
  const id = input.paymentId.trim();
  if (!id || id.startsWith("refund:") || input.direction.trim().toLowerCase() !== "credit") return null;
  return {
    reference: id,
    bot: "payments",
    eventType: "Deposit credited",
    eventKey: `deposit-credited:${id}`,
    occurredAt: input.occurredAt,
    eligible: true,
    suppressed: false,
    callbackRequired: false,
    reason: "A recorded Paydora credit stores a Payments alert after the credit, and no job exists.",
  };
}

export function depositReversalCandidate(input: {
  paymentId: string;
  direction: string;
  occurredAt: string;
}): CoverageCandidate | null {
  const id = input.paymentId.trim();
  if (input.direction.trim().toLowerCase() !== "debit" || !id.startsWith("refund:")) return null;
  const depositId = id.slice("refund:".length).trim();
  if (!depositId) return null;
  return {
    reference: depositId,
    bot: "payments",
    eventType: "Deposit reversed",
    eventKey: `deposit-reversed:${depositId}`,
    occurredAt: input.occurredAt,
    eligible: true,
    suppressed: false,
    callbackRequired: false,
    reason: "A recorded Paydora refund stores a Payments alert after the reversal, and no job exists.",
  };
}

/** One incident row can authorize one send. Repeats inside the suppression window are not extra gaps. */
export function incidentCoverageMatch(input: {
  fingerprint: string;
  lastSentAt: string | null;
  seenCount: number;
  cutoff: string;
  eventKeys: readonly string[];
}): CoverageFinding | null {
  const fingerprint = input.fingerprint.trim();
  if (!fingerprint || input.seenCount < 1 || !input.lastSentAt) return null;
  const included = onOrAfterCutoff(input.lastSentAt, input.cutoff);
  if (included !== true) return null;
  const prefix = `incident:${fingerprint}:`;
  if (input.eventKeys.some((key) => key.startsWith(prefix))) return null;
  const bucket = Math.floor(Date.parse(input.lastSentAt) / 60000);
  return {
    reference: fingerprint,
    bot: "errors",
    eventType: "Application incident",
    eventKey: `incident:${fingerprint}:${bucket}`,
    occurredAt: input.lastSentAt,
    reason: "An incident was eligible to send and no delivery job was stored. Later repeats inside the suppression window are not separate alerts.",
    verdict: "confirmed_missing",
    recovery: "eligible",
    recoveryKind: "incident",
    scanComplete: true,
  };
}

export function recoveryKindFor(eventKey: string): RecoveryKind | null {
  if (eventKey.startsWith("signup:")) return "signup";
  if (eventKey.startsWith("ticket:")) return "ticket";
  if (eventKey.startsWith("escalation:")) return "escalation";
  if (eventKey.startsWith("game-request:")) return "game_request";
  if (eventKey.startsWith("game-provider:")) return "game_provider";
  if (eventKey.startsWith("payout-failed:")) return "payout_failed";
  if (/^payout:[^:]+:paid$/.test(eventKey)) return "payout_paid";
  if (eventKey.startsWith("deposit-credited:")) return "deposit_credited";
  if (eventKey.startsWith("deposit-reversed:")) return "deposit_reversed";
  if (eventKey.startsWith("incident:")) return "incident";
  return null;
}

/** Any existing job, including uncertain or failed, blocks a new insert. */
export function recoveryInsertDecision(existingStatus: string | null): "insert" | "refuse" {
  if (existingStatus == null) return "insert";
  return "refuse";
}

/** Only a waiting row may be claimed. Terminal and in-flight rows stay untouched. */
export function waitingJobDecision(status: string | null): "send" | "refuse" {
  if (status === "queued" || status === "retry_pending") return "send";
  return "refuse";
}

export function recoveryDestinationDecision(input: { token: boolean; chat: boolean }): "ready" | "missing" {
  if (!input.token || !input.chat) return "missing";
  return "ready";
}

const RECOVERY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECOVERY_TOKEN = /^[A-Za-z0-9_|:-]{1,120}$/;

export function recoveryReferenceAllowed(kind: RecoveryKind, reference: string): boolean {
  const value = reference.trim();
  if (kind === "signup" || kind === "ticket" || kind === "escalation" || kind === "game_request" || kind === "game_provider") {
    return RECOVERY_UUID.test(value);
  }
  return RECOVERY_TOKEN.test(value);
}
