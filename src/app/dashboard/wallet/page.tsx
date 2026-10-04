import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";

import { getWalletData } from "@/lib/data/dashboard";
import {
  formatTransactionAmount,
  transactionSummary,
  type WalletTransactionRow,
} from "@/lib/wallet/transaction-display";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Wallet | Sweepstakes Hub" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TxRow({ tx }: { tx: WalletTransactionRow }) {
  const isCredit = tx.transaction_type === "credit" || tx.transaction_type === "adjustment";
  return (
    <li className="flex items-center gap-3 border-b border-white/5 py-3 last:border-0">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
          isCredit ? "bg-emerald-500/10 text-emerald-400" : "bg-white/8 text-foreground"
        }`}
      >
        {isCredit ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{transactionSummary(tx)}</p>
        <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
      </div>
      <p className={`tnum shrink-0 text-sm font-semibold ${isCredit ? "text-emerald-400" : ""}`}>
        {formatTransactionAmount(tx.amount, tx.transaction_type)}
      </p>
    </li>
  );
}

export default async function WalletPage() {
  const wallet = await getWalletData();
  const main = wallet.balance;
  const cash = wallet.cashout;
  const freeplay = wallet.freeplay;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold">Wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">Main Wallet, cash out, and freeplay — kept separate.</p>
      </div>

      <section className="hub-card hub-card-glow rounded-[24px] p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Main Wallet</p>
        <p className="mt-2 text-4xl font-extrabold tabular-nums">${main.toFixed(2)}</p>
        <p className="mt-1 text-sm text-muted-foreground">Cash + Freeplay stay listed below.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button asChild className="rounded-full">
            <Link href="/dashboard/deposit">Add money</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/dashboard/withdraw">Cash out</Link>
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className="hub-card rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">Available to cash out</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums">${cash.toFixed(2)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Cash</p>
        </div>
        <div className="hub-card rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">Freeplay</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums">${freeplay.toFixed(2)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Play only</p>
        </div>
      </div>

      <Link href="/dashboard/activity" className="block text-sm font-semibold text-primary">
        Activity & receipts →
      </Link>

      <div className="hub-card rounded-2xl p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Destinations</p>
        <ul className="mt-2 space-y-1.5">
          <li>Main Wallet → add money / cash out</li>
          <li>Game Room balances → load + redeem per game</li>
          <li>Freeplay → play only where shown</li>
        </ul>
      </div>

      <div className="hub-card rounded-[24px] p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent</p>
        {wallet.transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Wallet className="h-10 w-10 text-foreground/15" aria-hidden />
            <p className="text-sm font-medium">No transactions yet</p>
            <p className="text-xs text-muted-foreground">Add money to see receipts here.</p>
            <Button asChild size="sm" className="mt-2 rounded-full">
              <Link href="/dashboard/deposit">Add money</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-2">
            {wallet.transactions.slice(0, 8).map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
