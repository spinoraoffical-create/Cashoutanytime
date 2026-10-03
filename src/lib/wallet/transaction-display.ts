import type { WalletType } from "@/lib/wallet/types";
import { walletTypeLabel } from "@/lib/wallet/types";

export interface WalletTransactionRow {
  id: string;
  amount: number;
  wallet_type: WalletType;
  transaction_type: "credit" | "debit" | "adjustment";
  source: string;
  description: string | null;
  created_at: string;
}

export interface BonusGameLoadRow {
  id: string;
  game_name: string;
  game_slug: string;
  amount: number;
  load_type: string;
  status: string;
  game_username: string | null;
  redeem_all: boolean | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  game_load: "Game load",
  game_load_refund: "Load refund",
  game_redeem: "Game redeem",
  deposit: "Deposit",
  admin: "Admin adjustment",
  spin: "Spin prize",
  daily_task: "Daily task",
};

export function transactionSourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}

export function formatTransactionAmount(
  amount: number,
  transactionType: WalletTransactionRow["transaction_type"]
): string {
  const prefix = transactionType === "debit" ? "−" : "+";
  return `${prefix}$${Number(amount).toFixed(2)}`;
}

export function transactionSummary(tx: WalletTransactionRow): string {
  const wallet = walletTypeLabel(tx.wallet_type);
  const source = transactionSourceLabel(tx.source);
  return tx.description?.trim() || `${source} · ${wallet}`;
}

/** Admin two-panel view: Bonus vs Total Deposit (not raw wallet_type alone). */
export function categorizeAdminTransactionPanel(tx: {
  source: string;
  wallet_type: string;
}): "deposit" | "bonus" {
  const { source, wallet_type } = tx;

  if (source === "spin") return "deposit";
  if (source === "daily_task") return "bonus";

  if (wallet_type === "bonus" || wallet_type === "bonus_redeem") return "bonus";

  if (
    wallet_type === "current" ||
    wallet_type === "cashout"
  ) {
    if (
      source === "game_load" ||
      source === "game_redeem" ||
      source === "game_load_refund"
    ) {
      return "deposit";
    }
    if (source === "admin" || source === "deposit") return "deposit";
  }

  return "bonus";
}

export function gameLoadSummary(load: BonusGameLoadRow): string {
  if (load.load_type === "create_account") return `Create account · ${load.game_name}`;
  if (load.load_type === "redeem") {
    if (load.redeem_all) return `Redeem all · ${load.game_name} → Bonus Redeem`;
    return `Redeem $${Number(load.amount).toFixed(2)} · ${load.game_name} → Bonus Redeem`;
  }
  if (load.load_type === "check_balance") return `Balance check · ${load.game_name}`;
  return `Load $${Number(load.amount).toFixed(2)} · ${load.game_name} (bonus wallet)`;
}

/** Panel header totals — net loads to games; redeems are cashout only, not load refunds. */
export function walletColumnSummaryStats(
  transactions: Array<{ source: string; transaction_type: string; amount: number }>
) {
  let loadsOut = 0;
  let creditsIn = 0;
  let redeemedBack = 0;
  let loadRefunds = 0;

  for (const row of transactions) {
    const amount = Number(row.amount);
    if (row.source === "game_load" && row.transaction_type === "debit") {
      loadsOut += amount;
      continue;
    }
    if (row.source === "game_load_refund" && row.transaction_type === "credit") {
      loadRefunds += amount;
      loadsOut -= amount;
      continue;
    }
    if (row.source === "game_redeem" && row.transaction_type === "credit") {
      redeemedBack += amount;
      continue;
    }
    if (row.transaction_type === "credit") {
      creditsIn += amount;
    }
  }

  return { loadsOut: Math.max(0, loadsOut), creditsIn, redeemedBack, loadRefunds };
}
