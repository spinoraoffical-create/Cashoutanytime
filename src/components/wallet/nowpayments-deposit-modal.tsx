"use client";

import { useState } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Coins, Zap, ShieldCheck, ArrowRight, ExternalLink, CheckCircle2 } from "lucide-react";

export function NowPaymentsDepositModal() {
  const [amount, setAmount] = useState<number>(20);
  const [currency, setCurrency] = useState<string>("usdttrc20");
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<{ invoice_url?: string; pay_address?: string } | null>(null);

  async function handleCreateInvoice() {
    if (amount < 5) {
      toast.error("Minimum deposit amount is $5");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/payments/nowpayments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency, userId: "guest_user" }),
      });

      const data = await res.json();
      setLoading(false);

      if (data.invoice_url) {
        setPaymentData(data);
        toast.success(`🚀 Invoice created! Pay $${amount} via NOWPayments`);
        window.open(data.invoice_url, "_blank");
      } else {
        toast.error(data.error || "Could not generate invoice");
      }
    } catch {
      setLoading(false);
      toast.error("Error connecting to NOWPayments API");
    }
  }

  return (
    <GlassCard className="p-6 border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-zinc-900 to-black space-y-5">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">NOWPayments 100+ Crypto Gateway</h3>
            <p className="text-xs text-muted-foreground">Instant automated crediting for USDT, BTC, ETH, SOL & Cash App Crypto.</p>
          </div>
        </div>
        <Badge className="bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">
          AUTOMATED IPN
        </Badge>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
            Deposit Amount ($USD):
          </label>
          <div className="flex gap-2">
            {[10, 20, 50, 100, 250].map((val) => (
              <Button
                key={val}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAmount(val)}
                className={`flex-1 text-xs font-extrabold rounded-xl border-amber-500/30 ${
                  amount === val ? "bg-amber-500 text-black border-amber-500" : "bg-zinc-900/60"
                }`}
              >
                ${val}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
            Select Cryptocurrency:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrency("usdttrc20")}
              className={`py-4 font-bold rounded-xl ${
                currency === "usdttrc20" ? "border-amber-500 bg-amber-500/20 text-amber-300" : "border-border/60"
              }`}
            >
              💎 USDT (TRC20)
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrency("btc")}
              className={`py-4 font-bold rounded-xl ${
                currency === "btc" ? "border-amber-500 bg-amber-500/20 text-amber-300" : "border-border/60"
              }`}
            >
              ⚡ BTC (Bitcoin)
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrency("eth")}
              className={`py-4 font-bold rounded-xl ${
                currency === "eth" ? "border-amber-500 bg-amber-500/20 text-amber-300" : "border-border/60"
              }`}
            >
              🔷 ETH (Ethereum)
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrency("sol")}
              className={`py-4 font-bold rounded-xl ${
                currency === "sol" ? "border-amber-500 bg-amber-500/20 text-amber-300" : "border-border/60"
              }`}
            >
              ☀️ SOL (Solana)
            </Button>
          </div>
        </div>

        <Button
          onClick={handleCreateInvoice}
          disabled={loading}
          className="w-full py-6 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-extrabold text-sm rounded-2xl shadow-xl shadow-amber-500/20 gap-2"
        >
          <Zap className="h-4 w-4" />
          {loading ? "Generating Payment Invoice..." : `Deposit $${amount} via NOWPayments`}
        </Button>

        {paymentData?.invoice_url && (
          <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-300 space-y-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Invoice Ready!
            </span>
            <a
              href={paymentData.invoice_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-extrabold underline flex items-center gap-1 hover:text-emerald-200"
            >
              Open Invoice <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
