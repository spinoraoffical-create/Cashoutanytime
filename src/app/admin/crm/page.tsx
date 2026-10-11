import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DollarSign, TrendingUp, UserCheck, Users } from "lucide-react";

import { CrmPlayersPanel } from "@/components/admin/crm-players-panel";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { adminListScope } from "@/lib/admin/list-scope";
import { readAgentScope } from "@/lib/agents/scope";
import { can, getStaffContext } from "@/lib/data/admin";
import {
  getCrmOverviewForParents,
  getCrmOverviewStats,
  getCrmPlayersPage,
  type CrmSegment,
} from "@/lib/data/admin-crm";

export const metadata: Metadata = { title: "CRM" };

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
        title="CRM"
        description="Customer intelligence — player activity, deposit history and contact details."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total players"
          value={stats.totalPlayers.toLocaleString()}
          icon={<Users />}
          accent="cyan"
        />
        <StatCard
          label="New this week"
          value={stats.newThisWeek.toLocaleString()}
          icon={<TrendingUp />}
          accent="emerald"
        />
        <StatCard
          label="Active last 7 days"
          value={stats.activeLast7d.toLocaleString()}
          icon={<UserCheck />}
          accent="purple"
        />
        <StatCard
          label="Total fulfilled ($)"
          value={`$${stats.totalFulfilled.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={<DollarSign />}
          accent="gold"
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
