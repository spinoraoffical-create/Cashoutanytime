import Link from "next/link";
import { redirect } from "next/navigation";

import { adminDb } from "@/lib/actions/admin/core";
import { adminListScope, idsOrNone } from "@/lib/admin/list-scope";
import { readAgentScope } from "@/lib/agents/scope";
import { can, getStaffContext } from "@/lib/data/admin";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DepositActions } from "@/components/admin/deposit-actions";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { DepositsLiveRefresh } from "@/components/deposits/deposits-live-refresh";
import { DepositProofImage } from "@/components/deposits/deposit-proof-image";
import { getDepositMethod } from "@/lib/payments/methods";
import { cn, formatDate } from "@/lib/utils";
import type { RequestStatus } from "@/types/database";

const STATUS_HELP: Record<string, string> = {
  all: "The latest 100 records, in every stored status. Pending and completed stay in separate filters.",
  pending: "Still marked pending. This filter does not include completed records.",
  processing: "Marked in progress. This is not a completed deposit.",
  completed: "Marked completed. This is a count of records, not revenue.",
  rejected: "Turned down. Reject does not send a payment.",
};

async function attachStoreNames<T extends { user_id?: string; storeName?: string | null }>(deposits: T[]) {
  const userIds = [...new Set(deposits.map((row) => row.user_id).filter((id): id is string => Boolean(id)))];
  if (!userIds.length) return deposits;
  const db = adminDb();
  const { data: players } = await db.from("profiles").select("id, parent_agent_id").in("id", userIds);
  const parentByUser = new Map(
    ((players ?? []) as { id: string; parent_agent_id: string | null }[]).map((row) => [row.id, row.parent_agent_id])
  );
  const parentIds = [...new Set([...parentByUser.values()].filter((id): id is string => Boolean(id)))];
  const { data: parents } = parentIds.length
    ? await db.from("profiles").select("id, full_name").in("id", parentIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const names = new Map(
    ((parents ?? []) as { id: string; full_name: string | null }[]).map((row) => [row.id, row.full_name])
  );
  return deposits.map((row) => {
    const parentId = row.user_id ? parentByUser.get(row.user_id) : null;
    return { ...row, storeName: parentId ? names.get(parentId) ?? null : null };
  });
}

const FILTER_TABS: { id: string; label: string; href: string }[] = [
  { id: "pending", label: "Pending", href: "/admin/deposits?status=pending" },
  { id: "processing", label: "Processing", href: "/admin/deposits?status=processing" },
  { id: "all", label: "All", href: "/admin/deposits" },
  { id: "completed", label: "Completed", href: "/admin/deposits?status=completed" },
  { id: "rejected", label: "Rejected", href: "/admin/deposits?status=rejected" },
];

export default async function AdminDepositsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeFilter = status ?? "all";
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

  type DepositCard = {
    id: string;
    user_id?: string;
    game_name: string;
    payment_method: Parameters<typeof getDepositMethod>[0];
    status: RequestStatus;
    amount: number | null;
    proof_url: string;
    admin_notes: string | null;
    created_at: string;
    storeName?: string | null;
    user: { full_name?: string; email?: string } | null;
  };
  let deposits: DepositCard[] = [];
  if (decision.mode === "network") {
    const db = adminDb();
    const { data: owned } = decision.parentIds.length
      ? await db.from("profiles").select("id").in("parent_agent_id", decision.parentIds).limit(1000)
      : { data: [] as { id: string }[] };
    const ids = idsOrNone(((owned ?? []) as { id: string }[]).map((row) => row.id));
    let query = db
      .from("deposit_requests")
      .select("*, user:profiles!deposit_requests_user_id_fkey(full_name, email)")
      .in("user_id", ids)
      .order("created_at", { ascending: false })
      .limit(100);
    if (status && status !== "all") query = query.eq("status", status);
    const result = await query;
    deposits = (result.data ?? []) as typeof deposits;
  } else {
    const db = adminDb();
    let query = db
      .from("deposit_requests")
      .select("*, user:profiles!deposit_requests_user_id_fkey(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (status && status !== "all") query = query.eq("status", status);
    const result = await query;
    deposits = (result.data ?? []) as typeof deposits;
  }
  deposits = await attachStoreNames(deposits);

  return (
    <div className="mx-auto max-w-7xl">
      <DepositsLiveRefresh />
      <AdminPageHeader
        title="Deposits"
        description="Paydora credits the wallet when payment is confirmed. This list is the deposit record. Each filter shows one status."
      />

      <div className="mb-3 flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full border px-4 py-1.5 text-sm font-semibold",
              activeFilter === tab.id
                ? "border-transparent bg-gradient-to-r from-[#6d28d9] to-[#2563eb] text-white"
                : "border-white/10 text-[#9fb0d0] hover:text-white"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <p className="mb-6 text-sm text-[#9fb0d0]">{STATUS_HELP[activeFilter] ?? STATUS_HELP.all}</p>

      <div className="space-y-4">
        {!deposits?.length ? (
          <AdminEmptyState
            title="No deposit records"
            body={status && status !== "all" ? `Nothing is marked ${status} in the latest records.` : "New deposit records will show here."}
          />
        ) : (
          deposits.map((dep) => {
            const user = dep.user as { full_name?: string; email?: string };
            const method = getDepositMethod(dep.payment_method);
            return (
              <AdminSectionCard
                key={dep.id}
                title={dep.game_name}
                description={`${user?.full_name ?? "Player"}${user?.email ? ` (${user.email})` : ""}${dep.storeName ? ` · ${dep.storeName}` : ""}`}
                action={<AdminStatusBadge status={dep.status} />}
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-[#9fb0d0]">
                      <span>{method?.label ?? dep.payment_method}</span>
                      {dep.amount != null && dep.amount > 0 ? (
                        <span className="font-semibold text-white">${Number(dep.amount).toFixed(2)}</span>
                      ) : null}
                    </div>
                    <DepositProofImage path={dep.proof_url ?? ""} />
                    {dep.admin_notes ? <p className="text-sm text-cyan-100">Note: {dep.admin_notes}</p> : null}
                    <p className="text-xs text-[#8ea0c3]">{formatDate(dep.created_at)}</p>
                  </div>
                  <DepositActions
                    depositId={dep.id}
                    currentStatus={dep.status as RequestStatus}
                    amount={dep.amount != null ? Number(dep.amount) : null}
                  />
                </div>
              </AdminSectionCard>
            );
          })
        )}
      </div>
    </div>
  );
}
