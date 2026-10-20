import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DELIVERY_COUNT_STATUSES,
  TELEGRAM_COVERAGE_CUTOFF,
  coveragePanelState,
  depositCreditCandidate,
  depositReversalCandidate,
  emailCoverageCandidate,
  escalationCoverageCandidate,
  exactDeliveryCounts,
  gameProviderCandidate,
  gameRequestCandidate,
  incidentCoverageMatch,
  payoutCoverageCandidate,
  signupCoverageCandidate,
  ticketCoverageCandidate,
  type CoverageCandidate,
  type CoverageFinding,
  type DeliveryCountStatus,
  type ExactDeliveryCounts,
} from "@/lib/telegram/control/rules";

const SCAN = 400;

type Admin = SupabaseClient;

export type DeliveryProblem = {
  status: "failed" | "uncertain";
  bot: string;
  category: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WaitingJob = {
  id: string;
  bot: string;
  category: string;
  status: string;
  createdAt: string;
};

export type TelegramMonitoring = {
  access: "hidden" | "ready";
  counts: { kind: "hidden" } | { kind: "unavailable" } | { kind: "ready"; summary: ExactDeliveryCounts };
  lastSuccess: { bot: string; category: string; createdAt: string; updatedAt: string } | null;
  problems: DeliveryProblem[];
  waiting: WaitingJob[];
  coverage:
    | { kind: "hidden" }
    | { kind: "unavailable" }
      | {
        kind: "ready";
        cutoff: string;
        truncated: boolean;
        unread: string[];
        confirmed: CoverageFinding[];
        unproven: CoverageFinding[];
      };
};

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function markIncomplete(candidates: CoverageCandidate[], start: number) {
  for (let index = start; index < candidates.length; index += 1) candidates[index].scanComplete = false;
}

function rowsOf(data: unknown): Row[] {
  return Array.isArray(data) ? (data as Row[]) : [];
}

async function statusCount(admin: Admin, status?: string): Promise<number | null> {
  let query = admin.from("telegram_delivery_jobs").select("id", { count: "exact", head: true });
  if (status) query = query.eq("status", status);
  const { count, error } = await query;
  if (error || count == null) return null;
  return count;
}

function registrationCompleted(meta: unknown): boolean {
  if (!meta || typeof meta !== "object") return false;
  const row = meta as Record<string, unknown>;
  if (row.offers_consent === true) return true;
  return typeof row.full_name === "string" && row.full_name.trim().length > 0;
}

async function existingKeys(admin: Admin, keys: string[]): Promise<Set<string> | null> {
  const found = new Set<string>();
  for (let index = 0; index < keys.length; index += 80) {
    const slice = keys.slice(index, index + 80);
    const { data, error } = await admin.from("telegram_delivery_jobs").select("event_key").in("event_key", slice);
    if (error) return null;
    for (const row of rowsOf(data)) {
      const key = text(row.event_key);
      if (key) found.add(key);
    }
  }
  return found;
}

type AuthFact = {
  id: string;
  createdAt: string;
  emailConfirmedAt: string | null;
  registrationCompleted: boolean;
};

async function loadAuthFacts(admin: Admin): Promise<{ rows: AuthFact[]; truncated: boolean; failed: boolean }> {
  const rows: AuthFact[] = [];
  const perPage = 200;
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) return { rows: [], truncated: false, failed: true };
    for (const user of data.users) {
      rows.push({
        id: user.id,
        createdAt: user.created_at,
        emailConfirmedAt: user.email_confirmed_at ?? null,
        registrationCompleted: registrationCompleted(user.user_metadata),
      });
    }
    if (data.users.length < perPage) return { rows, truncated: false, failed: false };
  }
  return { rows, truncated: true, failed: false };
}

