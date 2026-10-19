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

export function duplicateJobDecision(existing: { status: string } | null): "create" | "skip" {
  if (!existing) return "create";
  return "skip";
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
