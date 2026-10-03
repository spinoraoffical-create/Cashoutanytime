import type { Metadata } from "next";
import Link from "next/link";
import { getProfile } from "@/lib/supabase/session";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Banknote, AlertCircle, ArrowRight, Wallet } from "lucide-react";

export const metadata: Metadata = {
  title: "Withdraw & Cash Out",
};

export default async function DashboardWithdrawPage() {
  const profile = await getProfile();
  const isVerified = (profile as any)?.kyc_status === "verified";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-foreground">💵 Withdraw & Cash Out Wallet</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Request instant cashouts from your game winnings directly to Cash App, USDT, PayPal, or Zelle.
        </p>
      </div>

      {!isVerified ? (
        <GlassCard className="p-6 border-amber-500/40 bg-amber-500/10 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
            <ShieldCheck className="h-8 w-8" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-foreground">🛡️ KYC Verification Required Before Cashout</h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
              To prevent bonus fraud and comply with age verification laws (18+), please upload your ID document before requesting your first withdrawal.
            </p>
          </div>

          <Link href="/dashboard/kyc" className="inline-block">
            <Button className="bg-amber-500 text-black hover:bg-amber-400 font-bold px-6 py-5 rounded-xl text-sm gap-2">
              <ShieldCheck className="h-4 w-4" /> Complete KYC ID Verification Now <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </GlassCard>
      ) : (
        <GlassCard className="p-6">
          <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Banknote className="h-5 w-5 text-emerald-400" />
                Select Cashout Payment Method
              </h2>
              <p className="text-xs text-muted-foreground">Your account is verified! Cashouts arrive in 5 to 15 minutes.</p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              VERIFIED PLAYER
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { name: "Cash App ($Cashtag)", icon: "💚", time: "5-15 mins" },
              { name: "USDT (TRC-20 / ERC-20)", icon: "🌐", time: "5 mins" },
              { name: "PayPal Direct", icon: "💙", time: "15 mins" },
              { name: "Zelle Transfer", icon: "⚡", time: "15 mins" },
            ].map((method) => (
              <div
                key={method.name}
                className="rounded-xl border border-border/60 bg-background/60 p-4 hover:border-amber-500/40 transition-all flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <span>{method.icon}</span> {method.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">Speed: {method.time}</span>
                </div>
                <Link href="/dashboard/games">
                  <Button size="sm" className="bg-amber-500 text-black hover:bg-amber-400 font-bold text-xs">
                    Cash Out
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
