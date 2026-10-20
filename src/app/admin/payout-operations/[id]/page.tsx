import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminErrorState } from "@/components/admin/ui/admin-error-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { loadPayoutOperation, payoutStatusHelp, resolvePayoutReadPlan } from "@/lib/admin/payout-operations";
import { formatNepalTime } from "@/lib/admin/nepal-time";
import { shownText } from "@/lib/admin/payout-operations-guard";

export const metadata: Metadata = { title: "Payout record" };

export default async function PayoutOperationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const plan = await resolvePayoutReadPlan();
  if (plan.action === "deny") redirect("/admin");
  if (plan.action === "error") {
    return (
      <div className="mx-auto max-w-3xl">
        <AdminErrorState title="Payout record unavailable" body={plan.message} />
      </div>
    );
  }
  if (plan.action === "empty") notFound();

  const { id } = await params;
  const loaded = await loadPayoutOperation(id, plan.scope);
  if (loaded.error) {
    return (
      <div className="mx-auto max-w-3xl">
        <AdminErrorState title="Payout record unavailable" body={loaded.error} />
      </div>
    );
  }
  if (!loaded.row) notFound();

  const row = loaded.row;
  const fields = [
    ["Record id", row.id],
    ["Player", row.playerEmail ? `${row.playerName} (${row.playerEmail})` : row.playerName],
    ["Amount", `$${row.amount.toFixed(2)}`],
    ["Method", shownText(row.method, "Not on file")],
    ["Created", row.createdAt ? formatNepalTime(row.createdAt) : "Unavailable"],
    ["Last update", row.updatedAt ? formatNepalTime(row.updatedAt) : "Unavailable"],
    ["Provider reference", "Not shown"],
    ["Provider status", shownText(row.providerStatus, "Not on file")],
    ["Note", shownText(row.note, "None")],
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/payout-operations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[#9fb0d0] hover:text-white">
        <ArrowLeft className="size-4" aria-hidden />
        Payout activity
      </Link>
      <AdminPageHeader
        title="Payout record"
        description="Read-only. This screen does not send, retry, or refund the payout. Submitted does not mean paid. Failed does not mean refunded."
        action={<AdminStatusBadge status={row.status.replaceAll("_", " ")} />}
      />
      <p className="mb-4 text-sm text-[#9fb0d0]">{payoutStatusHelp(row.status)}</p>
      <p className="mb-4 text-sm">
        <Link href={`/admin/users/${row.userId}`} className="font-semibold text-cyan-200">
          Open player profile
        </Link>
      </p>
      <AdminSectionCard title="Stored record" description="Status text describes the stored record. It does not start a payment.">
        <dl className="grid gap-3 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-[#8ea0c3]">{label}</dt>
              <dd className="mt-1 break-all text-sm text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </AdminSectionCard>
    </div>
  );
}
