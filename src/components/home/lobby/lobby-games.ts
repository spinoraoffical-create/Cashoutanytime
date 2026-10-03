import { dedupeGamesForDisplay, type Game } from "@/lib/games";
import type { LobbyMenuId } from "@/components/home/lobby/lobby-sidebar";

export function filterLobbyGames(
  menu: LobbyMenuId,
  search: string,
  catalog: Game[]
) {
  let list = dedupeGamesForDisplay(catalog.filter((g) => !g.upcoming));

  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.provider.toLowerCase().includes(q) ||
        g.bio.toLowerCase().includes(q)
    );
  }

  if (menu === "slots") {
    list = list.filter((g) => g.category === "Slots");
  } else if (menu === "fish") {
    list = list.filter((g) => g.category === "Fish Game");
  } else if (menu === "table") {
    list = list.filter((g) => g.category === "Table Games");
  } else if (menu === "live") {
    list = list.filter((g) => g.slug === "juwa" || g.slug === "vegas-sweeps" || g.slug === "game-vault");
  }

  return dedupeGamesForDisplay(list);
}