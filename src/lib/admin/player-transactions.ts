export type TransactionKind = "recharge" | "redeem";

export const TRANSACTION_STATUSES = ["completed", "pending", "processing", "failed", "cancelled", "all"] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export type TransactionQuote = {
  requestId: string | null;
  depositKey: string;
  baseAmount: number;
  finalCredit: number;
};

export type TransactionRow = {
  id: string;
  kind: TransactionKind;
  playerName: string;
  email: string;
  game: string;
  createdAt: string;
  status: string;
  parentAgentId: string | null;
  collected: number | null;
  creditSpent: number | null;
  redeemAmount: number | null;
};

export type StoreOption = {
  id: string;
  name: string;
  parentIds: string[];
};

export function transactionKind(loadType: string): TransactionKind | null {
  if (loadType === "load" || loadType === "reload") return "recharge";
  if (loadType === "redeem") return "redeem";
  return null;
}

export function parentIdsForStore(
  storeId: string,
  agents: { userId: string; tier: string; parentId: string | null }[]
) {
  const subs = agents
    .filter((agent) => agent.tier === "sub_creator" && agent.parentId === storeId)
    .map((agent) => agent.userId);
  return [storeId, ...subs];
}

/** Platform with no store filter sees every row. A store or sub never inherits another store id from the query string. */
export function transactionAudience(input: {
  level: "platform" | "store" | "sub" | null;
  isSuperAdmin: boolean;
  parentIds: string[];
  storeFilter: string | null;
  stores: StoreOption[];
}): { mode: "deny" } | { mode: "rows"; parentIds: string[] | null } {
  if (input.level === "store" || input.level === "sub") {
    if (!input.parentIds.length || input.parentIds.some((id) => !id)) return { mode: "deny" };
    return { mode: "rows", parentIds: input.parentIds };
  }
  if (input.level === "platform" && input.isSuperAdmin) {
    if (!input.storeFilter) return { mode: "rows", parentIds: null };
    const store = input.stores.find((item) => item.id === input.storeFilter);
    if (!store || store.parentIds.length === 0) return { mode: "rows", parentIds: [] };
    return { mode: "rows", parentIds: store.parentIds };
  }
  return { mode: "deny" };
}

export function rechargeAmounts(
  load: { id: string; sourceKey: string | null },
  quotes: TransactionQuote[]
): { collected: number | null; creditSpent: number | null } {
  const byRequest = quotes.find((quote) => quote.requestId === load.id);
  const depositKey = load.sourceKey?.startsWith("auto:") ? load.sourceKey.slice("auto:".length) : "";
  const byDeposit = depositKey ? quotes.find((quote) => quote.depositKey === depositKey) : undefined;
  const quote = byRequest ?? byDeposit;
  if (!quote) return { collected: null, creditSpent: null };
  return { collected: roundMoney(quote.baseAmount), creditSpent: roundMoney(quote.finalCredit) };
}

export function redeemScore(amount: number | null) {
  if (amount == null || !Number.isFinite(amount)) return null;
  return roundMoney(amount);
}

export function parseTransactionQuery(params: {
  tab?: string;
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  store?: string;
}) {
  const status = TRANSACTION_STATUSES.includes(params.status as TransactionStatus)
    ? (params.status as TransactionStatus)
    : "completed";
  return {
    kind: params.tab === "redeem" ? ("redeem" as const) : ("recharge" as const),
    q: (params.q ?? "").trim().slice(0, 80),
    status,
    from: dateOnly(params.from),
    to: dateOnly(params.to),
    storeId: (params.store ?? "").trim() || null,
  };
}

export function filterTransactions(
  rows: TransactionRow[],
  input: {
    kind: TransactionKind;
    query: string;
    status: string;
    from: string | null;
    to: string | null;
    parentIds: string[] | null;
  }
) {
  const needle = input.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (row.kind !== input.kind) return false;
    if (input.parentIds && (!row.parentAgentId || !input.parentIds.includes(row.parentAgentId))) return false;
    if (input.status !== "all" && row.status !== input.status) return false;
    const day = row.createdAt.slice(0, 10);
    if (input.from && day < input.from) return false;
    if (input.to && day > input.to) return false;
    if (!needle) return true;
    return row.playerName.toLowerCase().includes(needle) || row.email.toLowerCase().includes(needle);
  });
}

