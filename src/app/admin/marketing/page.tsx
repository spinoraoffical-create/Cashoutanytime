import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPromoGeneratorCard } from "@/components/admin/admin-promo-generator-card";
import { AdminPlayerFollowupCard } from "@/components/admin/admin-player-followup-card";
import { can, requirePermission } from "@/lib/data/admin";
import { getConsentedPhoneOutreach } from "@/lib/data/admin-phone-outreach";

export const metadata: Metadata = { title: "Phone and WhatsApp" };

export default async function AdminMarketingPage() {
  const staff = await requirePermission("cms.manage");
  const canViewPhones = can(staff, "users.manage");
  const outreach = canViewPhones ? await getConsentedPhoneOutreach() : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader
        title="Phone and WhatsApp, one person at a time"
        description="Copy one text or open one WhatsApp chat for a player who opted in. This page does not send in bulk. Email campaigns stay under Marketing."
      />

      <AdminPromoGeneratorCard />

      <AdminPlayerFollowupCard canView={canViewPhones} outreach={outreach} />
    </div>
  );
}
