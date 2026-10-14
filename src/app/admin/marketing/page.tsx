import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPromoGeneratorCard } from "@/components/admin/admin-promo-generator-card";
import { AdminPlayerFollowupCard } from "@/components/admin/admin-player-followup-card";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { can, requirePermission } from "@/lib/data/admin";
import { getConsentedPhoneOutreach } from "@/lib/data/admin-phone-outreach";

export const metadata: Metadata = { title: "Text one player" };

export default async function AdminMarketingPage() {
  const staff = await requirePermission("cms.manage");
  const canViewPhones = can(staff, "users.manage");
  const outreach = canViewPhones ? await getConsentedPhoneOutreach() : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader
        title="Text one player"
        description="Copy one text or open one WhatsApp chat for a player who opted in. This page does not send bulk SMS or WhatsApp. Email campaigns and Telegram posts are separate tools."
      />

      <AdminSectionCard
        title="What this page does"
        description="Copy puts the text on your clipboard. WhatsApp opens one chat. Neither button sends a bulk message."
      >
        <p className="text-sm leading-5 text-[#9fb0d0]">
          {canViewPhones
            ? "The player list below is limited to people who agreed to SMS or WhatsApp."
            : "Phone numbers stay hidden unless your account can manage players."}
        </p>
      </AdminSectionCard>

      <AdminPromoGeneratorCard />
      <AdminPlayerFollowupCard canView={canViewPhones} outreach={outreach} />
    </div>
  );
}
