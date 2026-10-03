import type { Metadata } from "next";
import Link from "next/link";

import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { MarketingGameGrid } from "@/components/marketing/game-grid";
import { getGames } from "@/lib/data/marketing";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "All Games | Spinora",
  description:
    "Browse sweepstakes fish table and slot games at Spinora. Create an account, deposit, and play with 24/7 support.",
  alternates: { canonical: "/games" },
};

export default async function GamesCatalogPage() {
  const catalog = await getGames();

  return (
    <VipPageLayout>
      <main className="pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Games" }]} />

          <div className="mb-8 max-w-3xl">
            <h1 className="text-4xl font-bold mb-4">
              Browse All <span className="gradient-text">Games</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Create a free Spinora account, pick a game, and load credits from your wallet. Instant setup with 24/7 support.
            </p>
          </div>
        </div>

        <MarketingGameGrid
          title="All games"
          lede={`${catalog.length || "12"}+ titles — fish tables, slots and arcade games.`}
          catalog={catalog}
        />
      </main>
    </VipPageLayout>
  );
}
