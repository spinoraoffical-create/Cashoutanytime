import "server-only";

import { adminDb } from "@/lib/actions/admin/core";
import { adminListScope, idsOrNone } from "@/lib/admin/list-scope";
import {
  planPayoutQuery,
  showHoldNote,
  showPayoutMethod,
  showPayoutStatus,
  showProviderStatus,
  type ShownField,
} from "@/lib/admin/payout-operations-guard";
import { readAgentScope } from "@/lib/agents/scope";
import { profileDisplayName, type ProfileRow } from "@/lib/admin/spinora-profile";
import { can, getStaffContext } from "@/lib/data/admin";

export {
  PAYOUT_STATUSES,
  payoutStatusHelp,
  type PayoutQueryPlan,
  type ShownField,
} from "@/lib/admin/payout-operations-guard";

export type PayoutReadScope = { mode: "all" } | { mode: "network"; userIds: string[] };

export type PayoutOperationRow = {
  id: string;
  userId: string;
  playerName: string;
  playerEmail: string;
  amount: number;
  method: ShownField;
  status: string;
  providerStatus: ShownField;
  note: ShownField;
  createdAt: string;
  updatedAt: string;
};

const PAGE_SIZE = 20;
const SELECT =
  "id, user_id, amount, method, status, provider_status, hold_reason, created_at, updated_at";

type RawRow = {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  status: string;
  provider_status: string | null;
  hold_reason: string | null;
  created_at: string;
  updated_at: string;
};

function toRow(row: RawRow, names: Map<string, { name: string; email: string }>): PayoutOperationRow {
  const player = names.get(row.user_id);
  const status = showPayoutStatus(row.status);
  return {
    id: row.id,
    userId: row.user_id,
    playerName: player?.name || "Player",
    playerEmail: player?.email || "",
    amount: Number(row.amount),
    method: showPayoutMethod(row.method),
    status: status.state === "visible" ? status.value : "not shown",
    providerStatus: showProviderStatus(row.provider_status),
    note: showHoldNote(row.hold_reason),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function playerNames(userIds: string[]) {
  const names = new Map<string, { name: string; email: string }>();
  if (!userIds.length) return names;
  const db = adminDb();
  const { data } = await db.from("profiles").select("id, full_name, email").in("id", userIds);
  for (const row of (data ?? []) as ProfileRow[]) {
    if (!row.id) continue;
    names.set(row.id, { name: profileDisplayName(row), email: row.email?.trim() || "" });
  }
  return names;
}

async function matchingPlayerIds(q: string, scope: PayoutReadScope) {
  const db = adminDb();
  let query = db.from("profiles").select("id").or(`email.ilike.%${q}%,full_name.ilike.%${q}%`).limit(200);
  if (scope.mode === "network") query = query.in("id", idsOrNone(scope.userIds));
  const { data, error } = await query;
  if (error) return { ids: [] as string[], error: error.message };
  return { ids: ((data ?? []) as { id: string }[]).map((row) => row.id), error: null };
}

function searchText(value: string) {
  return value.trim().slice(0, 80).replace(/[%_,]/g, "");
}

function isPayoutStatus(value: string) {
  return ["requested", "reserved", "submitted", "paid", "failed", "manual_review"].includes(value);
}

/** Staff and network scope finish before any payout-table read. */
export async function resolvePayoutReadPlan() {
  const ctx = await getStaffContext();
  const scopeResult = await readAgentScope();
  const decision = adminListScope({
    isSuperAdmin: Boolean(ctx?.isSuperAdmin),
    hasStaffPermission: Boolean(ctx && can(ctx, "requests.manage")),
    scopeStatus: scopeResult.status,
    scope: scopeResult.scope
      ? { level: scopeResult.scope.level, parentIds: scopeResult.scope.parentIds }
      : null,
  });
  if (decision.mode !== "network") return planPayoutQuery({ decision, networkLookup: null });
  const db = adminDb();
  const { data, error } = await db
    .from("profiles")
    .select("id")
    .in("parent_agent_id", idsOrNone(decision.parentIds))
    .limit(1000);
  if (error) return planPayoutQuery({ decision, networkLookup: { ok: false } });
  const userIds = ((data ?? []) as { id: string }[]).map((row) => row.id);
  return planPayoutQuery({ decision, networkLookup: { ok: true, userIds } });
}

export async function loadPayoutOperations(input: {
  scope: PayoutReadScope;
  q: string;
  status: string;
  page: number;
}) {
  const page = Math.max(1, input.page);
  const empty = { rows: [] as PayoutOperationRow[], total: 0, error: null as string | null, page, pageSize: PAGE_SIZE };
  if (input.scope.mode === "network" && input.scope.userIds.length === 0) return empty;

  const db = adminDb();
  const q = searchText(input.q);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const status = isPayoutStatus(input.status) ? input.status : "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);

  let nameIds: string[] = [];
  if (q) {
    const matched = await matchingPlayerIds(q, input.scope);
    if (matched.error) return { ...empty, error: "Payout activity could not be loaded." };
    nameIds = matched.ids;
    if (!nameIds.length && !uuid) return empty;
  }

  const scopedIds = input.scope.mode === "network" ? input.scope.userIds : null;
  const nameIdsInScope = scopedIds ? nameIds.filter((id) => scopedIds.includes(id)) : nameIds;
  if (q && !uuid && !nameIdsInScope.length) return empty;

  let query = db.from("paydora_payout_requests").select(SELECT, { count: "exact" });
  if (status) query = query.eq("status", status);
  if (scopedIds) query = query.in("user_id", q && !uuid ? nameIdsInScope : scopedIds);
  else if (q && !uuid) query = query.in("user_id", nameIdsInScope);
  if (uuid && nameIdsInScope.length) query = query.or(`id.eq.${q},user_id.in.(${nameIdsInScope.join(",")})`);
  else if (uuid) query = query.eq("id", q);

  const { data, error, count } = await query.order("updated_at", { ascending: false }).range(from, to);
  if (error) return { ...empty, error: "Payout activity could not be loaded." };
  const raw = (data ?? []) as RawRow[];
  const networkIds = input.scope.mode === "network" ? input.scope.userIds : null;
  const visible = networkIds ? raw.filter((row) => networkIds.includes(row.user_id)) : raw;
  const names = await playerNames([...new Set(visible.map((row) => row.user_id))]);
  return {
    rows: visible.map((row) => toRow(row, names)),
    total: count ?? visible.length,
    error: null,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function loadPayoutOperation(id: string, scope: PayoutReadScope) {
  if (scope.mode === "network" && scope.userIds.length === 0) return { row: null, error: null };
  const db = adminDb();
  let query = db.from("paydora_payout_requests").select(SELECT).eq("id", id);
  if (scope.mode === "network") query = query.in("user_id", scope.userIds);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return { row: null, error: error ? "This payout record could not be loaded." : null };
  const raw = data as RawRow;
  if (scope.mode === "network" && !scope.userIds.includes(raw.user_id)) return { row: null, error: null };
  const names = await playerNames([raw.user_id]);
  return { row: toRow(raw, names), error: null };
}
