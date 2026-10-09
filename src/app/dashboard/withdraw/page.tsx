import type { Metadata } from "next";
import Link from "next/link";
import { getProfile } from "@/lib/supabase/session";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { CashoutRequestForm } from "@/components/player/cashout-request-form";
import { getPaydoraPaymentMethods } from "@/lib/payments/paydora";
import { ShieldCheck, Banknote, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Withdraw & Cash Out",
};

export default async function DashboardWithdrawPage() {
  const profile = await getProfile();
  const kyc = (profile as { kyc_status?: string | null; cashout_wallet?: number | null } | null)?.kyc_status;
  const isVerified = kyc === "verified" || kyc === "approved";
  const balance = Number((profile as { cashout_wallet?: number | null } | null)?.cashout_wallet ?? 0);
  let methods: { value: string; name: string }[] = [];
  if (isVerified) {
    try {
      const catalog = await getPaydoraPaymentMethods();
      methods = catalog.withdrawals.map((method) => ({ value: method.value, name: method.name }));
    } catch {
      methods = [];
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-foreground">Cash out</h1>
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
            <h2 className="text-lg font-bold text-foreground">Verification required before cash out</h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
              To prevent bonus fraud and comply with age verification laws (18+), please upload your ID document before requesting your first withdrawal.
            </p>
          </div>

          <Link href="/dashboard/kyc" className="inline-block">
            <Button className="bg-[#f3264f] text-white hover:bg-[#b70d3a] font-bold px-6 py-5 rounded-xl text-sm gap-2">
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

          <CashoutRequestForm balance={balance} methods={methods} />
        </GlassCard>
      )}
    </div>
  );
}
