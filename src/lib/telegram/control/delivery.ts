import "server-only";

import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/constants";
import {
  BOT_ENV,
  LINK_PEPPER_ENV,
  SENDING_STALE_MS,
  TELEGRAM_NETWORK_TIMEOUT_MS,
  alertText,
  botForCategory,
  classifyTelegramResponse,
  enqueueDisposition,
  incidentFingerprint,
  incidentSeverity,
  incidentShouldSend,
  investigationEventKey,
  nextAttemptDecision,
  parseRetryAfter,
  sanitizeSecurityAlert,
  staleSendingDecision,
  workerSummary,
  type AlertCategory,
  type DeliveryJobStatus,
  type LegacyOutcome,
  type Severity,
  type TelegramBotKey,
} from "@/lib/telegram/control/rules";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const BATCH = 8;

export type EnqueueResult = {
  persisted: boolean;
  legacy: boolean;
  reason: string;
};

export function hashLinkCode(code: string): string | null {
  const pepper = process.env[LINK_PEPPER_ENV]?.trim();
  if (!pepper || !code.trim()) return null;
  return createHash("sha256").update(`${pepper}:${code.trim()}`).digest("hex");
}

export function botEnv(bot: TelegramBotKey) {
  const names = BOT_ENV[bot];
  return {
    token: process.env[names.token]?.trim() || "",
    secret: process.env[names.secret]?.trim() || "",
    chatId: process.env[names.chat]?.trim() || "",
    names,
  };
}

export function botStatus(bot: TelegramBotKey) {
  const env = botEnv(bot);
  return {
    bot,
    token: Boolean(env.token),
    secret: Boolean(env.secret),
    chat: Boolean(env.chatId),
  };
}

export async function expireOpenLinkCodes(
  admin: SupabaseClient,
  userId: string,
  purpose: "owner" | "customer"
): Promise<void> {
  const now = new Date().toISOString();
  await admin
    .from("telegram_link_challenges")
    .update({ replaced_at: now, expires_at: now })
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .is("replaced_at", null);
}

export async function enqueueAlert(input: {
  category: AlertCategory;
  eventKey: string;
  source: "provider" | "ledger" | "admin";
  reference: string;
  amount?: number | null;
  detail?: string | null;
  adminPath?: string | null;
}): Promise<EnqueueResult> {
  let persisted = false;
  let legacy = false;
  try {
    const bot = botForCategory(input.category);
    const env = botEnv(bot);
    const body = alertText({
      category: input.category,
      source: input.source,
      reference: input.reference,
      amount: input.amount,
      detail: input.detail,
      adminPath: input.adminPath,
      siteUrl: SITE_URL,
    });
    const admin = createAdminClient();
    if (!admin) return { persisted: false, legacy: true, reason: "database_unavailable" };
    const eventKey = input.eventKey.trim().slice(0, 160);
    if (!eventKey) return { persisted: false, legacy: true, reason: "missing_event" };
    const { data: existing, error: readError } = await admin
      .from("telegram_delivery_jobs")
      .select("id, status, legacy_outcome")
      .eq("event_key", eventKey)
      .maybeSingle();
    if (readError) return { persisted: false, legacy: true, reason: "tables_missing" };
    const configured = Boolean(env.token && env.chatId);
    const existingRow = (existing as { id?: string; status?: DeliveryJobStatus; legacy_outcome?: LegacyOutcome | null } | null) ?? null;
    if (existingRow?.id) persisted = true;
    const decision = enqueueDisposition({
      existingStatus: existingRow?.status ?? null,
      configured,
      legacyOutcome: existingRow?.legacy_outcome ?? null,
    });
    legacy = decision.legacy;
    if (decision.action === "insert_queued" || decision.action === "insert_unconfigured") {
      const status = decision.action === "insert_queued" ? "queued" : "unconfigured";
      const { error } = await admin.from("telegram_delivery_jobs").insert({
        event_key: eventKey,
        bot_key: bot,
        category: input.category,
        chat_id: status === "queued" ? env.chatId : null,
        body,
        status,
        legacy_outcome: status === "queued" ? "not_used" : "attempt_started",
        next_attempt_at: status === "queued" ? new Date().toISOString() : null,
        last_error: status === "unconfigured" ? "Bot token or chat was not set. Legacy outcome is recorded after the old sender returns." : null,
      });
      if (error) {
        if (/duplicate|unique/i.test(error.message)) return { persisted: true, legacy: false, reason: "duplicate" };
        return { persisted: false, legacy: true, reason: "tables_missing" };
      }
      persisted = true;
      return { persisted: true, legacy, reason: status };
    }
    const row = existingRow as { id: string; status: DeliveryJobStatus };
    if (decision.action === "promote") {
      const promoted = await promoteJob(admin, row.id, env.chatId);
      persisted = true;
      return { persisted: true, legacy: false, reason: promoted ? "promoted" : "owned" };
    }
    persisted = true;
    return { persisted: true, legacy: false, reason: "owned" };
  } catch {
    return {
      persisted,
      legacy: persisted ? legacy : true,
      reason: persisted ? (legacy ? "unconfigured" : "owned") : "enqueue_failed",
    };
  }
}

