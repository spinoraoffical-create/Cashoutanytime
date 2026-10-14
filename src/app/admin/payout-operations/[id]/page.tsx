import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminErrorState } from "@/components/admin/ui/admin-error-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { adminDb } from "@/lib/actions/admin/core";
import { adminListScope } from "@/lib/admin/list-scope";
import { loadPayoutOperation, payoutStatusHelp } from "@/lib/admin/payout-operations";
import { readAgentScope } from "@/lib/agents/scope";
import { can, getStaffContext } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Payout record" };

async function allowedParentIds() {
  const ctx = await getStaffContext();
  const scopeResult = await readAgentScope();
  const decision = adminListScope({
    isSuperAdmin: Boolean(ctx?.isSuperAdmin),
    hasStaffPermission: Boolean(ctx && can(ctx, "requests.manage")),
    scopeStatus: scopeResult.status,
    scope: scopeResult.scope
      ? { level: scopeResult.scope.level, parentIds: scopeResult.scope.parentIds }
      : null,
  });
  if (decision.mode === "deny") redirect("/admin");
  if (decision.mode === "all") return null;
  return decision.parentIds;
}

export default async function PayoutOperationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const parentIds = await allowedParentIds();
  const { id } = await params;
  const loaded = await loadPayoutOperation(id, null);
  if (loaded.error) {
    return (
      <div className="mx-auto max-w-3xl">
        <AdminErrorState title="Payout record unavailable" body={loaded.error} />
      </div>
    );
  }
  if (!loaded.row) notFound();

  if (parentIds) {
    const db = adminDb();
    const { data } = await db.from("profiles").select("parent_agent_id").eq("id", loaded.row.userId).maybeSingle();
    const parentId = (data as { parent_agent_id?: string | null } | null)?.parent_agent_id ?? "";
    if (!parentIds.includes(parentId)) notFound();
  }

  const row = loaded.row;
  const fields = [
    ["Record id", row.id],
    ["Player", row.playerEmail ? `${row.playerName} (${row.playerEmail})` : row.playerName],
    ["Amount", `$${row.amount.toFixed(2)}`],
    ["Method", row.method || "Unavailable"],
    ["Created", row.createdAt ? new Date(row.createdAt).toLocaleString() : "Unavailable"],
    ["Last update", row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "Unavailable"],
    ["Provider reference", row.providerReference || "Not on file"],
    ["Provider withdrawal id", row.providerWithdrawalId || "Not on file"],
    ["Provider status", row.providerStatus || "Not on file"],
    ["Note", row.note || "None"],
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/payout-operations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[#9fb0d0] hover:text-white">
        <ArrowLeft className="size-4" aria-hidden />
        Payout activity
      </Link>
      <AdminPageHeader
        title="Payout record"
        description="Read-only. This screen does not send, retry, or refund the payout."
        action={<AdminStatusBadge status={row.status.replaceAll("_", " ")} />}
      />
      <p className="mb-4 text-sm">
        <Link href={`/admin/users/${row.userId}`} className="font-semibold text-cyan-200">
          Open player profile
        </Link>
      </p>
      <AdminSectionCard title={payoutStatusHelp(row.status)} description="Status text describes the stored record. It does not start a payment.">
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
