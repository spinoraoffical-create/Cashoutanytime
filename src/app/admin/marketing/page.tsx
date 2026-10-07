import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPromoGeneratorCard } from "@/components/admin/admin-promo-generator-card";
import { AdminPlayerFollowupCard } from "@/components/admin/admin-player-followup-card";
import { can, requirePermission } from "@/lib/data/admin";
import { getConsentedPhoneOutreach } from "@/lib/data/admin-phone-outreach";

export const metadata: Metadata = { title: "Marketing" };

export default async function AdminMarketingPage() {
  const staff = await requirePermission("cms.manage");
  const canViewPhones = can(staff, "users.manage");
  const outreach = canViewPhones ? await getConsentedPhoneOutreach() : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader
        title="Marketing"
        description="Promo codes, plus one-to-one phone follow-ups for players who opted in. Email campaigns are sent from Newsletters."
      />

      <AdminPromoGeneratorCard />

      <AdminPlayerFollowupCard canView={canViewPhones} outreach={outreach} />
    </div>
  );
}
