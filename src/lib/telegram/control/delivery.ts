import "server-only";

import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/constants";
import {
  BOT_ENV,
  LINK_PEPPER_ENV,
  alertText,
  botForCategory,
  classifyTelegramResponse,
  duplicateJobDecision,
  incidentFingerprint,
  incidentShouldSend,
  nextAttemptDecision,
  parseRetryAfter,
  type AlertCategory,
  type Severity,
  type TelegramBotKey,
} from "@/lib/telegram/control/rules";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const BATCH = 8;

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

export async function enqueueAlert(input: {
  category: AlertCategory;
  eventKey: string;
  source: "provider" | "ledger" | "admin";
  reference: string;
  amount?: number | null;
  detail?: string | null;
  adminPath?: string | null;
}): Promise<{ queued: boolean; reason: string }> {
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
    if (!admin) return { queued: false, reason: "database_unavailable" };
    const eventKey = input.eventKey.trim().slice(0, 160);
    if (!eventKey) return { queued: false, reason: "missing_event" };
    const { data: existing, error: readError } = await admin
      .from("telegram_delivery_jobs")
      .select("status")
      .eq("event_key", eventKey)
      .maybeSingle();
    if (readError) return { queued: false, reason: "tables_missing" };
    if (duplicateJobDecision((existing as { status: string } | null) ?? null) === "skip") {
      return { queued: false, reason: "duplicate" };
    }
    const configured = Boolean(env.token && env.chatId);
    const { error } = await admin.from("telegram_delivery_jobs").insert({
      event_key: eventKey,
      bot_key: bot,
      category: input.category,
      chat_id: configured ? env.chatId : null,
      body,
      status: configured ? "queued" : "unconfigured",
      next_attempt_at: configured ? new Date().toISOString() : null,
    });
    if (error) {
      if (/duplicate|unique/i.test(error.message)) return { queued: false, reason: "duplicate" };
      return { queued: false, reason: "tables_missing" };
    }
    if (configured) {
      await processDueJobs(admin, 3);
    }
    return { queued: true, reason: configured ? "queued" : "unconfigured" };
  } catch {
    return { queued: false, reason: "enqueue_failed" };
  }
}

export async function enqueueIncident(input: {
  source: string;
  message: string;
  severity: Severity;
  adminPath?: string;
}): Promise<{ sent: boolean; reason: string }> {
  const fingerprint = incidentFingerprint(input.source, input.message);
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
  const allow = incidentShouldSend({ severity: input.severity, lastSentMs: lastSent, nowMs: now });
  await admin.from("telegram_incidents").upsert({
    fingerprint,
    severity: input.severity,
    title: input.message.slice(0, 180),
    seen_count: (row?.seen_count ?? 0) + 1,
    last_seen_at: new Date(now).toISOString(),
    last_sent_at: allow ? new Date(now).toISOString() : row?.last_sent_at ?? null,
  });
  if (!allow) return { sent: false, reason: "grouped" };
  const result = await enqueueAlert({
    category: "app_error",
    eventKey: `incident:${fingerprint}:${Math.floor(now / 60000)}`,
    source: "ledger",
    reference: fingerprint.slice(0, 40),
    detail: `${input.severity}: ${input.message}`,
    adminPath: input.adminPath ?? "/admin/telegram-center",
  });
  return { sent: result.queued, reason: result.reason };
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
  if (error || !data) return;
  for (const job of data as Array<{
    id: string;
    bot_key: TelegramBotKey;
    chat_id: string | null;
    body: string;
    attempt_count: number;
  }>) {
    await sendJob(admin, job);
  }
}

export async function processTelegramDeliveryQueue(): Promise<{ processed: number; reason?: string }> {
  const admin = createAdminClient();
  if (!admin) return { processed: 0, reason: "database_unavailable" };
  const before = Date.now();
  await processDueJobs(admin, BATCH);
  return { processed: Math.min(BATCH, 8), reason: `bounded ${Date.now() - before}ms` };
}

async function sendJob(
  admin: Admin,
  job: { id: string; bot_key: TelegramBotKey; chat_id: string | null; body: string; attempt_count: number }
) {
  const claimed = await admin
    .from("telegram_delivery_jobs")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .in("status", ["queued", "retry_pending"])
    .select("id")
    .maybeSingle();
  if (!claimed.data) return;
  const env = botEnv(job.bot_key);
  const attempts = job.attempt_count + 1;
  if (!env.token || !job.chat_id) {
    await admin
      .from("telegram_delivery_jobs")
      .update({ status: "unconfigured", attempt_count: attempts, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    return;
  }
  let httpStatus: number | null = null;
  let ok: boolean | null = null;
  let description: string | null = null;
  let thrown = false;
  let retryAfter: number | null = null;
  let messageId: number | null = null;
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: job.chat_id,
        text: job.body,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      cache: "no-store",
    });
    httpStatus = response.status;
    retryAfter = parseRetryAfter(response.headers.get("retry-after"));
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    } | null;
    ok = Boolean(payload?.ok);
    description = payload?.description ?? null;
    messageId = payload?.result?.message_id ?? null;
  } catch {
    thrown = true;
  }
  const classified = classifyTelegramResponse({ httpStatus, ok, description, thrown });
  if (classified.outcome === "retry" && retryAfter != null) classified.retryAfterSeconds = retryAfter;
  const decision = nextAttemptDecision({
    attempts,
    outcome: classified.outcome,
    retryAfterSeconds: classified.retryAfterSeconds,
    nowMs: Date.now(),
  });
  await admin.from("telegram_delivery_attempts").insert({
    job_id: job.id,
    outcome: classified.outcome,
    http_status: httpStatus,
    error: description ? description.slice(0, 240) : thrown ? "network error before a Telegram answer" : null,
  });
  await admin
    .from("telegram_delivery_jobs")
    .update({
      status: decision.status,
      attempt_count: attempts,
      next_attempt_at: decision.nextAttemptAt,
      last_error: description ? description.slice(0, 240) : thrown ? "Telegram did not answer. Delivery is uncertain." : null,
      telegram_message_id: messageId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
}

export async function sendOwnerTest(): Promise<{ ok: boolean; error?: string }> {
  const env = botEnv("owner");
  if (!env.token || !env.chatId) return { ok: false, error: "The owner bot token or chat is not set." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Database is unavailable." };
  const eventKey = `owner-test:${Date.now()}`;
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
  await processDueJobs(admin, 1);
  return { ok: true };
}