async function loadCoverage(admin: Admin, isSuperAdmin: boolean): Promise<TelegramMonitoring["coverage"]> {
  if (!isSuperAdmin) return { kind: "hidden" };
  const cutoff = TELEGRAM_COVERAGE_CUTOFF;
  try {
    const [authFacts, tickets, conversations, loads, payouts, events, incidents, incidentJobs] = await Promise.all([
      loadAuthFacts(admin),
      admin.from("support_tickets").select("id, created_at").gte("created_at", cutoff).limit(SCAN),
      admin.from("conversations").select("id, human_requested_at").gte("human_requested_at", cutoff).limit(SCAN),
      admin.from("game_load_requests").select("id, status, load_type, error_message, source_key, updated_at").gte("updated_at", cutoff).limit(SCAN),
      admin.from("paydora_payout_requests").select("status, idempotency_key, updated_at").gte("updated_at", cutoff).limit(SCAN),
      admin.from("paydora_processed_events").select("payment_id, direction, created_at").gte("created_at", cutoff).limit(SCAN),
      admin.from("telegram_incidents").select("fingerprint, last_sent_at, seen_count").gte("last_sent_at", cutoff).limit(SCAN),
      admin.from("telegram_delivery_jobs").select("event_key").like("event_key", "incident:%").limit(SCAN),
    ]);
    const tableSources = [
      ["support tickets", tickets],
      ["chat escalations", conversations],
      ["game loads", loads],
      ["payouts", payouts],
      ["processed payments", events],
      ["incidents", incidents],
      ["incident jobs", incidentJobs],
    ] as const;
    const unread: string[] = tableSources.filter(([, source]) => source.error).map(([label]) => label);
    if (authFacts.failed) unread.push("signups and email confirmation");
    if (unread.length === tableSources.length + 1) return { kind: "unavailable" };

    const candidates: CoverageCandidate[] = [];
    const signupStart = candidates.length;
    if (!authFacts.failed) {
      for (const user of authFacts.rows) {
        if (!user.id || !user.createdAt) continue;
        candidates.push(signupCoverageCandidate({
          userId: user.id,
          occurredAt: user.createdAt,
          registrationCompleted: user.registrationCompleted,
        }));
        if (user.emailConfirmedAt) {
          candidates.push(emailCoverageCandidate({ userId: user.id, occurredAt: user.emailConfirmedAt }));
        }
      }
      if (authFacts.truncated) markIncomplete(candidates, signupStart);
    }
    const ticketStart = candidates.length;
    for (const row of rowsOf(tickets.error ? [] : tickets.data)) {
      const ticketId = text(row.id);
      const occurredAt = text(row.created_at);
      if (!ticketId || !occurredAt) continue;
      candidates.push(ticketCoverageCandidate({ ticketId, occurredAt }));
    }
    if (!tickets.error && rowsOf(tickets.data).length >= SCAN) markIncomplete(candidates, ticketStart);
    const escalationStart = candidates.length;
    for (const row of rowsOf(conversations.error ? [] : conversations.data)) {
      const conversationId = text(row.id);
      const occurredAt = text(row.human_requested_at);
      if (!conversationId || !occurredAt) continue;
      candidates.push(escalationCoverageCandidate({ conversationId, occurredAt }));
    }
    if (!conversations.error && rowsOf(conversations.data).length >= SCAN) markIncomplete(candidates, escalationStart);
    const loadStart = candidates.length;
    for (const row of rowsOf(loads.error ? [] : loads.data)) {
      const id = text(row.id);
      const occurredAt = text(row.updated_at);
      if (!id || !occurredAt) continue;
      const request = gameRequestCandidate({
        id,
        loadType: text(row.load_type),
        status: text(row.status),
        occurredAt,
      });
      if (request) candidates.push(request);
      const provider = gameProviderCandidate({
        id,
        status: text(row.status),
        errorMessage: text(row.error_message) || null,
        sourceKey: text(row.source_key) || null,
        occurredAt,
      });
      if (provider) candidates.push(provider);
    }
    if (!loads.error && rowsOf(loads.data).length >= SCAN) markIncomplete(candidates, loadStart);
    const payoutStart = candidates.length;
    for (const row of rowsOf(payouts.error ? [] : payouts.data)) {
      const payout = payoutCoverageCandidate({
        status: text(row.status),
        idempotencyKey: text(row.idempotency_key),
        occurredAt: text(row.updated_at),
      });
      if (payout) candidates.push(payout);
    }
    if (!payouts.error && rowsOf(payouts.data).length >= SCAN) markIncomplete(candidates, payoutStart);
    const eventStart = candidates.length;
    for (const row of rowsOf(events.error ? [] : events.data)) {
      const paymentId = text(row.payment_id);
      const direction = text(row.direction);
      const occurredAt = text(row.created_at);
      const credit = depositCreditCandidate({ paymentId, direction, occurredAt });
      if (credit) candidates.push(credit);
      const reversal = depositReversalCandidate({ paymentId, direction, occurredAt });
      if (reversal) candidates.push(reversal);
    }
    if (!events.error && rowsOf(events.data).length >= SCAN) markIncomplete(candidates, eventStart);

    const incidentKeys = rowsOf(incidentJobs.error ? [] : incidentJobs.data).map((row) => text(row.event_key)).filter(Boolean);
    const incidentFindings: CoverageFinding[] = [];
    for (const row of rowsOf(incidents.error || incidentJobs.error ? [] : incidents.data)) {
      const seen = Number(row.seen_count);
      const finding = incidentCoverageMatch({
        fingerprint: text(row.fingerprint),
        lastSentAt: text(row.last_sent_at) || null,
        seenCount: Number.isFinite(seen) ? seen : 0,
        cutoff,
        eventKeys: incidentKeys,
      });
      if (finding) incidentFindings.push(finding);
    }
    if (!incidents.error && !incidentJobs.error && (rowsOf(incidents.data).length >= SCAN || rowsOf(incidentJobs.data).length >= SCAN)) {
      for (const finding of incidentFindings) finding.scanComplete = false;
    }

    const keys = await existingKeys(admin, candidates.map((candidate) => candidate.eventKey));
    if (!keys) return { kind: "unavailable" };
    const scanned = [tickets, conversations, loads, payouts, events, incidents, incidentJobs];
    const panel = coveragePanelState({
      isSuperAdmin,
      queryFailed: false,
      truncated: authFacts.truncated || scanned.some((source) => !source.error && rowsOf(source.data).length >= SCAN),
      cutoff,
      candidates,
      existingEventKeys: [...keys],
    });
    if (panel.kind !== "ready") return panel;
    return {
      ...panel,
      unread,
      confirmed: [...panel.confirmed, ...incidentFindings],
      unproven: panel.unproven,
    };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Read-only delivery totals and missing-alert comparison. Does not insert, update, or send. */
export async function loadTelegramMonitoring(admin: Admin, isSuperAdmin: boolean): Promise<TelegramMonitoring> {
  if (!isSuperAdmin) {
    return { access: "hidden", counts: { kind: "hidden" }, lastSuccess: null, problems: [], waiting: [], coverage: { kind: "hidden" } };
  }
  const countResults = await Promise.all([
    statusCount(admin),
    ...DELIVERY_COUNT_STATUSES.map((status) => statusCount(admin, status)),
  ]);
  const [total, ...statusValues] = countResults;
  const counts: Partial<Record<DeliveryCountStatus, number | null>> = {};
  DELIVERY_COUNT_STATUSES.forEach((status, index) => {
    counts[status] = statusValues[index] ?? null;
  });
  const [successQuery, problemQuery, waitingQuery, coverage] = await Promise.all([
    admin
      .from("telegram_delivery_jobs")
      .select("bot_key, category, created_at, updated_at")
      .eq("status", "accepted")
      .order("updated_at", { ascending: false })
      .limit(1),
    admin
      .from("telegram_delivery_jobs")
      .select("status, bot_key, category, created_at, updated_at, last_error")
      .in("status", ["failed", "uncertain"])
      .order("updated_at", { ascending: false })
      .limit(5),
    admin
      .from("telegram_delivery_jobs")
      .select("id, bot_key, category, status, created_at")
      .in("status", ["queued", "retry_pending"])
      .order("created_at", { ascending: true })
      .limit(20),
    loadCoverage(admin, true),
  ]);
  const success = rowsOf(successQuery.data)[0];
  const problems: DeliveryProblem[] = problemQuery.error
    ? []
    : rowsOf(problemQuery.data).flatMap((row) => {
        const status = text(row.status);
        if (status !== "failed" && status !== "uncertain") return [];
        return [{
          status,
          bot: text(row.bot_key),
          category: text(row.category),
          error: text(row.last_error) || null,
          createdAt: text(row.created_at),
          updatedAt: text(row.updated_at),
        }];
      });
  return {
    access: "ready",
    counts: exactDeliveryCounts({
      isSuperAdmin: true,
      queryFailed: countResults.some((value) => value == null),
      counts,
      total,
    }),
    lastSuccess: success
      ? {
          bot: text(success.bot_key),
          category: text(success.category),
          createdAt: text(success.created_at),
          updatedAt: text(success.updated_at),
        }
      : null,
    problems,
    waiting: waitingQuery.error
      ? []
      : rowsOf(waitingQuery.data).map((row) => ({
          id: text(row.id),
          bot: text(row.bot_key),
          category: text(row.category),
          status: text(row.status),
          createdAt: text(row.created_at),
        })),
    coverage,
  };
}
