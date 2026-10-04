"use client";

import Link from "next/link";
import { ChevronRight, Eye } from "lucide-react";
import { useLobbyProfile } from "@/components/home/lobby/use-lobby-profile";

function money(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function WalletSnapshot({
  initial,
}: {
  initial: { balance: number; cashout: number; freeplay: number };
}) {
  const { wallet, walletHidden } = useLobbyProfile();
  const balance = wallet?.walletBalance ?? initial.balance;
  const cashout = wallet?.cashoutWallet ?? initial.cashout;
  const freeplay = wallet?.bonusWallet ?? initial.freeplay;

  return (
    <section className="hub-card space-y-3 rounded-[24px] p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">
          Wallet{" "}
          <span className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> live
          </span>
        </p>
        <Eye className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
      <p className="text-4xl font-extrabold tabular-nums">
        ${walletHidden ? "••••" : money(balance)}
      </p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">Cash out ready</p>
          <p className="font-bold tabular-nums">${walletHidden ? "••••" : money(cashout)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Freeplay</p>
          <p className="font-bold tabular-nums">${walletHidden ? "••••" : money(freeplay)}</p>
        </div>
      </div>
      <Link href="/dashboard/wallet" className="inline-flex items-center text-sm font-semibold text-primary">
        Open wallet <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
