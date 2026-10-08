"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
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
  const [method, setMethod] = useState<PayMethod | null>(null);
  const [selectedAmount, setSelectedAmount] = useState("");
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [loading, setLoading] = useState(false);

  const amounts = method?.amounts ?? [];

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payments/paydora/methods")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list: PayMethod[] = data.deposits || [];
        setMethods(list);
        setMethod(list[0] ?? null);
        if (data.error) toast.error(friendlyPlayerError(data.error, DEPOSITS_UNAVAILABLE));
      })
      .catch(() => {
        if (!cancelled) toast.error(DEPOSITS_UNAVAILABLE);
      })
      .finally(() => {
        if (!cancelled) setLoadingMethods(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePayNow() {
    if (!selectedAmount) {
      toast.error("Please choose a deposit amount.");
      return;
    }
    if (!gameSlug) {
      toast.error("Choose a game before paying.");
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

    const params = new URLSearchParams(window.location.search);
    const promoCode = params.get("promo") || params.get("ref") || "";

    setLoading(true);
    try {
      const res = await fetch("/api/payments/paydora/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethodId: method?.id,
          amount: Number(selectedAmount),
          gameSlug,
          gameName,
          promoCode,
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

      toast.success("Opening Paydora checkout...");
      window.open(data.payUrl, "_blank", "noopener,noreferrer");

      if (data.depositId) {
        const started = Date.now();
        const statusParams = new URLSearchParams({ id: data.depositId });
        if (gameSlug) statusParams.set("gameSlug", gameSlug);
        if (gameName) statusParams.set("gameName", gameName);
        const timer = window.setInterval(async () => {
          if (Date.now() - started > 3 * 60 * 1000) {
            window.clearInterval(timer);
            return;
          }
          const statusRes = await fetch(`/api/payments/paydora/status?${statusParams.toString()}`);
          const status = await statusRes.json();
          if (status.credited) {
            window.clearInterval(timer);
            toast.success("Paydora confirmed the payment. Your wallet is credited.");
          }
        }, 8000);
      }
    } catch (err) {
      toast.error(friendlyPlayerError(err instanceof Error ? err.message : "", DEPOSITS_UNAVAILABLE));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {gamePicker}
      <p className="text-sm text-[#b9b3c6]">Your wallet is credited when Paydora confirms the payment.</p>
      {loadingMethods ? (
        <p className="flex items-center gap-2 text-sm text-[#b9b3c6]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading Paydora checkout...
        </p>
      ) : !method ? (
        <p className="text-sm text-[#b9b3c6]">Paydora checkout is not available right now.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {methods.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMethod(item);
                  setSelectedAmount("");
                }}
                className={`h-11 rounded-xl border text-sm font-bold ${
                  method?.id === item.id
                    ? "border-[#ff6b89] bg-[#ff6b89] text-[#0f172a]"
                    : "border-white/10 bg-[#160812] text-[#fcf9fb]"
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {amounts.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setSelectedAmount(amt)}
                className={`h-11 rounded-xl border text-sm font-bold ${
                  selectedAmount === amt
                    ? "border-[#ff6b89] bg-[#ff6b89] text-[#0f172a]"
                    : "border-white/10 bg-[#160812] text-[#fcf9fb]"
                }`}
              >
                $ {amt}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handlePayNow}
            disabled={loading || !selectedAmount}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ff6b89] text-base font-bold text-[#0f172a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ExternalLink className="h-5 w-5" />}
            Pay with Paydora
          </button>
        </>
      )}
    </div>
  );
}
