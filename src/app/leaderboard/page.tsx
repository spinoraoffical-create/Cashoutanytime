import type { Metadata } from "next";
import Link from "next/link";

import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { LeaderboardTable } from "@/components/shared/leaderboard-table";
import { Button } from "@/components/ui/button";
import type { LeaderboardPeriod } from "@/lib/database.types";
import {
  getLeaderboard,
  isLeaderboardPeriod,
  LEADERBOARD_PERIODS,
} from "@/lib/data/leaderboard";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Leaderboard | Spinora",
  description: "Top Spinora players by XP — daily, weekly, monthly and all-time rankings.",
  alternates: { canonical: "/leaderboard" },
};

export default async function PublicLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const rawPeriod = params.period ?? "";
  const period: LeaderboardPeriod = isLeaderboardPeriod(rawPeriod) ? rawPeriod : "weekly";
  const view = await getLeaderboard(period, 50);

  return (
    <VipPageLayout>
      <main className="pb-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Leaderboard" }]} />

          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">
              Player <span className="gradient-text">Leaderboard</span>
            </h1>
            <p className="text-muted-foreground">
              Top players by XP earned.{" "}
              <Link href="/login" className="text-orange-400 hover:underline">
                Sign in
              </Link>{" "}
              to see your rank.
            </p>
          </div>

          <div className="mb-6 inline-flex flex-wrap gap-1 rounded-full border border-white/10 bg-[#161616] p-1">
            {LEADERBOARD_PERIODS.map((p) => (
              <Button
                key={p.key}
                asChild
                size="sm"
                variant="ghost"
                className={cn("rounded-full", period === p.key && "bg-white/10 text-white")}
              >
                <Link href={`/leaderboard?period=${p.key}`}>{p.label}</Link>
              </Button>
            ))}
          </div>

          <LeaderboardTable rows={view.rows} highlightUserId={undefined} />
        </div>
      </main>
    </VipPageLayout>
  );
}
