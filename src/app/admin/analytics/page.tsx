import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminRevenueAnalytics } from "@/components/admin/admin-revenue-analytics";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Revenue & Analytics" };

export default async function AdminAnalyticsPage() {
  await requirePermission("cms.manage");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader
        title="Revenue & Player Analytics Command Center"
        description="Monitor real-time deposit volumes, bot auto-fulfillment rates, top game performance, and player VIP tier distributions."
      />

      <AdminRevenueAnalytics />
    </div>
  );
}
