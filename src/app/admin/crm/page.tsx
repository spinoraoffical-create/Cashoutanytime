import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CrmPlayersPanel } from "@/components/admin/crm-players-panel";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminStatCard } from "@/components/admin/ui/admin-stat-card";
import { adminListScope } from "@/lib/admin/list-scope";
import { readAgentScope } from "@/lib/agents/scope";
import { can, getStaffContext } from "@/lib/data/admin";
import {
  getCrmOverviewForParents,
  getCrmOverviewStats,
  getCrmPlayersPage,
  type CrmSegment,
} from "@/lib/data/admin-crm";

export const metadata: Metadata = { title: "Player follow-up" };

const SEGMENTS = [
  { key: "all", label: "All Players" },
  { key: "new", label: "New (7d)" },
  { key: "active", label: "Active (7d)" },
  { key: "vip", label: "VIP" },
  { key: "banned", label: "Banned" },
] as const;

export default async function AdminCrmPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; page?: string }>;
}) {
  const ctx = await getStaffContext();
  const scopeResult = await readAgentScope();
  const decision = adminListScope({
    isSuperAdmin: Boolean(ctx?.isSuperAdmin),
    hasStaffPermission: Boolean(ctx && can(ctx, "users.manage")),
    scopeStatus: scopeResult.status,
    scope: scopeResult.scope
      ? { level: scopeResult.scope.level, parentIds: scopeResult.scope.parentIds }
      : null,
  });
  if (decision.mode === "deny") redirect("/admin");
  const params = await searchParams;
  const segment = (SEGMENTS.find((s) => s.key === params.segment)?.key ?? "all") as CrmSegment;
  const page = Math.max(1, Number(params.page) || 1);

  const [stats, playersPage] = decision.mode === "network"
    ? await Promise.all([
        getCrmOverviewForParents(decision.parentIds),
        getCrmPlayersPage(segment, page, decision.parentIds),
      ])
    : await Promise.all([
        getCrmOverviewStats(),
        getCrmPlayersPage(segment, page),
      ]);

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        title="Player follow-up"
        description="Filter players by recent activity. The totals are counts and the stored fulfilled deposit amount. This page does not move money."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Total players" value={stats.totalPlayers.toLocaleString()} hint="Players in this view." />
        <AdminStatCard label="New this week" value={stats.newThisWeek.toLocaleString()} hint="Accounts created in the last 7 days." />
        <AdminStatCard label="Active last 7 days" value={stats.activeLast7d.toLocaleString()} hint="Players seen in the last 7 days." />
        <AdminStatCard
          label="Fulfilled deposits"
          value={`$${stats.totalFulfilled.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          hint="Stored fulfilled deposit total. This is not profit."
        />
      </div>

      <CrmPlayersPanel
        initialSegment={segment}
        initialPage={page}
        initialData={playersPage}
      />
    </div>
  );
}