export async function enqueueIncident(input: {
  source: string;
  code?: string | null;
  outcome?: string | null;
  severity?: Severity;
  adminPath?: string;
}): Promise<{ sent: boolean; reason: string }> {
  const clean = sanitizeSecurityAlert({ area: input.source, code: input.code, outcome: input.outcome });
  const severity = input.severity ?? incidentSeverity(clean.area);
  const fingerprint = incidentFingerprint(clean.area, clean.outcome);
  const admin = createAdminClient();
  if (!admin) return { sent: false, reason: "database_unavailable" };
  const now = Date.now();
  const { data, error } = await admin
    .from("telegram_incidents")
    .select("last_sent_at, seen_count")
    .eq("fingerprint", fingerprint)
    .maybeSingle();
  if (error) return { sent: false, reason: "tables_missing" };
  const row = data as { last_sent_at?: string | null; seen_count?: number } | null;
  const lastSent = row?.last_sent_at ? Date.parse(row.last_sent_at) : null;
  const allow = incidentShouldSend({ severity, lastSentMs: lastSent, nowMs: now });
  await admin.from("telegram_incidents").upsert({
    fingerprint,
    severity,
    title: clean.text.slice(0, 180),
    seen_count: (row?.seen_count ?? 0) + 1,
    last_seen_at: new Date(now).toISOString(),
    last_sent_at: allow ? new Date(now).toISOString() : row?.last_sent_at ?? null,
  });
  if (!allow) return { sent: false, reason: "grouped" };
  const result = await enqueueAlert({
    category: "app_error",
    eventKey: `incident:${fingerprint}:${Math.floor(now / 60000)}`,
    source: "ledger",
    reference: clean.code ?? clean.area,
    detail: clean.text,
    adminPath: input.adminPath ?? "/admin/telegram-center",
  });
  return { sent: result.persisted && !result.legacy, reason: result.reason };
}

