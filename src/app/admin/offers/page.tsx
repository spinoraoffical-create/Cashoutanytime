import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { OfferSendForm } from "@/components/admin/offer-send-form";
import { countOfferAudience, offerScopeForCurrentUser } from "@/lib/offers/send";

export const metadata: Metadata = { title: "Offers" };

export default async function OffersPage() {
  const scope = await offerScopeForCurrentUser();
  if (!scope) redirect("/admin");
  const counts = await countOfferAudience(scope).catch(() => ({ email: 0, sms: 0 }));

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        title="Offers"
        description="One email and one SMS for players who agreed to offers. A second click the same day does not send again."
      />
      <OfferSendForm emailCount={counts.email} smsCount={counts.sms} />
    </div>
  );
}
