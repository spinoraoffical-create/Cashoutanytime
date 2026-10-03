import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminKYCReviewCard } from "@/components/admin/admin-kyc-review-card";
import { getAdminKYCSubmissions, getKYCSystemStatus } from "@/lib/actions/kyc-actions";
import { requirePermission } from "@/lib/data/admin";
import { GlassCard } from "@/components/shared/glass-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = { title: "KYC Review Center" };

export default async function AdminKYCPage() {
  await requirePermission("cms.manage");

  const submissions = await getAdminKYCSubmissions();
  const system = await getKYCSystemStatus();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader
        title="1-Click Non-Coder KYC Review Center"
        description="Review player government IDs, approve age verification (18+), and grant Verified Player Badges."
      />

      {!system.ready && (
        <GlassCard className="border-rose-500/40 bg-rose-500/5 p-4">
          <p className="text-sm font-bold text-rose-400">KYC database not configured</p>
          <p className="mt-1 text-xs text-muted-foreground">{system.error}</p>
        </GlassCard>
      )}

      <AdminKYCReviewCard initialSubmissions={submissions} />
    </div>
  );
}
