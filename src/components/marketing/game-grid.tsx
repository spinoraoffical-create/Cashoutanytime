import { GameCard } from "@/components/home/game-card";
import { getGames, type MarketingGame } from "@/lib/data/marketing";
import { marketingGamesToCards } from "@/lib/games-marketing";

export async function MarketingGameGrid({
  title = "Choose your game",
  lede = "Pick any game below — create your account, load credits from your wallet, and play.",
  catalog: catalogProp,
}: {
  title?: string;
  lede?: string;
  catalog?: MarketingGame[];
}) {
  const catalog = catalogProp ?? (await getGames());
  const games = marketingGamesToCards(catalog);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-8 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-orange-400 mb-2">
          {games.length} games available
        </p>
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{lede}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {games.map((game, index) => (
          <GameCard key={game.slug} game={game} eager={index < 8} />
        ))}
      </div>
    </section>
  );
}
