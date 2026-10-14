import "server-only";

import { adminDb } from "@/lib/actions/admin/core";
import { idsOrNone } from "@/lib/admin/list-scope";
import { profileDisplayName, type ProfileRow } from "@/lib/admin/spinora-profile";

export const PAYOUT_STATUSES = ["requested", "reserved", "submitted", "paid", "failed", "manual_review"] as const;

export type PayoutRecordStatus = (typeof PAYOUT_STATUSES)[number];

export type PayoutOperationRow = {
  id: string;
  userId: string;
  playerName: string;
  playerEmail: string;
  amount: number;
  method: string;
  status: string;
  providerReference: string | null;
  providerWithdrawalId: string | null;
  providerStatus: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

const PAGE_SIZE = 20;
const SELECT =
  "id, user_id, amount, method, status, provider_withdrawal_id, provider_reference_id, provider_status, hold_reason, created_at, updated_at";

export function payoutStatusHelp(status: string) {
  switch (status) {
    case "requested":
      return "The request is saved. A provider payment is not confirmed.";
    case "reserved":
      return "The request is reserved. A provider payment is not confirmed.";
    case "submitted":
      return "Sent to the provider. The final outcome is not confirmed yet.";
    case "paid":
      return "The provider payment is confirmed.";
    case "manual_review":
      return "A person needs to investigate this before any further money action.";
    case "failed":
      return "The system recorded a failure. A failed status does not by itself show that a refund was posted.";
    default:
      return "Stored status on the payout record.";
  }
}

export function isPayoutStatus(value: string): value is PayoutRecordStatus {
  return (PAYOUT_STATUSES as readonly string[]).includes(value);
}

function safeText(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  if (!text) return null;
  if (/sk_live|api[_-]?key|bearer\s|secret|password/i.test(text)) return null;
  return text.slice(0, 180);
}

type RawRow = {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  status: string;
  provider_withdrawal_id: string | null;
  provider_reference_id: string | null;
  provider_status: string | null;
  hold_reason: string | null;
  created_at: string;
  updated_at: string;
};

function toRow(row: RawRow, names: Map<string, { name: string; email: string }>): PayoutOperationRow {
  const player = names.get(row.user_id);
  return {
    id: row.id,
    userId: row.user_id,
    playerName: player?.name || "Player",
    playerEmail: player?.email || "",
    amount: Number(row.amount),
    method: row.method,
    status: row.status,
    providerReference: safeText(row.provider_reference_id),
    providerWithdrawalId: safeText(row.provider_withdrawal_id),
    providerStatus: safeText(row.provider_status),
    note: safeText(row.hold_reason),
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

async function matchingPlayerIds(q: string, scopedUserIds: string[] | null) {
  const db = adminDb();
  let query = db.from("profiles").select("id").or(`email.ilike.%${q}%,full_name.ilike.%${q}%`).limit(200);
  if (scopedUserIds) query = query.in("id", idsOrNone(scopedUserIds));
  const { data, error } = await query;
  if (error) return { ids: [] as string[], error: error.message };
  return { ids: ((data ?? []) as { id: string }[]).map((row) => row.id), error: null };
}

function searchText(value: string) {
  return value.trim().slice(0, 80).replace(/[%_,]/g, "");
}

export async function loadPayoutOperations(input: {
  scopedUserIds: string[] | null;
  q: string;
  status: string;
  page: number;
}) {
  const db = adminDb();
  const q = searchText(input.q);
  const page = Math.max(1, input.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const status = isPayoutStatus(input.status) ? input.status : "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
  const empty = { rows: [] as PayoutOperationRow[], total: 0, error: null, page, pageSize: PAGE_SIZE };

  let nameIds: string[] = [];
  if (q) {
    const matched = await matchingPlayerIds(q, input.scopedUserIds);
    if (matched.error) return { ...empty, error: "Payout activity could not be loaded." };
    nameIds = matched.ids;
    if (!nameIds.length && !uuid) return empty;
  }

  let query = db.from("paydora_payout_requests").select(SELECT, { count: "exact" });
  if (input.scopedUserIds) query = query.in("user_id", idsOrNone(input.scopedUserIds));
  if (status) query = query.eq("status", status);
  if (q && !uuid) query = query.in("user_id", idsOrNone(nameIds));
  if (uuid && nameIds.length) query = query.or(`id.eq.${q},user_id.in.(${nameIds.join(",")})`);
  if (uuid && !nameIds.length) query = query.eq("id", q);

  const { data, error, count } = await query.order("updated_at", { ascending: false }).range(from, to);
  if (error) return { ...empty, error: "Payout activity could not be loaded." };
  const raw = (data ?? []) as RawRow[];
  const names = await playerNames([...new Set(raw.map((row) => row.user_id))]);
  return {
    rows: raw.map((row) => toRow(row, names)),
    total: count ?? raw.length,
    error: null,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function loadPayoutOperation(id: string, scopedUserIds: string[] | null) {
  const db = adminDb();
  const { data, error } = await db.from("paydora_payout_requests").select(SELECT).eq("id", id).maybeSingle();
  if (error || !data) return { row: null, error: error ? "This payout record could not be loaded." : null };
  const raw = data as RawRow;
  if (scopedUserIds && !scopedUserIds.includes(raw.user_id)) return { row: null, error: null };
  const names = await playerNames([raw.user_id]);
  return { row: toRow(raw, names), error: null };
}
