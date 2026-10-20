import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAudit } from "@/lib/actions/admin/core";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueAlert, botEnv } from "@/lib/telegram/control/delivery";
import {
  TELEGRAM_COVERAGE_CUTOFF,
  botForCategory,
  providerAlertCategory,
  recoveryDestinationDecision,
  recoveryInsertDecision,
  recoveryReferenceAllowed,
  type AlertCategory,
  type RecoveryKind,
} from "@/lib/telegram/control/rules";

type Admin = SupabaseClient;

type Plan = {
  category: AlertCategory;
  eventKey: string;
  reference: string;
  amount?: number | null;
  detail?: string | null;
  adminPath: string;
  source: "provider" | "ledger" | "admin";
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function onOrAfter(value: string): boolean {
  const at = Date.parse(value);
  return Number.isFinite(at) && at >= Date.parse(TELEGRAM_COVERAGE_CUTOFF);
}

function registrationCompleted(meta: unknown): boolean {
  if (!meta || typeof meta !== "object") return false;
  const row = meta as Record<string, unknown>;
  if (row.offers_consent === true) return true;
  return typeof row.full_name === "string" && row.full_name.trim().length > 0;
}

async function planFor(admin: Admin, kind: RecoveryKind, reference: string): Promise<Plan | null> {
  if (kind === "signup") {
    const { data, error } = await admin.auth.admin.getUserById(reference);
    if (error || !data.user || !onOrAfter(data.user.created_at) || !registrationCompleted(data.user.user_metadata)) return null;
    return { category: "signup", eventKey: `signup:${reference}`, reference, source: "ledger", adminPath: "/admin/users" };
  }
  if (kind === "ticket") {
    const { data, error } = await admin.from("support_tickets").select("id, created_at").eq("id", reference).maybeSingle();
    const row = data as { created_at?: string } | null;
    if (error || !row?.created_at || !onOrAfter(row.created_at)) return null;
    return {
      category: "ticket_opened",
      eventKey: `ticket:${reference}`,
      reference,
      source: "ledger",
      detail: "A player opened a support ticket.",
      adminPath: "/admin/support",
    };
  }
  if (kind === "escalation") {
    const { data, error } = await admin.from("conversations").select("id, human_requested_at").eq("id", reference).maybeSingle();
    const row = data as { human_requested_at?: string | null } | null;
    if (error || !row?.human_requested_at || !onOrAfter(row.human_requested_at)) return null;
    return {
      category: "ticket_escalated",
      eventKey: `escalation:${reference}`,
      reference,
      source: "ledger",
      detail: "A player asked for a person in chat.",
      adminPath: "/admin/chat",
    };
  }
  if (kind === "game_request" || kind === "game_provider") {
    const { data, error } = await admin
      .from("game_load_requests")
      .select("id, status, load_type, game_name, amount, error_message, source_key, updated_at")
      .eq("id", reference)
      .maybeSingle();
    const row = data as {
      status?: string;
      load_type?: string;
      game_name?: string;
      amount?: number | null;
      error_message?: string | null;
      source_key?: string | null;
      updated_at?: string;
    } | null;
    if (error || !row?.updated_at || !onOrAfter(row.updated_at)) return null;
    if ((row.source_key ?? "").startsWith("auto:") || (row.source_key ?? "").startsWith("auto-account:")) return null;
    if (kind === "game_request") {
      const type = (row.load_type ?? "").toLowerCase();
      if (row.status !== "completed" || !["create_account", "load", "redeem"].includes(type)) return null;
      const amount = Number(row.amount);
      return {
        category: "load_requested",
        eventKey: `game-request:${reference}`,
        reference,
        amount: Number.isFinite(amount) ? amount : null,
        source: "ledger",
        detail: `${type} opened for ${row.game_name || "a game"}. This is a request, not a finished provider result.`,
        adminPath: "/admin/game-loads",
      };
    }
    if (!(row.error_message ?? "").startsWith("Needs review")) return null;
    return {
      category: providerAlertCategory(row.error_message ?? "", "unknown"),
      eventKey: `game-provider:${reference}`,
      reference,
      source: "provider",
      detail: "A game provider request did not finish. This notice does not change a balance.",
      adminPath: "/admin/game-loads",
    };
  }
  if (kind === "payout_paid" || kind === "payout_failed") {
    const { data, error } = await admin
      .from("paydora_payout_requests")
      .select("status, amount, provider_withdrawal_id, updated_at")
      .eq("idempotency_key", reference)
      .maybeSingle();
    const row = data as { status?: string; amount?: number | null; provider_withdrawal_id?: string | null; updated_at?: string } | null;
    if (error || !row?.updated_at || !onOrAfter(row.updated_at)) return null;
    const paid = kind === "payout_paid";
    if ((paid && row.status !== "paid") || (!paid && row.status !== "failed")) return null;
    const amount = Number(row.amount);
    return {
      category: paid ? "payout_provider_paid" : "payout_failed",
      eventKey: paid ? `payout:${reference}:paid` : `payout-failed:${reference}`,
      reference: row.provider_withdrawal_id || reference,
      amount: Number.isFinite(amount) ? amount : null,
      source: "provider",
      detail: paid ? "The provider status was paid." : "The provider rejected this cash-out.",
      adminPath: "/admin/payouts",
    };
  }
  if (kind === "deposit_credited" || kind === "deposit_reversed") {
    const reversed = kind === "deposit_reversed";
    const { data, error } = await admin
      .from("paydora_processed_events")
      .select("payment_id, direction, amount, created_at")
      .eq("payment_id", reversed ? `refund:${reference}` : reference)
      .maybeSingle();
    const row = data as { direction?: string; amount?: number | null; created_at?: string } | null;
    if (error || !row?.created_at || !onOrAfter(row.created_at)) return null;
    if ((reversed && row.direction !== "debit") || (!reversed && row.direction !== "credit")) return null;
    const amount = Number(row.amount);
    return {
      category: reversed ? "refund_confirmed" : "deposit_credited",
      eventKey: reversed ? `deposit-reversed:${reference}` : `deposit-credited:${reference}`,
      reference,
      amount: Number.isFinite(amount) ? amount : null,
      source: reversed ? "provider" : "ledger",
      detail: reversed ? "The provider reported this deposit refunded." : "The wallet credit was recorded after the provider callback.",
      adminPath: "/admin/deposits",
    };
  }
  const { data, error } = await admin
    .from("telegram_incidents")
    .select("fingerprint, title, last_sent_at, seen_count")
    .eq("fingerprint", reference)
    .maybeSingle();
  const row = data as { title?: string; last_sent_at?: string | null; seen_count?: number } | null;
  if (error || !row?.last_sent_at || !onOrAfter(row.last_sent_at) || !(row.title ?? "").trim() || (row.seen_count ?? 0) < 1) return null;
  const bucket = Math.floor(Date.parse(row.last_sent_at) / 60000);
  return {
    category: "app_error",
    eventKey: `incident:${reference}:${bucket}`,
    reference,
    source: "ledger",
    detail: row.title,
    adminPath: "/admin/telegram-center",
  };
}

/** Re-reads one business event and inserts its original event key once. Does not change money. */
export async function recoverMissingNotification(input: {
  actorId: string;
  kind: RecoveryKind;
  reference: string;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const reference = input.reference.trim();
  if (!recoveryReferenceAllowed(input.kind, reference)) return { ok: false, error: "That recovery target is not valid." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "The recovery could not be checked." };
  const plan = await planFor(admin, input.kind, reference);
  if (!plan) return { ok: false, error: "That event is no longer eligible. Nothing was sent." };
  const existing = await admin.from("telegram_delivery_jobs").select("status").eq("event_key", plan.eventKey).maybeSingle();
  if (existing.error) return { ok: false, error: "The delivery record could not be read. Nothing was sent." };
  const status = text((existing.data as { status?: string } | null)?.status) || null;
  if (recoveryInsertDecision(status) === "refuse") {
    return { ok: false, error: `A ${status} delivery job already exists. It was not sent again.` };
  }
  const env = botEnv(botForCategory(plan.category));
  if (recoveryDestinationDecision({ token: Boolean(env.token), chat: Boolean(env.chatId) }) === "missing") {
    return { ok: false, error: "That bot token or chat is not set. Nothing was sent." };
  }
  const audited = await writeAudit({
    actorId: input.actorId,
    action: "telegram.recover_missing",
    entityType: "telegram_delivery_job",
    entityId: plan.eventKey,
    after: { kind: input.kind, reference },
  });
  if (!audited) return { ok: false, error: "The recovery was not recorded, so nothing was sent." };
  const saved = await enqueueAlert({
    category: plan.category,
    eventKey: plan.eventKey,
    source: plan.source,
    reference: plan.reference,
    amount: plan.amount,
    detail: plan.detail,
    adminPath: plan.adminPath,
  });
  if (!saved.persisted || saved.reason === "duplicate" || saved.reason === "owned") {
    return { ok: false, error: "A delivery job already exists. Nothing new was sent." };
  }
  return { ok: true, message: "The alert was queued. Telegram acceptance does not mean a person read it." };
}
