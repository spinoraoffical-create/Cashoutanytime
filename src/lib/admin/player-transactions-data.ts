import "server-only";

import { adminDb } from "@/lib/actions/admin/core";
import type { AgentScope } from "@/lib/agents/scope";
import { idsOrNone } from "@/lib/admin/list-scope";
import {
  buildDailyReport,
  filterTransactions,
  parentIdsForStore,
  parseDailyReportQuery,
  parseTransactionQuery,
  rechargeAmounts,
  redeemScore,
  searchTerm,
  transactionAudience,
  transactionKind,
  transactionTotal,
  type DailyReportDeposit,
  type DailyReportLoad,
  type DailyReportPayout,
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

export async function loadDailyPlayerReport(
  scope: AgentScope,
  params: { day?: string; store?: string }
) {
  const query = parseDailyReportQuery(params);
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
    return { query, rows: [], moneyReceived: 0, cashPaidOut: 0, profit: 0, games: [], stores };
  }

  const scopedProfiles = await loadProfiles(db, audience.parentIds, "");
  const userIds = audience.parentIds == null ? null : scopedProfiles.map((profile) => profile.id);
  const [deposits, loads, payouts] = await Promise.all([
    loadReportDeposits(db, userIds, query.day),
    loadReportLoads(db, userIds, query.day),
    loadReportPayouts(db, userIds, query.day),
  ]);
  const profiles =
    audience.parentIds == null
      ? await loadProfilesByIds(db, [...deposits, ...loads, ...payouts].map((row) => row.userId))
      : scopedProfiles;
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const named = <T extends { userId: string; playerName: string; parentAgentId: string | null }>(row: T): T => {
    const profile = profileById.get(row.userId);
    return {
      ...row,
      playerName: profile?.full_name?.trim() || profile?.email || "Player",
      parentAgentId: profile?.parent_agent_id ?? null,
    };
  };
  const report = buildDailyReport({
    day: query.day,
    parentIds: audience.parentIds,
    deposits: deposits.map(named),
    loads: loads.map(named),
    payouts: payouts.map(named),
  });
  return { query, ...report, stores };
}

async function loadReportDeposits(db: ReturnType<typeof adminDb>, userIds: string[] | null, day: string) {
  if (userIds && userIds.length === 0) return [];
  let requests = db
    .from("deposit_requests")
    .select("id, user_id, amount, status, wallet_credited, game_name, proof_url, created_at")
    .gte("created_at", `${day}T00:00:00.000Z`)
    .lte("created_at", `${day}T23:59:59.999Z`)
    .or("status.eq.completed,wallet_credited.eq.true")
    .limit(LOAD_LIMIT);
  let ledger = db
    .from("deposit_bonus_ledger")
    .select("deposit_key, user_id, base_amount, final_credit, game_load_request_id, game_slug, wallet_credited, created_at")
    .eq("wallet_credited", true)
    .gte("created_at", `${day}T00:00:00.000Z`)
    .lte("created_at", `${day}T23:59:59.999Z`)
    .limit(LOAD_LIMIT);
  if (userIds) {
    const ids = idsOrNone(userIds);
    requests = requests.in("user_id", ids);
    ledger = ledger.in("user_id", ids);
  }
  const [requestResult, ledgerResult] = await Promise.all([requests, ledger]);
  const byKey = new Map<string, DailyReportDeposit>();
  for (const row of (ledgerResult.data ?? []) as {
    deposit_key: string;
    user_id: string;
    base_amount: number;
    final_credit: number | null;
    game_load_request_id: string | null;
    game_slug: string | null;
    created_at: string;
  }[]) {
    byKey.set(row.deposit_key, {
      id: row.deposit_key,
      key: row.deposit_key,
      userId: row.user_id,
      playerName: "Player",
      parentAgentId: null,
      createdAt: row.created_at,
      completed: true,
      baseAmount: Number(row.base_amount),
      finalCredit: row.final_credit == null ? null : Number(row.final_credit),
      game: row.game_slug?.trim() || "",
      loadRequestId: row.game_load_request_id,
    });
  }
  for (const row of (requestResult.data ?? []) as {
    id: string;
    user_id: string;
    amount: number;
    game_name: string | null;
    proof_url: string | null;
    created_at: string;
  }[]) {
    const key = row.proof_url?.startsWith("paydora/") ? row.proof_url.slice("paydora/".length) : row.id;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.game && row.game_name) existing.game = row.game_name;
      continue;
    }
    byKey.set(key, {
      id: row.id,
      key,
      userId: row.user_id,
      playerName: "Player",
      parentAgentId: null,
      createdAt: row.created_at,
      completed: true,
      baseAmount: Number(row.amount),
      finalCredit: null,
      game: row.game_name?.trim() || "",
      loadRequestId: null,
    });
  }
  return [...byKey.values()];
}

