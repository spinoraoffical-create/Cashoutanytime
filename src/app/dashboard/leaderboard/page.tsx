import Link from "next/link";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { LeaderboardTable } from "@/components/shared/leaderboard-table";
import { Button } from "@/components/ui/button";
import type { LeaderboardPeriod } from "@/lib/database.types";
import {
  getLeaderboard,
  isLeaderboardPeriod,
  LEADERBOARD_PERIODS,
} from "@/lib/data/leaderboard";
import { getAuthUser } from "@/lib/supabase/session";
import { cn } from "@/lib/utils";

export default async function DashboardLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const rawPeriod = params.period ?? "";
  const period: LeaderboardPeriod = isLeaderboardPeriod(rawPeriod) ? rawPeriod : "weekly";
  const user = await getAuthUser();
  const view = await getLeaderboard(period, 50, user?.id);

  return (
    <div>
      <DashboardPageHeader
        title="Leaderboard"
        description="Top players by XP earned this period."
      />

      <div className="mb-6 inline-flex flex-wrap gap-1 rounded-full border border-white/10 bg-[#161616] p-1">
        {LEADERBOARD_PERIODS.map((p) => (
          <Button
            key={p.key}
            asChild
            size="sm"
            variant="ghost"
            className={cn(
              "rounded-full",
              period === p.key && "bg-orange-500 text-white hover:bg-orange-500"
            )}
          >
            <Link href={`/dashboard/leaderboard?period=${p.key}`}>{p.label}</Link>
          </Button>
        ))}
      </div>

      <LeaderboardTable rows={view.rows} me={view.me} highlightUserId={user?.id} />
    </div>
  );
}
