import { GAMES, type Game, dedupeGamesForDisplay, canonicalGameSlug, getGameBySlug } from "@/lib/games";
import type { MarketingGame } from "@/lib/data/marketing";

/** Map CMS / marketing catalog rows to home GameCard shape. */
export function marketingGamesToCards(catalog: MarketingGame[]): Game[] {
  if (!catalog.length) return dedupeGamesForDisplay(GAMES);

  const mapped = catalog.map((g) => {
    const local = GAMES.find((x) => canonicalGameSlug(x.slug) === canonicalGameSlug(g.slug));
    const slug = local?.slug ?? g.slug;
    return {
      id: local?.id ?? g.id,
      name: local?.name ?? g.name,
      slug,
      image: g.image_url ?? local?.image ?? "/games/game-vault.webp",
      provider: local?.provider ?? g.name,
      category: local?.category ?? "Arcade",
      downloadUrl: g.download_url ?? local?.downloadUrl ?? "#",
      bio: g.description ?? local?.bio ?? "",
      players: local?.players ?? (g.popularity ?? 50) * 100,
      gradient: local?.gradient ?? "from-zinc-600 to-zinc-900",
      popular: g.is_featured ?? local?.popular,
      trending: (g.popularity ?? 0) > 90 || local?.trending,
      promotional: local?.promotional,
      upcoming: local?.upcoming,
    };
  });

  return dedupeGamesForDisplay(mapped);
}

/** Static catalog + DB-only games — one card per title, static metadata wins. */
export function buildLobbyCatalog(dbCatalog: MarketingGame[] = []): Game[] {
  const bySlug = new Map<string, Game>();

  for (const game of GAMES) {
    bySlug.set(canonicalGameSlug(game.slug), game);
  }

  for (const game of marketingGamesToCards(dbCatalog)) {
    const key = canonicalGameSlug(game.slug);
    if (!bySlug.has(key)) bySlug.set(key, game);
  }

  return dedupeGamesForDisplay([...bySlug.values()]);
}

/** Prefer canonical static display name for grid labels. */
export function gameDisplayName(game: Game): string {
  return getGameBySlug(game.slug)?.name ?? game.name;
}