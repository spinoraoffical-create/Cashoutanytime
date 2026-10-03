import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Banknote, Plus, Wallet } from "lucide-react";

import { getWalletData } from "@/lib/data/dashboard";
import {
  formatTransactionAmount,
  transactionSummary,
  type WalletTransactionRow,
} from "@/lib/wallet/transaction-display";

export const metadata: Metadata = { title: "Wallet | Spinora" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function TxRow({ tx }: { tx: WalletTransactionRow }) {
  const isCredit = tx.transaction_type === "credit" || tx.transaction_type === "adjustment";
  return (
    <li className="flex items-center gap-3 border-b border-foreground/5 py-3 last:border-0">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
          isCredit ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
        }`}
      >
        {isCredit ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{transactionSummary(tx)}</p>
        <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
      </div>
      <p className={`tnum shrink-0 text-sm font-semibold ${isCredit ? "text-emerald-400" : "text-foreground"}`}>
        {formatTransactionAmount(tx.amount, tx.transaction_type)}
      </p>
    </li>
  );
}

export default async function WalletPage() {
  const wallet = await getWalletData();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Wallet</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your deposit balance and cash-out balance.</p>
        </div>
        <Link
          href="/dashboard/deposit"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Funds
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-ws-green/30 bg-gradient-to-br from-ws-green/10 to-ws-green/5 p-5 dark:from-[#10271d] dark:to-[#0b1a13]">
          <div className="flex items-center gap-2 text-ws-green-deep dark:text-emerald-100/80">
            <Wallet className="h-4 w-4 text-ws-gold-deep dark:text-ws-gold" />
            <span className="text-xs font-semibold uppercase tracking-wider">Deposit balance</span>
          </div>
          <p className="mt-2 text-3xl font-extrabold tabular-nums text-foreground">${wallet.balance.toLocaleString()}</p>
          <p className="mt-1 text-xs text-ws-green-deep dark:text-emerald-200/70">Use this to create &amp; load games.</p>
        </div>
        <div className="rounded-2xl border border-ws-green/30 bg-gradient-to-br from-ws-green/10 to-ws-green/5 p-5 dark:from-emerald-950/60 dark:to-[#161616]">
          <div className="flex items-center gap-2 text-ws-green-deep dark:text-emerald-100/80">
            <Banknote className="h-4 w-4 text-ws-green-deep dark:text-ws-green" />
            <span className="text-xs font-semibold uppercase tracking-wider">Cash-out balance</span>
          </div>
          <p className="mt-2 text-3xl font-extrabold tabular-nums text-foreground">${wallet.cashout.toLocaleString()}</p>
          <p className="mt-1 text-xs text-ws-green-deep dark:text-emerald-200/70">Redeemed winnings — contact support to withdraw.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-foreground/10 bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet history</p>
        {wallet.transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Wallet className="h-10 w-10 text-foreground/15" aria-hidden />
            <p className="text-sm font-medium text-foreground">No wallet activity yet</p>
            <p className="text-xs text-muted-foreground">Deposits and game loads will appear here.</p>
          </div>
        ) : (
          <ul className="mt-3">
            {wallet.transactions.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
