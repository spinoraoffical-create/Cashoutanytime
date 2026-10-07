"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DEPOSITS_UNAVAILABLE, friendlyPlayerError } from "@/lib/player-safe-error";

function deviceFingerprint() {
  const key = "hub-device-id";
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return "browser";
  }
}

interface PayMethod {
  id: string;
  value: string;
  name: string;
  amounts: string[];
}

function MethodMark({ name }: { name: string }) {
  const n = name.toLowerCase();
  if (n.includes("card") || n.includes("visa") || n.includes("debit")) {
    return (
      <span className="inline-flex h-8 items-center gap-1 rounded-md bg-white px-2 text-[11px] font-black tracking-wide text-[#1a1f71]">
        VISA
        <span className="text-[#eb001b]">●</span>
        <span className="-ml-1.5 text-[#f79e1b]">●</span>
      </span>
    );
  }
  if (n.includes("google")) {
    return (
      <span className="inline-flex h-8 items-center rounded-md bg-white px-2 text-sm font-black text-[#4285F4]">
        G Pay
      </span>
    );
  }
  if (n.includes("apple")) {
    return (
      <span className="inline-flex h-8 items-center rounded-md bg-black px-2 text-sm font-black text-white">
        Pay
      </span>
    );
  }
  if (n.includes("chime")) {
    return (
      <span className="grid h-8 w-8 place-items-center rounded-md bg-[#1ec677] text-sm font-black text-white">
        C
      </span>
    );
  }
  if (n.includes("cash")) {
    return (
      <span className="grid h-8 w-8 place-items-center rounded-md bg-[#00d632] text-sm font-black text-white">
        $
      </span>
    );
  }
  if (n.includes("paypal")) {
    return (
      <span className="inline-flex h-8 items-center rounded-md bg-white px-2 text-sm font-black text-[#003087]">
        PayPal
      </span>
    );
  }
  if (n.includes("light")) {
    return (
      <span className="grid h-8 w-8 place-items-center rounded-md bg-[#f7931a] text-sm font-black text-white">
        ⚡
      </span>
    );
  }
  if (n.includes("bit") || n.includes("crypto")) {
    return (
      <span className="grid h-8 w-8 place-items-center rounded-md bg-[#f7931a] text-sm font-black text-white">
        ₿
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 items-center rounded-md bg-white px-2 text-xs font-black text-[#24152e]">
      {name.slice(0, 6)}
    </span>
  );
}

export function DollarPayDepositSection({
  gameSlug,
  gameName,
  gamePicker,
}: {
  userId?: string;
  gameSlug?: string;
  gameName?: string;
  onSuccess?: () => void;
  gamePicker?: ReactNode;
}) {
  const [methods, setMethods] = useState<PayMethod[]>([]);
  const [methodId, setMethodId] = useState("");
  const [selectedAmount, setSelectedAmount] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [loading, setLoading] = useState(false);

  const selected = methods.find((m) => m.id === methodId);
  const amounts = selected?.amounts ?? [];

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payments/paydora/methods")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list: PayMethod[] = data.deposits || [];
        setMethods(list);
        if (data.error) toast.error(friendlyPlayerError(data.error, DEPOSITS_UNAVAILABLE));
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

  async function handlePayNow() {
      if (!selected || !selectedAmount) {
      toast.error("Please choose a deposit amount.");
      return;
    }
    const limit = Number(localStorage.getItem("hub-deposit-limit") || 0);
    if (limit > 0 && Number(selectedAmount) > limit) {
      toast.error(`Your deposit limit is $${limit.toFixed(2)}. Change it in Responsible play.`);
      return;
    }
    const pausedUntil = localStorage.getItem("hub-play-timeout");
    if (pausedUntil && new Date(pausedUntil).getTime() > Date.now()) {
      toast.error("Play is paused from your responsible play settings.");
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
          deviceFingerprint: deviceFingerprint(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(friendlyPlayerError(data.error, DEPOSITS_UNAVAILABLE));
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
      toast.error(
        friendlyPlayerError(err instanceof Error ? err.message : "", DEPOSITS_UNAVAILABLE)
      );
    } finally {
      setLoading(false);
    }
  }

  const minAmount = amounts.length ? Math.min(...amounts.map(Number)) : 0;
  const maxAmount = amounts.length ? Math.max(...amounts.map(Number)) : 0;
  const floor = methods.reduce((low, method) => {
    const mins = method.amounts.map(Number).filter((n) => Number.isFinite(n));
    if (!mins.length) return low;
    const methodMin = Math.min(...mins);
    return low == null ? methodMin : Math.min(low, methodMin);
  }, null as number | null);

  const stepLabel = step === 1 ? "Choose payment method" : step === 2 ? "Enter amount" : "Confirm & pay";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((n, index) => (
          <div key={n} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black",
                step === n ? "bg-[#ff6b89] text-[#3a1020]" : "bg-white/10 text-[#b9b3c6]"
              )}
            >
              {n}
            </span>
            {index < 2 ? <span className="h-px min-w-4 flex-1 bg-white/15" /> : null}
          </div>
        ))}
      </div>
      <p className="text-sm text-[#b9b3c6]">
        Step {step} of 3 · {stepLabel}
      </p>

      {step === 1 ? (
        <div className="space-y-3">
          {gamePicker}
          <div className="flex items-end justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.14em]">Choose a payment method</p>
            <p className="text-xs text-[#b9b3c6]">from ${floor == null ? "0.00" : floor.toFixed(2)}</p>
          </div>
          {loadingMethods ? (
            <p className="flex items-center gap-2 text-sm text-[#b9b3c6]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading methods...
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {methods.map((m) => {
                const min = m.amounts.length ? Math.min(...m.amounts.map(Number)).toFixed(2) : "";
                const on = selected?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMethodId(m.id);
                      setSelectedAmount("");
                    }}
                    className={cn(
                      "rounded-2xl border px-3 py-3 text-left",
                      on ? "border-[#ff6b89] bg-[#ff6b89]/10" : "border-white/10 bg-[#1a1024]"
                    )}
                  >
                    <MethodMark name={m.name} />
                    <span className="mt-3 block text-sm font-bold">{m.name}</span>
                    <span className="mt-0.5 block text-xs text-[#b9b3c6]">
                      {min ? `Min $${min}` : "Available"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            disabled={!selected}
            onClick={() => setStep(2)}
            className={cn(
              "flex h-12 w-full items-center justify-center rounded-xl text-base font-bold",
              selected
                ? "bg-[#ff6b89] text-[#3a1020]"
                : "cursor-not-allowed bg-[#2a1830] text-[#8d8498]"
            )}
          >
            {selected ? "Continue →" : "Select a payment method"}
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <button type="button" onClick={() => setStep(1)} className="text-sm font-bold text-[#b9b3c6]">
            ← Change payment method
          </button>
          <p className="text-sm font-bold">Step 2 of 3 · Enter amount</p>
          <p className="text-xs text-[#b9b3c6]">
            Min ${minAmount.toFixed(2)} · Max ${maxAmount.toFixed(2)}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {amounts.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setSelectedAmount(amt)}
                className={cn(
                  "h-11 rounded-xl border text-sm font-bold",
                  selectedAmount === amt
                    ? "border-[#ff6b89] bg-[#ff6b89] text-[#0f172a]"
                    : "border-white/10 bg-[#160812] text-[#fcf9fb]"
                )}
              >
                $ {amt}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!selectedAmount}
            onClick={() => setStep(3)}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#ff6b89] text-base font-bold text-[#0f172a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {selectedAmount ? `Pay $${selectedAmount} →` : "Continue — pay $0.00"}
          </button>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <button type="button" onClick={() => setStep(2)} className="text-sm font-bold text-[#b9b3c6]">
            ← Change amount
          </button>
          <p className="text-sm font-bold">Step 3 of 3 · Confirm & pay</p>
          <div className="rounded-2xl border border-white/10 bg-[#160812] p-4 text-sm">
            <p className="font-bold">{selected?.name}</p>
            <p className="mt-1 text-[#b9b3c6]">{gameName ? `For ${gameName}` : "Wallet"}</p>
            <p className="mt-3 text-2xl font-black">${selectedAmount}</p>
          </div>
          <button
            type="button"
            onClick={handlePayNow}
            disabled={loading || !selected || !selectedAmount}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ff6b89] text-base font-bold text-[#0f172a] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ExternalLink className="h-5 w-5" />}
            Pay ${selectedAmount || "0.00"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
