import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPromoGeneratorCard } from "@/components/admin/admin-promo-generator-card";
import { AdminPlayerFollowupCard } from "@/components/admin/admin-player-followup-card";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Non-Coder Marketing Hub" };

export default async function AdminMarketingPage() {
  await requirePermission("cms.manage");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader
        title="Non-Coder Marketing & Player Follow-Up Hub"
        description="Generate 1-click promo codes, deposit match vouchers, and zero-cost automated email & WhatsApp follow-up campaigns."
      />

      <AdminPromoGeneratorCard />

      <AdminPlayerFollowupCard />
    </div>
  );
}
