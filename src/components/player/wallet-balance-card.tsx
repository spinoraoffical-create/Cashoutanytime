"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Plus, RefreshCw, Send, Shield, Sparkles, ArrowDownToLine } from "lucide-react";
import { useBalanceMask } from "@/lib/wallet/balance-mask";
import { WALLET_REFRESH_EVENT } from "@/lib/wallet/use-live-wallet";

function shown(masked: boolean, n: number) {
  if (masked) return "••••";
  const [dollars, cents] = n.toFixed(2).split(".");
  return `$ ${dollars} . ${cents}`;
}

export function WalletBalanceCard({
  main,
  cash,
  freeplay,
  name = "Player",
}: {
  main: number;
  cash: number;
  freeplay: number;
  name?: string;
}) {
  const { masked, toggle } = useBalanceMask();
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);
  const initial = name.slice(0, 2).toUpperCase();

  function refresh() {
    setSpinning(true);
    window.dispatchEvent(new Event(WALLET_REFRESH_EVENT));
    router.refresh();
    window.setTimeout(() => setSpinning(false), 700);
  }

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#b9b3c6]">Money</p>
          <h1 className="mt-1 text-4xl font-black leading-10">Wallet</h1>
          <p className="mt-2 text-sm text-[#b9b3c6]">Balances and money actions, clearly separated.</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/8 text-[#b9b3c6]"
          aria-label="Refresh wallet balance"
        >
          <RefreshCw className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
        </button>
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
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#f4c64e]">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-[#f4c64e] text-[10px] text-[#241608]">{initial}</span>
          Hi, {name}
        </p>
        <p className="mt-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Main wallet balance
        </p>
        <p className="mt-1 text-5xl font-black tracking-wide tabular-nums">{shown(masked, main)}</p>
        <p className="mt-1 text-sm text-[#b9b3c6]">Cash and Freeplay in Main Wallet.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#160812] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-300">
              <Shield className="h-3.5 w-3.5" /> Cash-out ready
            </p>
            <p className="mt-2 text-2xl font-black tabular-nums">{shown(masked, cash)}</p>
            <p className="text-xs text-[#b9b3c6]">Available for a payout request</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#160812] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#f4c64e]">
              <Sparkles className="h-3.5 w-3.5" /> Freeplay balance
            </p>
            <p className="mt-2 text-2xl font-black tabular-nums">{shown(masked, freeplay)}</p>
            <p className="text-xs text-[#b9b3c6]">Play only — not cash</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#160812] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#ffb020]">
              <Sparkles className="h-3.5 w-3.5" /> Instant play balance
            </p>
            <p className="mt-2 text-2xl font-black tabular-nums">{shown(masked, 0)}</p>
            <p className="text-xs text-[#b9b3c6]">Shared across Instant Games</p>
          </div>
        </div>
        <details className="mt-3 border-t border-white/10">
          <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm text-[#b9b3c6] [&::-webkit-details-marker]:hidden">
            <span className="grid h-4 w-4 place-items-center rounded-full border border-white/20 text-[10px]">?</span>
            What do these mean?
          </summary>
          <p className="pb-3 text-sm text-[#b9b3c6]">
            Main Wallet is cash plus freeplay. Cash-out ready is what you can request as a payout. Freeplay can be played and is not cash. Instant play is not on this floor, so that balance stays at zero.
          </p>
        </details>
        <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
          <a
            href="#add-money"
            onClick={(event) => {
              const target = document.getElementById("add-money");
              if (!target) return;
              event.preventDefault();
              target.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="flex h-12 items-center justify-center gap-1 rounded-xl border border-[#ff6b89] text-sm font-bold text-[#ff8aa3]"
          >
            <Plus className="h-4 w-4" /> Add money
          </a>
          <Link
            href="/dashboard/withdraw"
            className="flex h-12 items-center justify-center gap-1 rounded-xl border border-white/10 text-sm font-bold"
          >
            <ArrowDownToLine className="h-4 w-4" /> Cash out
          </Link>
          <span className="flex h-12 items-center justify-center gap-1 rounded-xl border border-white/10 text-sm font-bold text-[#b9b3c6]">
            <Send className="h-4 w-4" /> Send
          </span>
        </div>
      </section>
    </>
  );
}
