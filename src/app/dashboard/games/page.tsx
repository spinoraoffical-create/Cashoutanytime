import type { Metadata } from "next";
import Link from "next/link";

import { GameAccountsSection } from "@/components/dashboard/game-accounts";
import { MyGamesLiveRefresh } from "@/components/dashboard/my-games-live-refresh";
import {
  getActiveJobsByGame,
  getDashboardGameAccounts,
  getWalletData,
} from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "My Games | Spinora" };

export const dynamic = "force-dynamic";

export default async function DashboardGamesPage() {
  const [accounts, wallet, activeJobs] = await Promise.all([
    getDashboardGameAccounts(),
    getWalletData(),
    getActiveJobsByGame(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <MyGamesLiveRefresh />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">My Games</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Games where you created an account — load credits and cash out here.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-ws-green-deep dark:text-ws-green underline-offset-4 hover:underline"
        >
          Browse lobby for new games →
        </Link>
      </div>

      <GameAccountsSection
        accounts={accounts}
        walletBalance={wallet.balance}
        activeJobs={activeJobs}
      />
    </div>
  );
}
