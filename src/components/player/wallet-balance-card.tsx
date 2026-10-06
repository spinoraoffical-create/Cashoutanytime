"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Plus, RefreshCw, ArrowDownToLine } from "lucide-react";
import { useBalanceMask } from "@/lib/wallet/balance-mask";
import { WALLET_REFRESH_EVENT } from "@/lib/wallet/use-live-wallet";

function shown(masked: boolean, n: number) {
  return masked ? "••••" : `$${n.toFixed(2)}`;
}

export function WalletBalanceCard({
  main,
  cash,
  freeplay,
}: {
  main: number;
  cash: number;
  freeplay: number;
}) {
  const { masked, toggle } = useBalanceMask();
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  function refresh() {
    setSpinning(true);
    window.dispatchEvent(new Event(WALLET_REFRESH_EVENT));
    router.refresh();
    window.setTimeout(() => setSpinning(false), 700);
  }

  return (
    <>
      <div className="flex items-end justify-between">
        <h1 className="text-3xl font-extrabold">Wallet</h1>
        <div className="flex items-center gap-3 text-xs font-semibold text-emerald-400">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
          </span>
          <button
            type="button"
            onClick={refresh}
            className="text-zinc-300"
            aria-label="Refresh wallet balance"
          >
            <RefreshCw className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <section className="hub-card relative overflow-hidden rounded-[24px] p-5">
        <button
          type="button"
          onClick={toggle}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-zinc-300"
          aria-label={masked ? "Show wallet balances" : "Hide wallet balances"}
        >
          {masked ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <p className="text-lg font-extrabold">Main Wallet</p>
        <p className="text-sm text-zinc-400">Cash + Freeplay</p>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Ready when you are</p>
        <p className="mt-1 text-5xl font-extrabold tabular-nums">{shown(masked, main)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/8 pt-4">
          <div>
            <p className="text-xs text-zinc-400">Available to cash out</p>
            <p className="mt-1 text-lg font-extrabold tabular-nums">{shown(masked, cash)}</p>
            <p className="text-[11px] text-zinc-500">Cash</p>
          </div>
          <div className="border-l border-white/8 pl-3">
            <p className="text-xs text-zinc-400">Freeplay</p>
            <p className="mt-1 text-lg font-extrabold tabular-nums">{shown(masked, freeplay)}</p>
            <p className="text-[11px] text-zinc-500">Play only</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href="/dashboard/deposit"
            className="flex items-center justify-center gap-1 rounded-full bg-primary py-3 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" /> Add money
          </Link>
          <Link
            href="/dashboard/withdraw"
            className="flex items-center justify-center gap-1 rounded-full bg-white/8 py-3 text-sm font-bold"
          >
            <ArrowDownToLine className="h-4 w-4" /> Cash out
          </Link>
        </div>
      </section>
    </>
  );
}