async function loadReportLoads(db: ReturnType<typeof adminDb>, userIds: string[] | null, day: string) {
  if (userIds && userIds.length === 0) return [];
  let request = db
    .from("game_load_requests")
    .select("id, user_id, game_name, amount, load_type, status, created_at, source_key")
    .eq("status", "completed")
    .in("load_type", ["load", "reload", "redeem", "create_account"])
    .gte("created_at", `${day}T00:00:00.000Z`)
    .lte("created_at", `${day}T23:59:59.999Z`)
    .limit(LOAD_LIMIT);
  if (userIds) request = request.in("user_id", idsOrNone(userIds));
  const { data } = await request;
  return ((data ?? []) as LoadRecord[]).map(
    (load): DailyReportLoad => ({
      id: load.id,
      userId: load.user_id,
      playerName: "Player",
      parentAgentId: null,
      createdAt: load.created_at,
      status: load.status,
      loadType: load.load_type,
      amount: load.amount == null ? null : Number(load.amount),
      game: load.game_name?.trim() || "Game",
      sourceKey: load.source_key,
    })
  );
}

async function loadReportPayouts(db: ReturnType<typeof adminDb>, userIds: string[] | null, day: string) {
  if (userIds && userIds.length === 0) return [];
  let ledger = db
    .from("wallet_transactions")
    .select("id, user_id, amount, created_at")
    .eq("wallet_type", "cashout")
    .eq("transaction_type", "debit")
    .eq("source", "payout")
    .gte("created_at", `${day}T00:00:00.000Z`)
    .lte("created_at", `${day}T23:59:59.999Z`)
    .limit(LOAD_LIMIT);
  let provider = db
    .from("paydora_payout_requests")
    .select("id, user_id, amount, status, created_at")
    .in("status", ["paid", "submitted"])
    .gte("created_at", `${day}T00:00:00.000Z`)
    .lte("created_at", `${day}T23:59:59.999Z`)
    .limit(LOAD_LIMIT);
  if (userIds) {
    const ids = idsOrNone(userIds);
    ledger = ledger.in("user_id", ids);
    provider = provider.in("user_id", ids);
  }
  const [ledgerResult, providerResult] = await Promise.all([ledger, provider]);
  const rows: DailyReportPayout[] = ((ledgerResult.data ?? []) as { id: string; user_id: string; amount: number; created_at: string }[]).map(
    (row) => ({
      id: row.id,
      userId: row.user_id,
      playerName: "Player",
      parentAgentId: null,
      createdAt: row.created_at,
      amount: Number(row.amount),
      completed: true,
    })
  );
  if (!providerResult.error) {
    for (const row of (providerResult.data ?? []) as { id: string; user_id: string; amount: number; created_at: string }[]) {
      rows.push({
        id: `paydora:${row.id}`,
        userId: row.user_id,
        playerName: "Player",
        parentAgentId: null,
        createdAt: row.created_at,
        amount: Number(row.amount),
        completed: true,
      });
    }
  }
  return rows;
}
