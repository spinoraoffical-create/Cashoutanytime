"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  ExternalLink,
  Flame,
  Globe,
  Loader2,
  ShieldCheck,
  Smartphone,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PayMethod {
  id: string;
  value: string;
  name: string;
  amounts: string[];
}

export function DollarPayDepositSection({
  gameSlug,
  gameName,
}: {
  userId?: string;
  gameSlug?: string;
  gameName?: string;
  onSuccess?: () => void;
}) {
  const [methods, setMethods] = useState<PayMethod[]>([]);
  const [methodId, setMethodId] = useState("");
  const [selectedAmount, setSelectedAmount] = useState("19.99");
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [loading, setLoading] = useState(false);

  const selected = methods.find((m) => m.id === methodId) ?? methods[0];
  const amounts = selected?.amounts ?? [];
  const featured = amounts.slice(0, 12);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payments/paydora/methods")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list: PayMethod[] = data.deposits || [];
        setMethods(list);
        if (list[0]) {
          setMethodId(list[0].id);
          setSelectedAmount(list[0].amounts.includes("19.99") ? "19.99" : list[0].amounts[0]);
        }
        if (data.error) toast.error(data.error);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load instant payment methods.");
      })
      .finally(() => {
        if (!cancelled) setLoadingMethods(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function iconFor(value: string) {
    const v = value.toLowerCase();
    if (v.includes("apple")) return <Smartphone className="h-4 w-4 text-sky-400" />;
    if (v.includes("google")) return <Globe className="h-4 w-4 text-amber-400" />;
    if (v.includes("card")) return <CreditCard className="h-4 w-4 text-purple-400" />;
    return <Zap className="h-4 w-4 text-emerald-400" />;
  }

  async function handlePayNow() {
    if (!selected || !selectedAmount) {
      toast.error("Please choose a deposit amount.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/payments/paydora/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethodId: selected.id,
          amount: Number(selectedAmount),
          gameSlug,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || "Failed to initiate payment");
        return;
      }
      if (!data.payUrl) {
        toast.error("No checkout URL returned from payment server");
        return;
      }

      toast.success(`Opening ${selected.name} checkout...`);
      window.open(data.payUrl, "_blank", "noopener,noreferrer");

      if (data.depositId) {
        const started = Date.now();
        const methodValue = selected.value;
        const methodLabel = selected.name;
        const params = new URLSearchParams({
          id: data.depositId,
          method: methodValue,
          methodName: methodLabel,
        });
        if (gameSlug) params.set("gameSlug", gameSlug);
        if (gameName) params.set("gameName", gameName);
        const timer = window.setInterval(async () => {
          if (Date.now() - started > 3 * 60 * 1000) {
            window.clearInterval(timer);
            return;
          }
          const statusRes = await fetch(`/api/payments/paydora/status?${params.toString()}`);
          const status = await statusRes.json();
          if (status.credited) {
            window.clearInterval(timer);
            toast.success(`$${Number(status.paidAmount ?? status.amount).toFixed(2)} added to your wallet.`);
          }
        }, 8000);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[rgba(0,229,255,0.2)] bg-gradient-to-b from-[#12122b] to-[#0a0a18] p-4 sm:p-6 shadow-2xl relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#00E5FF]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[rgba(0,229,255,0.1)]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30">
            <Zap className="h-5 w-5 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
              Instant Automated Deposit
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Auto-Credit
              </span>
            </h3>
            <p className="text-xs text-[#7af5ff]/70">
              No receipt upload required. Your wallet is credited after payment.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-5">
        <label className="text-xs font-semibold text-[#8b8dae] uppercase tracking-wider block mb-2">
          Select Payment Method
        </label>
        {loadingMethods ? (
          <div className="flex items-center gap-2 text-xs text-[#8b8dae] py-3">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading methods...
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMethodId(m.id);
                  if (!m.amounts.includes(selectedAmount)) setSelectedAmount(m.amounts[0]);
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl py-3 px-3 text-xs font-bold transition-all border",
                  selected?.id === m.id
                    ? "bg-gradient-to-r from-[rgba(0,229,255,0.15)] to-purple-500/20 border-[#00E5FF] text-white shadow-[0_0_15px_rgba(0,229,255,0.25)] scale-[1.02]"
                    : "bg-[#0b0b1a] border-white/10 text-[#6b6d8f] hover:text-white hover:border-white/20"
                )}
              >
                {iconFor(m.value)}
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-[#8b8dae] uppercase tracking-wider block">
            Select Deposit Amount (USD)
          </label>
          <span className="text-[11px] text-amber-400 flex items-center gap-1 font-medium">
            <Flame className="h-3.5 w-3.5" />
            Supported Tiers
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {featured.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setSelectedAmount(amt)}
              className={cn(
                "rounded-xl py-2.5 px-2 text-sm font-bold transition-all border text-center flex flex-col items-center justify-center",
                selectedAmount === amt
                  ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)] scale-105"
                  : "bg-[#0c0c1e] border-white/10 text-[#8b8dae] hover:text-white hover:border-white/20"
              )}
            >
              <span className="text-xs text-gray-400 font-normal">$</span>
              <span className="text-base">{amt}</span>
            </button>
          ))}
        </div>

        {amounts.length > 0 && (
          <div className="mt-3">
            <select
              value={selectedAmount}
              onChange={(e) => setSelectedAmount(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0c0c1e] px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
            >
              {amounts.map((amt) => (
                <option key={amt} value={amt}>
                  Deposit Tier: ${amt} USD
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-[#090915] p-3.5 border border-white/5 mb-5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-gray-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Automated Instant Credit</span>
        </div>
        <div className="text-right">
          <span className="text-gray-400 mr-1">Total:</span>
          <span className="font-bold text-base text-emerald-400">${selectedAmount || "0.00"} USD</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handlePayNow}
        disabled={loading || loadingMethods || !selected}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-4 px-6 text-base font-extrabold text-black bg-gradient-to-r from-emerald-400 via-teal-400 to-[#00E5FF] hover:opacity-95 transition-all shadow-[0_0_20px_rgba(0,229,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Connecting to {selected?.name || "checkout"}...
          </>
        ) : (
          <>
            <ExternalLink className="h-5 w-5" />
            Pay ${selectedAmount || "0.00"} via {selected?.name || "checkout"} Now
          </>
        )}
      </button>
    </div>
  );
}
