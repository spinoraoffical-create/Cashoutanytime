"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useLobbyProfile } from "@/components/home/lobby/use-lobby-profile";

function money(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function WalletSnapshot({
  initial,
}: {
  initial: { balance: number; cashout: number; freeplay: number };
}) {
  const { wallet, balancesHidden, toggleBalances } = useLobbyProfile();
  const balance = wallet?.walletBalance ?? initial.balance;
  const cashout = wallet?.cashoutWallet ?? initial.cashout;
  const freeplay = wallet?.bonusWallet ?? initial.freeplay;
  const shown = (n: number) => (balancesHidden ? "••••" : `$${money(n)}`);

  return (
    <section className="hub-card relative space-y-4 overflow-hidden rounded-[24px] p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">
          Wallet{" "}
          <span className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Updated
          </span>
        </p>
        <button
          type="button"
          onClick={toggleBalances}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-zinc-300"
          aria-label={balancesHidden ? "Show balances" : "Hide balances"}
        >
          {balancesHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <p className="text-4xl font-extrabold tabular-nums">{shown(balance)}</p>
      <div className="flex items-end justify-between gap-3 border-t border-white/8 pt-3">
        <div className="grid flex-1 grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Cash out ready</p>
            <p className="mt-1 text-sm font-bold tabular-nums">{shown(cashout)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Freeplay</p>
            <p className="mt-1 text-sm font-bold tabular-nums">{shown(freeplay)}</p>
          </div>
        </div>
        <Link href="/dashboard/wallet" className="shrink-0 text-sm font-semibold text-emerald-400">
          Open wallet →
        </Link>
      </div>
    </section>
  );
}