async function promoteJob(admin: Admin, jobId: string, chatId: string): Promise<boolean> {
  const { data } = await admin
    .from("telegram_delivery_jobs")
    .update({
      status: "queued",
      chat_id: chatId,
      next_attempt_at: new Date().toISOString(),
      last_error: "Queued after the bot was configured. The earlier state was unconfigured.",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "unconfigured")
    .select("id")
    .maybeSingle();
  if (!data) return false;
  await admin.from("telegram_delivery_attempts").insert({
    job_id: jobId,
    outcome: "promoted",
    error: "unconfigured record queued after bot configuration",
  });
  return true;
}

async function recoverStaleSending(admin: Admin): Promise<number> {
  const cutoff = new Date(Date.now() - SENDING_STALE_MS).toISOString();
  const { data } = await admin
    .from("telegram_delivery_jobs")
    .select("id, updated_at")
    .eq("status", "sending")
    .lte("updated_at", cutoff)
    .limit(BATCH);
  let recovered = 0;
  for (const job of (data ?? []) as Array<{ id: string; updated_at: string }>) {
    if (staleSendingDecision(Date.parse(job.updated_at), Date.now()) !== "uncertain") continue;
    const { data: updated } = await admin
      .from("telegram_delivery_jobs")
      .update({
        status: "uncertain",
        next_attempt_at: null,
        last_error: "The send claim expired before Telegram answered. The message might already have been delivered, so it was not retried.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "sending")
      .select("id")
      .maybeSingle();
    if (!updated) continue;
    recovered += 1;
    await admin.from("telegram_delivery_attempts").insert({
      job_id: job.id,
      outcome: "uncertain",
      error: "stale sending claim",
    });
  }
  return recovered;
}

export async function recordLegacyOutcome(eventKey: string, outcome: LegacyOutcome): Promise<void> {
  const admin = createAdminClient();
  if (!admin || !eventKey.trim()) return;
  await admin
    .from("telegram_delivery_jobs")
    .update({
      legacy_outcome: outcome,
      last_error:
        outcome === "accepted"
          ? "The old sender received an API acceptance. This is not a read receipt, and the new bot will not send it again."
          : outcome === "uncertain"
            ? "The old sender did not get an answer. Delivery is uncertain, so the new bot will not send it again."
            : outcome === "unavailable"
              ? "The old sender did not send. The new bot may send this after it is configured."
              : outcome === "skipped"
                ? "The old sender skipped this event on purpose."
                : null,
      updated_at: new Date().toISOString(),
    })
    .eq("event_key", eventKey)
    .in("status", ["unconfigured", "needs_investigation"]);
}

export async function recordCashoutInvestigation(
  admin: SupabaseClient,
  amount: number | null
): Promise<{ eventKey: string } | null> {
  const eventKey = investigationEventKey(crypto.randomUUID());
  if (!eventKey) return null;
  const { error } = await admin.from("telegram_delivery_jobs").insert({
    event_key: eventKey,
    bot_key: "payments",
    category: "payout_requested",
    body: "Admin cash-out was recorded, but admin_payout_cashout did not return a wallet transaction id. This row is for investigation. It is not a provider confirmation and it is not a deduplicated transaction alert.",
    status: "needs_investigation",
    legacy_outcome: "attempt_started",
    last_error: amount == null ? "Amount was not stored on this investigation row." : `Amount on the admin form: ${amount.toFixed(2)}.`,
  });
  if (error) return null;
  return { eventKey };
}

async function promoteConfiguredJobs(admin: Admin): Promise<number> {
  const { data } = await admin
    .from("telegram_delivery_jobs")
    .select("id, bot_key, legacy_outcome")
    .eq("status", "unconfigured")
    .eq("legacy_outcome", "unavailable")
    .order("created_at", { ascending: true })
    .limit(BATCH);
  let promoted = 0;
  for (const job of (data ?? []) as Array<{ id: string; bot_key: TelegramBotKey; legacy_outcome?: LegacyOutcome | null }>) {
    const env = botEnv(job.bot_key);
    if (!env.token || !env.chatId) continue;
    if (await promoteJob(admin, job.id, env.chatId)) promoted += 1;
  }
  return promoted;
}

async function processDueJobs(admin: Admin, limit: number) {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("telegram_delivery_jobs")
    .select("id, bot_key, chat_id, body, attempt_count, status")
    .in("status", ["queued", "retry_pending"])
    .lte("next_attempt_at", now)
    .order("created_at", { ascending: true })
    .limit(Math.min(limit, BATCH));
  const totals = { attempted: 0, accepted: 0, failed: 0, uncertain: 0, retryPending: 0 };
  if (error || !data) return totals;
  for (const job of data as Array<{
    id: string;
    bot_key: TelegramBotKey;
    chat_id: string | null;
    body: string;
    attempt_count: number;
  }>) {
    const outcome = await sendJob(admin, job);
    if (!outcome) continue;
    totals.attempted += 1;
    if (outcome === "accepted") totals.accepted += 1;
    else if (outcome === "failed") totals.failed += 1;
    else if (outcome === "uncertain") totals.uncertain += 1;
    else if (outcome === "retry_pending") totals.retryPending += 1;
  }
  return totals;
}

export async function processTelegramDeliveryQueue(): Promise<ReturnType<typeof workerSummary> & { reason: string }> {
  const admin = createAdminClient();
  if (!admin) {
    return { ...workerSummary({ attempted: 0, accepted: 0, failed: 0, uncertain: 0, retryPending: 0, recovered: 0, promoted: 0 }), reason: "database_unavailable" };
  }
  const recovered = await recoverStaleSending(admin);
  const promoted = await promoteConfiguredJobs(admin);
  const totals = await processDueJobs(admin, BATCH);
  return { ...workerSummary({ ...totals, recovered, promoted }), reason: "ok" };
}

export async function sendTelegramText(
  token: string,
  chatId: string | number,
  text: string,
  html: boolean
): Promise<{
  httpStatus: number | null;
  ok: boolean | null;
  description: string | null;
  thrown: boolean;
  retryAfter: number | null;
  messageId: number | null;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TELEGRAM_NETWORK_TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 3500),
        parse_mode: html ? "HTML" : undefined,
        disable_web_page_preview: true,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    } | null;
    return {
      httpStatus: response.status,
      ok: Boolean(payload?.ok),
      description: payload?.description ?? null,
      thrown: false,
      retryAfter,
      messageId: payload?.result?.message_id ?? null,
    };
  } catch {
    return { httpStatus: null, ok: null, description: null, thrown: true, retryAfter: null, messageId: null };
  } finally {
    clearTimeout(timer);
  }
}

