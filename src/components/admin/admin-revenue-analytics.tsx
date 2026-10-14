import Link from "next/link";

import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";

export function AdminRevenueAnalytics() {
  return (
    <AdminSectionCard title="Reports are not connected yet" description="Deposit totals, player counts, fulfillment rates, and payout times are not loaded on this page. This screen does not show revenue.">
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-4">
        <Link href="/admin/deposits" className="text-sm font-semibold text-cyan-200 hover:underline">
          Deposits
        </Link>
        <Link href="/admin/payouts" className="text-sm font-semibold text-cyan-200 hover:underline">
          Cash outs
        </Link>
        <Link href="/admin/newsletters" className="text-sm font-semibold text-cyan-200 hover:underline">
          Email campaigns
        </Link>
      </div>
    </AdminSectionCard>
  );
}
