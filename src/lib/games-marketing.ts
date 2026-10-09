import { GAMES, type Game, dedupeGamesForDisplay, canonicalGameSlug, getGameBySlug } from "@/lib/games";
import type { MarketingGame } from "@/lib/data/marketing";

/** Map CMS / marketing catalog rows to home GameCard shape. */
export function marketingGamesToCards(catalog: MarketingGame[]): Game[] {
  if (!catalog.length) return [];

  const mapped = catalog.flatMap((g) => {
    const local = GAMES.find((x) => canonicalGameSlug(x.slug) === canonicalGameSlug(g.slug));
    if (!local) {
      return [{
        id: g.id,
        name: g.name,
        slug: g.slug,
        image: g.image_url || "/logo.webp",
        provider: g.name,
        category: "Arcade",
        downloadUrl: g.download_url || "#",
        bio: g.description || "",
        players: (g.popularity ?? 50) * 100,
        gradient: "from-zinc-600 to-zinc-900",
        popular: Boolean(g.is_featured),
      }];
    }
    const slug = local.slug;
    return [{
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
    }];
  });

  return dedupeGamesForDisplay(mapped);
}

/** Home and /play cards. A game appears only when its games.is_active row is true. */
export function buildLobbyCatalog(dbCatalog: MarketingGame[] = []): Game[] {
  if (!dbCatalog.length) return [];
  return marketingGamesToCards(dbCatalog);
}

/** Prefer canonical static display name for grid labels. */
export function gameDisplayName(game: Game): string {
  return getGameBySlug(game.slug)?.name ?? game.name;
}