import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";

import { DepositPageClient } from "@/components/dashboard/deposit-page-client";
import { getWalletData } from "@/lib/data/dashboard";
import { getGames } from "@/lib/data/marketing";
import { buildLobbyCatalog } from "@/lib/games-marketing";
import { getProfile } from "@/lib/supabase/session";
import {
  formatTransactionAmount,
  transactionSummary,
  type WalletTransactionRow,
} from "@/lib/wallet/transaction-display";
import { Button } from "@/components/ui/button";
import { ClaimVerifyBanner } from "@/components/player/claim-verify-banner";
import { MotionPage } from "@/components/player/motion-page";
import { WalletBalanceCard } from "@/components/player/wallet-balance-card";

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
  const games = buildLobbyCatalog(await getGames()).map((game) => ({
    slug: game.slug,
    name: game.name,
  }));

  return (
    <MotionPage className="space-y-5">
      {showBanner ? (
        <ClaimVerifyBanner
          href="/dashboard/kyc"
          title={needsPhone ? "Add your phone to keep cash-outs moving" : "Finish verification to keep cash-outs moving"}
          body="Required before some cash outs."
        />
      ) : null}

      <WalletBalanceCard
        main={main}
        cash={cash}
        freeplay={freeplay}
        name={(row?.full_name as string | undefined) || "Player"}
      />

      <section id="add-money" className="hub-card scroll-mt-4 rounded-[24px] p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#b9b3c6]">Add money</p>
        <p className="mb-4 mt-1 text-sm text-[#b9b3c6]">
          Choose a game, then pay with Paydora. The payment is added to this wallet.
        </p>
        <DepositPageClient embedded games={games} />
      </section>

      <Link
        href="/dashboard/activity"
        className="hub-card flex items-center justify-between rounded-2xl px-4 py-3"
      >
        <span>
          <span className="block text-sm font-semibold">Activity & receipts</span>
          <span className="text-xs text-zinc-400">Deposits, cash outs, and transfers</span>
        </span>
        <span className="text-zinc-400">→</span>
      </Link>

      <div className="hub-card rounded-[24px] p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent</p>
        {wallet.transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Wallet className="h-10 w-10 text-foreground/15" aria-hidden />
            <p className="text-sm font-medium">No transactions yet</p>
            <p className="text-xs text-muted-foreground">Add money to see receipts here.</p>
            <Button asChild size="sm" className="mt-2 rounded-full">
              <a href="#add-money">Add money</a>
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
