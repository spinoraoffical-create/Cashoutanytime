import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminRevenueAnalytics } from "@/components/admin/admin-revenue-analytics";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Reports" };

export default async function AdminAnalyticsPage() {
  await requirePermission("analytics.read");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader
        title="Reports"
        description="Open deposits, cash outs, or email campaigns. Revenue totals are not connected yet."
      />
      <AdminRevenueAnalytics />
    </div>
  );
}
