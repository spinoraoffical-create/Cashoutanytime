import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminKYCReviewCard } from "@/components/admin/admin-kyc-review-card";
import { AdminErrorState } from "@/components/admin/ui/admin-error-state";
import { getAdminKYCSubmissions, getKYCSystemStatus } from "@/lib/actions/kyc-actions";
import { requirePermission } from "@/lib/data/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = { title: "Verification Center" };

export default async function AdminKYCPage() {
  await requirePermission("kyc.manage");

  const submissions = await getAdminKYCSubmissions();
  const system = await getKYCSystemStatus();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader
        title="Verification Center"
        description="Review identity checks players already sent. Approve and Reject use the existing review action. A photo opens only for someone who can already open this page."
      />

      {!system.ready && (
        <AdminErrorState
          title="Identity checks are not ready"
          body={system.error || "The identity list could not be loaded."}
        />
      )}

      <AdminKYCReviewCard initialSubmissions={submissions} />
    </div>
  );
}
