import Link from "next/link";

import { GlassCard } from "@/components/shared/glass-card";

export function AdminRevenueAnalytics() {
  return (
    <GlassCard className="p-5">
      <h2 className="text-base font-semibold">Reports are not connected yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Deposit totals, player counts, fulfillment rates, and payout times are not loaded on this page.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-4">
        <Link href="/admin/deposits" className="text-sm font-semibold text-primary hover:underline">
          Deposits
        </Link>
        <Link href="/admin/payouts" className="text-sm font-semibold text-primary hover:underline">
          Cash outs
        </Link>
        <Link href="/admin/newsletters" className="text-sm font-semibold text-primary hover:underline">
          Email campaigns
        </Link>
      </div>
    </GlassCard>
  );
}
