import "server-only";

import { adminDb } from "@/lib/actions/admin/core";
import type { AgentScope } from "@/lib/agents/scope";
import { idsOrNone } from "@/lib/admin/list-scope";
import {
  filterTransactions,
  parentIdsForStore,
  parseTransactionQuery,
  rechargeAmounts,
  redeemScore,
  searchTerm,
  transactionAudience,
  transactionKind,
  transactionTotal,
  type StoreOption,
  type TransactionQuote,
  type TransactionRow,
} from "@/lib/admin/player-transactions";

const LOAD_LIMIT = 1000;

type LoadRecord = {
  id: string;
  user_id: string;
  game_name: string | null;
  amount: number | null;
  load_type: string;
  status: string;
  created_at: string;
  source_key: string | null;
};

type ProfileRecord = {
  id: string;
  full_name: string | null;
  email: string | null;
  parent_agent_id: string | null;
};

export async function loadPlayerTransactions(
  scope: AgentScope,
  params: {
    tab?: string;
    q?: string;
    status?: string;
    from?: string;
    to?: string;
    store?: string;
  }
) {
  const query = parseTransactionQuery(params);
  const db = adminDb();
  const stores = scope.level === "platform" ? await loadStores(db) : [];
  const audience = transactionAudience({
    level: scope.level,
    isSuperAdmin: scope.level === "platform",
    parentIds: scope.parentIds,
    storeFilter: scope.level === "platform" ? query.storeId : null,
    stores,
  });
  if (audience.mode === "deny") {
    return { query, rows: [] as TransactionRow[], total: 0, stores };
  }

  const scopedProfiles = await loadProfiles(db, audience.parentIds, query.q);
  const loads = await loadRequests(db, {
    userIds: audience.parentIds == null && !query.q ? null : scopedProfiles.map((profile) => profile.id),
    kind: query.kind,
    status: query.status,
    from: query.from,
    to: query.to,
  });
  const profiles =
    audience.parentIds == null && !query.q
      ? await loadProfilesByIds(db, loads.map((load) => load.user_id))
      : scopedProfiles;
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const quotes = await loadQuotes(db, loads);
  const rows = filterTransactions(
    loads.flatMap((load) => {
      const kind = transactionKind(load.load_type);
      if (!kind) return [];
      const profile = profileById.get(load.user_id);
      const amounts = kind === "recharge" ? rechargeAmounts({ id: load.id, sourceKey: load.source_key }, quotes) : null;
      const row: TransactionRow = {
        id: load.id,
        kind,
        playerName: profile?.full_name?.trim() || profile?.email || "Player",
        email: profile?.email ?? "",
        game: load.game_name?.trim() || "Game",
        createdAt: load.created_at,
        status: load.status,
        parentAgentId: profile?.parent_agent_id ?? null,
        collected: amounts?.collected ?? null,
        creditSpent: amounts?.creditSpent ?? null,
        redeemAmount: kind === "redeem" ? redeemScore(load.amount == null ? null : Number(load.amount)) : null,
      };
      return [row];
    }),
    {
      kind: query.kind,
      query: query.q,
      status: query.status,
      from: query.from,
      to: query.to,
      parentIds: audience.parentIds,
    }
  );
  return { query, rows, total: transactionTotal(rows, query.kind), stores };
}

async function loadStores(db: ReturnType<typeof adminDb>): Promise<StoreOption[]> {
  const { data, error } = await db.from("agent_accounts").select("user_id, tier, parent_id");
  if (error) return [];
  const agents = (data ?? []) as { user_id: string; tier: string; parent_id: string | null }[];
  const storeIds = agents.filter((agent) => agent.tier === "store_creator").map((agent) => agent.user_id);
  if (!storeIds.length) return [];
  const { data: names } = await db.from("profiles").select("id, full_name, email").in("id", storeIds);
  const nameById = new Map(
    ((names ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((profile) => [
      profile.id,
      profile.full_name?.trim() || profile.email || "Store",
    ])
  );
  return storeIds.map((id) => ({
    id,
    name: nameById.get(id) || "Store",
    parentIds: parentIdsForStore(
      id,
      agents.map((agent) => ({ userId: agent.user_id, tier: agent.tier, parentId: agent.parent_id }))
    ),
  }));
}

async function loadProfiles(db: ReturnType<typeof adminDb>, parentIds: string[] | null, query: string) {
  const term = searchTerm(query);
  if (parentIds && parentIds.length === 0) return [];
  if (parentIds == null && !term) return [];
  let request = db.from("profiles").select("id, full_name, email, parent_agent_id").limit(LOAD_LIMIT);
  if (parentIds) request = request.in("parent_agent_id", idsOrNone(parentIds));
  if (term) request = request.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  const { data } = await request;
  return (data ?? []) as ProfileRecord[];
}

async function loadProfilesByIds(db: ReturnType<typeof adminDb>, userIds: string[]) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return [];
  const { data } = await db.from("profiles").select("id, full_name, email, parent_agent_id").in("id", ids);
  return (data ?? []) as ProfileRecord[];
}

async function loadRequests(
  db: ReturnType<typeof adminDb>,
  input: {
    userIds: string[] | null;
    kind: "recharge" | "redeem";
    status: string;
    from: string | null;
    to: string | null;
  }
) {
  if (input.userIds && input.userIds.length === 0) return [];
  let request = db
    .from("game_load_requests")
    .select("id, user_id, game_name, amount, load_type, status, created_at, source_key")
    .in("load_type", input.kind === "redeem" ? ["redeem"] : ["load", "reload"])
    .order("created_at", { ascending: false })
    .limit(LOAD_LIMIT);
  if (input.userIds) request = request.in("user_id", idsOrNone(input.userIds));
  if (input.status !== "all") request = request.eq("status", input.status);
  if (input.from) request = request.gte("created_at", `${input.from}T00:00:00.000Z`);
  if (input.to) request = request.lte("created_at", `${input.to}T23:59:59.999Z`);
  const { data } = await request;
  const loads = (data ?? []) as LoadRecord[];
  if (input.userIds == null) return loads;
  const allowed = new Set(input.userIds);
  return loads.filter((load) => allowed.has(load.user_id));
}

async function loadQuotes(db: ReturnType<typeof adminDb>, loads: LoadRecord[]): Promise<TransactionQuote[]> {
  const recharge = loads.filter((load) => transactionKind(load.load_type) === "recharge");
  if (!recharge.length) return [];
  const requestIds = recharge.map((load) => load.id);
  const depositKeys = recharge
    .map((load) => (load.source_key?.startsWith("auto:") ? load.source_key.slice("auto:".length) : ""))
    .filter(Boolean);
  const [byRequest, byDeposit] = await Promise.all([
    db
      .from("deposit_bonus_ledger")
      .select("game_load_request_id, deposit_key, base_amount, final_credit")
      .in("game_load_request_id", requestIds),
    depositKeys.length
      ? db
          .from("deposit_bonus_ledger")
          .select("game_load_request_id, deposit_key, base_amount, final_credit")
          .in("deposit_key", depositKeys)
      : Promise.resolve({ data: [] }),
  ]);
  const raw = [...(byRequest.data ?? []), ...(byDeposit.data ?? [])] as {
    game_load_request_id: string | null;
    deposit_key: string;
    base_amount: number;
    final_credit: number;
  }[];
  return raw.map((quote) => ({
    requestId: quote.game_load_request_id,
    depositKey: quote.deposit_key,
    baseAmount: Number(quote.base_amount),
    finalCredit: Number(quote.final_credit),
  }));
}
