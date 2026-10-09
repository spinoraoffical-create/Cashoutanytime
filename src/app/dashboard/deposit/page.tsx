import { DepositPageClient } from "@/components/dashboard/deposit-page-client";
import { getGames } from "@/lib/data/marketing";
import { buildLobbyCatalog } from "@/lib/games-marketing";

export default async function DepositPage() {
  const games = buildLobbyCatalog(await getGames()).map((game) => ({
    slug: game.slug,
    name: game.name,
  }));
  return <DepositPageClient games={games} />;
}
