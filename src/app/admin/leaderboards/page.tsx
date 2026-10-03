import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { RecomputeButton } from "@/components/admin/recompute-button";
import { LeaderboardTable } from "@/components/shared/leaderboard-table";
import { GlassCard } from "@/components/shared/glass-card";
import { requirePermission } from "@/lib/data/admin";
import {
  getLeaderboard,
  isLeaderboardPeriod,
  LEADERBOARD_PERIODS,
} from "@/lib/data/leaderboard";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Leaderboards" };

export default async function AdminLeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requirePermission("leaderboards.manage");
  const params = await searchParams;
  const period =
    params.period && isLeaderboardPeriod(params.period)
      ? params.period
      : "weekly";

  const board = await getLeaderboard(period, 50);

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader
        title="Leaderboards"
        description="Boards recompute automatically every 15 minutes. Trigger a manual recompute any time."
        action={<RecomputeButton />}
      />

      <div
        role="tablist"
        aria-label="Leaderboard period"
        className="glass mb-4 inline-flex gap-1 rounded-full p-1"
      >
        {LEADERBOARD_PERIODS.map((p) => {
          const active = p.key === period;
          return (
            <Link
              key={p.key}
              href={`/admin/leaderboards?period=${p.key}`}
              role="tab"
              aria-selected={active}
              className={cn(
                "min-h-9 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-500 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      {board.rows.length === 0 ? (
        <GlassCard className="p-8 text-center text-sm text-muted-foreground">
          No entries for this period yet. Members earn rank by gaining XP.
        </GlassCard>
      ) : (
        <LeaderboardTable rows={board.rows} />
      )}
    </div>
  );
}
