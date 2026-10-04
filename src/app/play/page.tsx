import type { Metadata } from "next";
import { PlayCatalog } from "@/components/player/play-catalog";
import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { getGameRooms } from "@/lib/games";
import { getGames } from "@/lib/data/marketing";
import { buildLobbyCatalog } from "@/lib/games-marketing";

export const metadata: Metadata = {
  title: "Play | Sweepstakes Hub",
  description: "Browse Game Rooms. Load credits and redeem winnings from one account.",
  alternates: { canonical: "/play" },
};

export default async function PlayPage() {
  const dbGames = await getGames();
  const catalog = buildLobbyCatalog(dbGames);
  const games = catalog.length ? catalog : getGameRooms();

  return (
    <VipPageLayout>
      <main>
        <PlayCatalog games={games} />
      </main>
    </VipPageLayout>
  );
}
