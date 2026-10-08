import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminToolGrid } from "@/components/admin/admin-tool-grid";
import { requireSuperAdmin } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  await requireSuperAdmin();

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Security"
        description="Fraud flags and the audit log. Only a Super Admin can open this section."
      />
      <AdminToolGrid
        tools={[
          {
            href: "/admin/fraud",
            title: "Fraud flags",
            body: "Review blocked or high-risk players. Clearing a flag asks you to confirm and writes an audit entry.",
          },
          {
            href: "/admin/audit",
            title: "Audit logs",
            body: "Who changed money, players, support, and settings, and when.",
          },
        ]}
      />
    </div>
  );
}
