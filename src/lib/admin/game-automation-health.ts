import "server-only";

import { FireKirinApiClient } from "@/lib/game-automation/firekirin-api";
import { MilkyWayApiClient } from "@/lib/game-automation/milkyway-api";
import { SupabaseTransferStore } from "@/lib/game-automation/supabase-transfer-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServiceRoleKey } from "@/lib/supabase/env";

export type Capability = "working" | "failed" | "unverified" | "unavailable" | "blocked";

export type AutomationProviderRow = {
  id: "fire-kirin" | "milky-way" | "orion-stars" | "panda-master";
  name: string;
  connection: Capability;
  connectionDetail: string;
  lastAuthentication: string;
  agentBalance: string;
  lastRefresh: string;
  playerLookup: Capability;
  accountCreation: Capability;
  recharge: Capability;
  redemption: Capability;
  pause: "paused" | "resumed" | "not_installed" | "none";
  pauseReason: string;
};

export type ReviewRow = {
  operationKey: string;
  provider: string;
  action: string;
  state: string;
  amount: number;
  message: string;
  updatedAt: string;
};

const SECRET_NAMES = [
  "FIREKIRIN_AGENT_USERNAME",
  "FIREKIRIN_AGENT_PASSWORD",
  "MILKYWAY_AGENT_USERNAME",
  "MILKYWAY_AGENT_PASSWORD",
  "ORIONSTARS_AGENT_USERNAME",
  "ORIONSTARS_AGENT_PASSWORD",
  "PANDA_MASTER_AGENT_USERNAME",
  "PANDA_MASTER_AGENT_PASSWORD",
];

function redact(error: unknown): string {
  let text = error instanceof Error ? error.message : "Could not read this provider.";
  for (const name of SECRET_NAMES) {
    const value = process.env[name];
    if (value && value.length > 2) text = text.split(value).join("[redacted]");
  }
  return text.replace(/\s+/g, " ").slice(0, 160);
}

function money(value: number | null): string {
  if (value === null) return "Not returned";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

async function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("The provider did not answer in time.")), 12000);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readAgent(kind: "fire-kirin" | "milky-way"): Promise<{ ok: boolean; balance: number | null; detail: string }> {
  try {
    const balance = await withTimeout(
      kind === "fire-kirin"
        ? new FireKirinApiClient({ proxyUrl: null }).getAgentBalance()
        : new MilkyWayApiClient({ proxyUrl: null }).getFreshSession().then((session) => session.balance)
    );
    return { ok: true, balance, detail: "Agent login succeeded on this refresh." };
  } catch (error) {
    return { ok: false, balance: null, detail: redact(error) };
  }
}

export async function loadGameAutomationHealth(): Promise<{
  rows: AutomationProviderRow[];
  reviews: ReviewRow[];
  counts: { installed: boolean; pending: number | null; submitted: number | null; unknown: number | null; manualReview: number | null };
  ledgerNote: string;
}> {
  const store = new SupabaseTransferStore();
  const counts = await store.counts();
  const checkedAt = new Date().toISOString();
  const [fire, milky] = await Promise.all([readAgent("fire-kirin"), readAgent("milky-way")]);

  const pauses = new Map<string, { paused: boolean; reason: string }>();
  const reviews: ReviewRow[] = [];
  const db = getSupabaseServiceRoleKey() ? createAdminClient() : null;
  if (db && counts.installed) {
    const { data: controls } = await db.from("provider_automation_controls").select("provider, paused, reason");
    for (const row of (controls || []) as { provider: string; paused: boolean; reason: string | null }[]) {
      pauses.set(row.provider, { paused: row.paused, reason: row.reason || "" });
    }
    const { data: openRows } = await db
      .from("provider_transfer_operations")
      .select("operation_key, provider, action, state, amount, provider_message, updated_at")
      .in("state", ["pending", "submitted", "unknown", "manual_review"])
      .order("updated_at", { ascending: false })
      .limit(25);
    for (const row of (openRows || []) as {
      operation_key: string;
      provider: string;
      action: string;
      state: string;
      amount: number;
      provider_message: string | null;
      updated_at: string;
    }[]) {
      reviews.push({
        operationKey: row.operation_key,
        provider: row.provider,
        action: row.action,
        state: row.state,
        amount: Number(row.amount),
        message: (row.provider_message || "").slice(0, 160),
        updatedAt: row.updated_at,
      });
    }
  }

  function pauseFor(id: string): AutomationProviderRow["pause"] {
    if (id === "panda-master") return "none";
    if (!counts.installed) return "not_installed";
    const row = pauses.get(id);
    if (!row) return "paused";
    return row.paused ? "paused" : "resumed";
  }

  const rows: AutomationProviderRow[] = [
    {
      id: "fire-kirin",
      name: "Fire Kirin",
      connection: fire.ok ? "working" : "failed",
      connectionDetail: fire.detail,
      lastAuthentication: fire.ok ? checkedAt : "No successful authentication on this refresh.",
      agentBalance: fire.ok ? money(fire.balance) : "Not read",
      lastRefresh: checkedAt,
      playerLookup: "unverified",
      accountCreation: "unverified",
      recharge: "unverified",
      redemption: "unverified",
      pause: pauseFor("fire-kirin"),
      pauseReason: pauses.get("fire-kirin")?.reason || "The ledger is not installed, so a transfer cannot be claimed.",
    },
    {
      id: "milky-way",
      name: "Milky Way",
      connection: milky.ok ? "working" : "failed",
      connectionDetail: milky.detail,
      lastAuthentication: milky.ok ? checkedAt : "No successful authentication on this refresh.",
      agentBalance: milky.ok ? money(milky.balance) : "Not read",
      lastRefresh: checkedAt,
      playerLookup: "unverified",
      accountCreation: "unverified",
      recharge: "unverified",
      redemption: "unverified",
      pause: pauseFor("milky-way"),
      pauseReason: pauses.get("milky-way")?.reason || "The ledger is not installed, so a transfer cannot be claimed.",
    },
    {
      id: "orion-stars",
      name: "Orion Stars",
      connection: "working",
      connectionDetail: "Agent login succeeded on 17 Oct 2026 and the agent balance was a confirmed zero. Player loads stay closed until the ledger is applied. This page does not log in again.",
      lastAuthentication: "2026-10-17 supervised read-only check",
      agentBalance: "Confirmed zero on that check",
      lastRefresh: "2026-10-17 supervised read-only check",
      playerLookup: "unverified",
      accountCreation: "unverified",
      recharge: "unverified",
      redemption: "unverified",
      pause: pauseFor("orion-stars"),
      pauseReason: pauses.get("orion-stars")?.reason || "Blocked until a valid agent login is confirmed.",
    },
    {
      id: "panda-master",
      name: "Panda Master",
      connection: "unavailable",
      connectionDetail: "No official API document, endpoint, or authentication method is on file.",
      lastAuthentication: "None. No API client exists.",
      agentBalance: "Unavailable",
      lastRefresh: "Not available",
      playerLookup: "unavailable",
      accountCreation: "unavailable",
      recharge: "unavailable",
      redemption: "unavailable",
      pause: "none",
      pauseReason: "There is no client to pause.",
    },
  ];

  return {
    rows,
    reviews,
    counts,
    ledgerNote: counts.installed
      ? "The transfer ledger is installed."
      : "The transfer ledger migration has not been applied. Money calls fail closed and are not sent.",
  };
}
