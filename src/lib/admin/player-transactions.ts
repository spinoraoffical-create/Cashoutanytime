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
