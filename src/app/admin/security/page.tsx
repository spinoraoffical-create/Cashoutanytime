import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminQuickAction } from "@/components/admin/ui/admin-quick-action";
import { requireSuperAdmin } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  await requireSuperAdmin();

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Security Center"
        description="Opens the fraud list and the audit log that already exist. This page does not score security, and only a Super Admin can open it."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminQuickAction
          href="/admin/fraud"
          label="Fraud flags"
          detail="Players already flagged by the existing rules. Clearing a flag still asks you to confirm and writes an audit entry."
        />
        <AdminQuickAction
          href="/admin/audit"
          label="Audit log"
          detail="Read-only record of staff actions already stored. This page does not add or delete a log row."
        />
      </div>
    </div>
  );
}
