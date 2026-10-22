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
      firstDepositBonusPercent: g.first_deposit_bonus_percent ?? null,
      reloadBonusPercent: g.reload_bonus_percent ?? null,
      bonusText: g.bonus_text ?? null,
      bonusEnabled: g.bonus_enabled ?? null,
      bonusMinDeposit: g.bonus_min_deposit ?? null,
      bonusMaxAmount: g.bonus_max_amount ?? null,
      bonusStartsAt: g.bonus_starts_at ?? null,
      bonusEndsAt: g.bonus_ends_at ?? null,
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
      firstDepositBonusPercent: g.first_deposit_bonus_percent ?? null,
      reloadBonusPercent: g.reload_bonus_percent ?? null,
      bonusText: g.bonus_text ?? null,
      bonusEnabled: g.bonus_enabled ?? null,
      bonusMinDeposit: g.bonus_min_deposit ?? null,
      bonusMaxAmount: g.bonus_max_amount ?? null,
      bonusStartsAt: g.bonus_starts_at ?? null,
      bonusEndsAt: g.bonus_ends_at ?? null,
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

/** Same public list the play catalog shows. Upcoming cards stay out. Active rows are kept. */
export function publicPlayCatalog(dbCatalog: MarketingGame[] = []): Game[] {
  return buildLobbyCatalog(dbCatalog).filter((game) => !game.upcoming);
}

/** Applies the database active flag, then the public catalog rule. */
export function publicCatalogFromRows(rows: Array<MarketingGame & { is_active?: boolean }> = []): Game[] {
  return publicPlayCatalog(rows.filter((row) => row.is_active !== false));
}

/** Database ids that survive the same active and upcoming rules as the public catalog. */
export function publicCatalogSourceIds(rows: Array<MarketingGame & { is_active?: boolean }> = []): string[] {
  const visible = new Set(publicCatalogFromRows(rows).map((game) => canonicalGameSlug(game.slug)));
  return rows
    .filter((row) => row.is_active !== false && visible.has(canonicalGameSlug(row.slug)))
    .map((row) => row.id);
}

export function gameDetailPath(slug: string): string {
  return `/games/${slug}`;
}

/** Search and category chips used by the play catalog. */
export function filterPlayCatalog(
  games: Game[],
  options: { query?: string; category?: string; chip?: string; favorites?: string[] } = {}
): Game[] {
  let rows = games.filter((game) => !game.upcoming);
  const chip = options.chip ?? "all";
  const favorites = options.favorites ?? [];
  if (chip === "popular") rows = rows.filter((game) => game.popular);
  if (chip === "favorites" || chip === "yours") rows = rows.filter((game) => favorites.includes(game.slug));
  const category = options.category ?? "all";
  if (category !== "all") rows = rows.filter((game) => game.category === category);
  const query = options.query?.trim().toLowerCase() ?? "";
  if (query) {
    rows = rows.filter(
      (game) =>
        game.name.toLowerCase().includes(query) ||
        game.provider.toLowerCase().includes(query) ||
        game.category.toLowerCase().includes(query)
    );
  }
  return rows;
}

/** Prefer canonical static display name for grid labels. */
export function gameDisplayName(game: Game): string {
  return getGameBySlug(game.slug)?.name ?? game.name;
}