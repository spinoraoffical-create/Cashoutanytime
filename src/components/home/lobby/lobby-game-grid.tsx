import { CompactGameCard } from "@/components/home/compact-game-card";
import type { Game } from "@/lib/games";
import { dedupeGamesForDisplay } from "@/lib/games";

interface LobbyGameGridProps {
  games: Game[];
}

/** One card per game — responsive grid, no duplicates. */
export function LobbyGameGrid({ games }: LobbyGameGridProps) {
  const unique = dedupeGamesForDisplay(games);

  if (process.env.NODE_ENV === "development") {
    const slugs = games.map((g) => g.slug);
    const dup = slugs.filter((s, i) => slugs.indexOf(s) !== i);
    if (dup.length > 0) {
      console.warn("[LobbyGameGrid] duplicate slugs in input:", [...new Set(dup)]);
    }
  }

  return (
    <div className="lobby-games-grid">
      {unique.map((game, index) => (
        <CompactGameCard
          key={game.slug}
          game={game}
          eager={index < 12}
          variant="lobby"
        />
      ))}
    </div>
  );
}