async function sendJob(
  admin: Admin,
  job: { id: string; bot_key: TelegramBotKey; chat_id: string | null; body: string; attempt_count: number }
): Promise<"accepted" | "failed" | "uncertain" | "retry_pending" | "unconfigured" | null> {
  const claimed = await admin
    .from("telegram_delivery_jobs")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .in("status", ["queued", "retry_pending"])
    .select("id")
    .maybeSingle();
  if (!claimed.data) return null;
  const env = botEnv(job.bot_key);
  const attempts = job.attempt_count + 1;
  if (!env.token || !job.chat_id) {
    await admin
      .from("telegram_delivery_jobs")
      .update({ status: "unconfigured", attempt_count: attempts, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    return "unconfigured";
  }
  const sent = await sendTelegramText(env.token, job.chat_id, job.body, true);
  const classified = classifyTelegramResponse({
    httpStatus: sent.httpStatus,
    ok: sent.ok,
    description: sent.description,
    thrown: sent.thrown,
  });
  if (classified.outcome === "retry" && sent.retryAfter != null) classified.retryAfterSeconds = sent.retryAfter;
  const decision = nextAttemptDecision({
    attempts,
    outcome: classified.outcome,
    retryAfterSeconds: classified.retryAfterSeconds,
    nowMs: Date.now(),
  });
  await admin.from("telegram_delivery_attempts").insert({
    job_id: job.id,
    outcome: classified.outcome,
    http_status: sent.httpStatus,
    error: sent.description ? sent.description.slice(0, 240) : sent.thrown ? "network error or timeout before a Telegram answer" : null,
  });
  await admin
    .from("telegram_delivery_jobs")
    .update({
      status: decision.status,
      attempt_count: attempts,
      next_attempt_at: decision.nextAttemptAt,
      last_error: sent.description
        ? sent.description.slice(0, 240)
        : sent.thrown
          ? "Telegram did not answer before the timeout. Delivery is uncertain and will not be retried."
          : null,
      telegram_message_id: sent.messageId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
  return decision.status;
}

export async function sendOwnerTest(): Promise<{ ok: boolean; error?: string }> {
  const env = botEnv("owner");
  if (!env.token || !env.chatId) return { ok: false, error: "The owner bot token or chat is not set." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Database is unavailable." };
  const eventKey = `owner-test:${crypto.randomUUID()}`;
  const { error } = await admin.from("telegram_delivery_jobs").insert({
    event_key: eventKey,
    bot_key: "owner",
    category: "account_status",
    chat_id: env.chatId,
    body: "Telegram Control Center test. This is not a payment and not a customer message.",
    status: "queued",
    next_attempt_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: "The test was not queued. Apply the Telegram SQL before sending a test." };
  return { ok: true };
}
