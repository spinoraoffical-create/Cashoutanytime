import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";

import { getWalletData } from "@/lib/data/dashboard";
import { getProfile } from "@/lib/supabase/session";
import {
  formatTransactionAmount,
  transactionSummary,
  type WalletTransactionRow,
} from "@/lib/wallet/transaction-display";
import { Button } from "@/components/ui/button";
import { ClaimVerifyBanner } from "@/components/player/claim-verify-banner";
import { MotionPage } from "@/components/player/motion-page";

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
  const profile = await getProfile();
  const row = profile as typeof profile & { kyc_status?: string | null };
  const needsPhone = Boolean(row && !row.phone);
  const needsKyc = Boolean(row && row.kyc_status && row.kyc_status !== "verified");
  const showBanner = needsPhone || needsKyc;
  const main = wallet.balance;
  const cash = wallet.cashout;
  const freeplay = wallet.freeplay;

  return (
    <MotionPage className="space-y-5">
      {showBanner ? (
        <ClaimVerifyBanner
          href="/dashboard/kyc"
          title={needsPhone ? "Add your phone to keep cash-outs moving" : "Finish verification to keep cash-outs moving"}
          body="Required before some cash outs."
        />
      ) : null}

      <div className="flex items-end justify-between">
        <h1 className="text-3xl font-extrabold">Wallet</h1>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
        </span>
      </div>

      <section className="hub-gold-edge hub-card relative overflow-hidden rounded-[24px]">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="flex items-start justify-between p-5 pb-2">
          <div>
            <p className="text-lg font-extrabold">Main Wallet</p>
            <p className="text-sm text-muted-foreground">Cash + Freeplay</p>
          </div>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-sm font-black text-white">
            SH
          </span>
        </div>
        <div className="px-5 pb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Ready when you are
          </p>
          <p className="mt-1 text-5xl font-extrabold tabular-nums">${main.toFixed(2)}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-xs text-muted-foreground">Available to cash out</p>
              <p className="mt-1 text-lg font-extrabold tabular-nums">${cash.toFixed(2)}</p>
              <p className="text-[11px] text-muted-foreground">Cash</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-xs text-muted-foreground">Freeplay</p>
              <p className="mt-1 text-lg font-extrabold tabular-nums">${freeplay.toFixed(2)}</p>
              <p className="text-[11px] text-muted-foreground">Play only</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button asChild className="rounded-full">
              <Link href="/dashboard/deposit">+ Add money</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/dashboard/withdraw">Cash out</Link>
            </Button>
          </div>
        </div>
      </section>

      <Link
        href="/dashboard/activity"
        className="hub-card flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold"
      >
        Activity & receipts
        <span className="text-primary">→</span>
      </Link>

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
    </MotionPage>
  );
}