/** Recharge totals add Credit spent. Redeem totals add the score returned from the game. */
export function transactionTotal(rows: TransactionRow[], kind: TransactionKind) {
  const sum = rows.reduce((total, row) => {
    const amount = kind === "recharge" ? row.creditSpent : row.redeemAmount;
    return amount == null ? total : total + amount;
  }, 0);
  return roundMoney(sum);
}

export function moneyLabel(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(2)}`;
}

export function searchTerm(value: string) {
  return value.trim().slice(0, 80).replace(/[%_\\,()]/g, "");
}

function dateOnly(value: string | undefined) {
  const text = (value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export type DailyReportDeposit = {
  id: string;
  key: string;
  userId: string;
  playerName: string;
  parentAgentId: string | null;
  createdAt: string;
  completed: boolean;
  baseAmount: number;
  finalCredit: number | null;
  game: string;
  loadRequestId: string | null;
};

export type DailyReportLoad = {
  id: string;
  userId: string;
  playerName: string;
  parentAgentId: string | null;
  createdAt: string;
  status: string;
  loadType: string;
  amount: number | null;
  game: string;
  sourceKey: string | null;
};

export type DailyReportPayout = {
  id: string;
  userId: string;
  playerName: string;
  parentAgentId: string | null;
  createdAt: string;
  amount: number;
  completed: boolean;
};

export type DailyReportRow = {
  id: string;
  playerName: string;
  game: string;
  createdAt: string;
  moneyReceived: number;
  coinsLoaded: number;
  coinsRedeemed: number;
  cashPaidOut: number;
};

export type DailyGameCoins = {
  game: string;
  coinsLoaded: number;
  coinsRedeemed: number;
  netCoins: number;
};

export function parseDailyReportQuery(params: { day?: string; store?: string }, today = "") {
  return {
    day: dateOnly(params.day) ?? (dateOnly(today) || new Date().toISOString().slice(0, 10)),
    storeId: (params.store ?? "").trim() || null,
  };
}

export function signedMoneyLabel(value: number) {
  const amount = roundMoney(value);
  if (amount < 0) return `-$${Math.abs(amount).toFixed(2)}`;
  return `$${amount.toFixed(2)}`;
}

export function coinLabel(value: number) {
  const amount = roundMoney(value);
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

/** One day, one group. Cash profit ignores coins. A deposit and its game load are one row. */
export function buildDailyReport(input: {
  day: string;
  parentIds: string[] | null;
  deposits: DailyReportDeposit[];
  loads: DailyReportLoad[];
  payouts: DailyReportPayout[];
}) {
  const day = dateOnly(input.day) ?? "";
  const usedLoadIds = new Set<string>();
  const seenDepositKeys = new Set<string>();
  const rows: DailyReportRow[] = [];

  for (const deposit of input.deposits) {
    if (!deposit.completed || !sameDay(deposit.createdAt, day) || !inGroup(deposit.parentAgentId, input.parentIds)) continue;
    if (deposit.key) {
      if (seenDepositKeys.has(deposit.key)) continue;
      seenDepositKeys.add(deposit.key);
    }
    const linked = input.loads.filter((load) => loadLinksDeposit(load, deposit));
    for (const load of linked) usedLoadIds.add(load.id);
    const completedLoad = linked.find((load) => isCoinLoad(load));
    rows.push({
      id: `deposit:${deposit.id}`,
      playerName: deposit.playerName,
      game: completedLoad?.game || deposit.game || "—",
      createdAt: deposit.createdAt,
      moneyReceived: roundMoney(deposit.baseAmount),
      coinsLoaded: completedLoad ? creditsSent(completedLoad, deposit.finalCredit) : 0,
      coinsRedeemed: 0,
      cashPaidOut: 0,
    });
  }

  for (const load of input.loads) {
    if (usedLoadIds.has(load.id) || load.status !== "completed") continue;
    if (!sameDay(load.createdAt, day) || !inGroup(load.parentAgentId, input.parentIds)) continue;
    if (load.loadType === "redeem") {
      const redeemed = creditsSent(load, null);
      if (redeemed === 0) continue;
      rows.push({
        id: `load:${load.id}`,
        playerName: load.playerName,
        game: load.game || "—",
        createdAt: load.createdAt,
        moneyReceived: 0,
        coinsLoaded: 0,
        coinsRedeemed: redeemed,
        cashPaidOut: 0,
      });
      continue;
    }
    if (!isCoinLoad(load)) continue;
    const loaded = creditsSent(load, null);
    if (loaded === 0) continue;
    rows.push({
      id: `load:${load.id}`,
      playerName: load.playerName,
      game: load.game || "—",
      createdAt: load.createdAt,
      moneyReceived: 0,
      coinsLoaded: loaded,
      coinsRedeemed: 0,
      cashPaidOut: 0,
    });
  }

  for (const payout of input.payouts) {
    if (!payout.completed || !sameDay(payout.createdAt, day) || !inGroup(payout.parentAgentId, input.parentIds)) continue;
    const paid = roundMoney(payout.amount);
    if (paid === 0) continue;
    rows.push({
      id: `payout:${payout.id}`,
      playerName: payout.playerName,
      game: "—",
      createdAt: payout.createdAt,
      moneyReceived: 0,
      coinsLoaded: 0,
      coinsRedeemed: 0,
      cashPaidOut: paid,
    });
  }

  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const moneyReceived = roundMoney(rows.reduce((sum, row) => sum + row.moneyReceived, 0));
  const cashPaidOut = roundMoney(rows.reduce((sum, row) => sum + row.cashPaidOut, 0));
  const games = gameCoins(rows);
  return {
    rows,
    moneyReceived,
    cashPaidOut,
    profit: roundMoney(moneyReceived - cashPaidOut),
    games,
  };
}

function sameDay(createdAt: string, day: string) {
  return Boolean(day) && createdAt.slice(0, 10) === day;
}

function inGroup(parentAgentId: string | null, parentIds: string[] | null) {
  if (parentIds == null) return true;
  return Boolean(parentAgentId && parentIds.includes(parentAgentId));
}

function loadLinksDeposit(load: DailyReportLoad, deposit: DailyReportDeposit) {
  if (load.userId !== deposit.userId) return false;
  if (deposit.loadRequestId && load.id === deposit.loadRequestId) return true;
  return Boolean(deposit.key && load.sourceKey === `auto:${deposit.key}`);
}

function isCoinLoad(load: DailyReportLoad) {
  return load.status === "completed" && (load.loadType === "load" || load.loadType === "reload" || load.loadType === "create_account");
}

function creditsSent(load: DailyReportLoad, finalCredit: number | null) {
  if (finalCredit != null && Number.isFinite(finalCredit)) return roundMoney(finalCredit);
  if (load.amount == null || !Number.isFinite(load.amount) || load.amount <= 0) return 0;
  return roundMoney(load.amount);
}

function gameCoins(rows: DailyReportRow[]): DailyGameCoins[] {
  const byGame = new Map<string, { loaded: number; redeemed: number }>();
  for (const row of rows) {
    if (!row.game || row.game === "—") continue;
    if (row.coinsLoaded === 0 && row.coinsRedeemed === 0) continue;
    const current = byGame.get(row.game) ?? { loaded: 0, redeemed: 0 };
    current.loaded += row.coinsLoaded;
    current.redeemed += row.coinsRedeemed;
    byGame.set(row.game, current);
  }
  return [...byGame.entries()]
    .map(([game, coins]) => ({
      game,
      coinsLoaded: roundMoney(coins.loaded),
      coinsRedeemed: roundMoney(coins.redeemed),
      netCoins: roundMoney(coins.loaded - coins.redeemed),
    }))
    .sort((a, b) => a.game.localeCompare(b.game));
}
