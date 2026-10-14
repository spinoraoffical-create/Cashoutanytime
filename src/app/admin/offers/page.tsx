import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { OfferSendForm } from "@/components/admin/offer-send-form";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { countOfferAudience, offerScopeForCurrentUser } from "@/lib/offers/send";

export const metadata: Metadata = { title: "Offers" };

export default async function OffersPage() {
  const scope = await offerScopeForCurrentUser();
  if (!scope) redirect("/admin");
  const counts = await countOfferAudience(scope).catch(() => ({ email: 0, sms: 0 }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <AdminPageHeader
        title="One-time offers"
        description="One email and one SMS for players who agreed to offers. A second click the same day does not send again. Suspended and banned players stay out. This page does not send WhatsApp."
      />
      <AdminSectionCard
        title="Eligible audience"
        description="The counts use the existing offer rules. Email includes players with promotional email on. SMS includes players with marketing texts on. A count of zero means that channel has nobody eligible right now."
      >
        <p className="text-sm text-white">Email {counts.email}. SMS {counts.sms}.</p>
        <p className="mt-2 text-sm leading-5 text-[#9fb0d0]">
          Send uses the existing offer action. It emails and texts those counted players. This screen does not ask for a second confirmation.
        </p>
      </AdminSectionCard>
      <AdminSectionCard title="Message" description="Viewing this form does not send. Send is the button that delivers the offer.">
        <OfferSendForm emailCount={counts.email} smsCount={counts.sms} />
      </AdminSectionCard>
    </div>
  );
}
