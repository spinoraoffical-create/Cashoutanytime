import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { loadReconciliationAlerts } from "@/lib/admin/reconciliation-data";
import { getStaffContext } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Reconciliation" };

export default async function ReconciliationPage({
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getStaffContext();
  if (!ctx?.isSuperAdmin) redirect("/admin");
  const { alerts, errors } = await loadReconciliationAlerts();

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader
        title="Reconciliation"
        description="Read-only alerts from the last 7 days. Opening an alert does not refund, pay, or change a balance. A failed check is shown as an error, not as zero."
      />
      {errors.length ? (
        <div className="mb-4 rounded-xl border border-amber-300/40 bg-amber-300/10 p-3 text-sm text-amber-100">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      ) : null}
      {alerts.length === 0 ? (
        <AdminEmptyState title="No alerts in the checked rows" body="This is the last 7 days, with a row limit on each check. An empty list is not a full audit of older records." />
      ) : (
        <AdminSectionCard title="Needs investigation" description="High means the stored rows disagree. Review means a person should look before any money action.">
          <ul className="space-y-3">
            {alerts.map((alert) => (
              <li key={alert.id} className="rounded-xl border border-white/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{alert.severity}</p>
                <p className="text-sm font-semibold text-white">{alert.title}</p>
                <p className="mt-1 text-sm text-[#9fb0d0]">{alert.detail}</p>
                <Link className="mt-2 inline-flex min-h-10 items-center text-sm font-semibold text-cyan-200 underline" href={alert.href}>
                  Investigate
                </Link>
              </li>
            ))}
          </ul>
        </AdminSectionCard>
      )}
    </div>
  );
}
