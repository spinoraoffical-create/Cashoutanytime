import type { Game } from "@/lib/games";
import { SITE_URL } from "@/lib/constants";

const GAME_KEYWORDS: Record<string, string[]> = {
  juwa: [
    "juwa casino",
    "juwa 777",
    "juwa slots",
    "juwa download",
    "juwa game",
    "juwa fish games",
    "juwa casino download",
    "juwa online casino",
  ],
  "game-vault": [
    "game vault casino",
    "game vault 999",
    "game vault slots",
    "game vault download",
    "game vault sweepstakes",
  ],
  "fire-kirin": [
    "fire kirin",
    "fire kirin fish game",
    "fire kirin download",
    "fish shooting game",
  ],
  "panda-master": ["panda master casino", "panda master slots", "panda master download"],
  "orion-stars": ["orion stars casino", "orion stars fish game", "orion stars download"],
  "vegas-sweeps": ["vegas sweeps", "vegas sweeps casino", "sweepstakes slots"],
  "cash-machine": ["cash machine casino", "cash machine slots"],
  "cash-frenzy": ["cash frenzy casino", "cash frenzy slots"],
  vblink: ["vblink casino", "vblink slots", "vblink download"],
  "milky-way": ["milky way casino", "milky way fish game"],
  ultrapanda: ["ultrapanda casino", "ultrapanda slots"],
  gameroom: ["gameroom casino", "gameroom slots"],
  mafia: ["mafia casino", "mafia slots"],
  "mr-all-in-one": ["mr all in one casino", "all in one slots"],
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Casino: ["slot games", "online slots", "mobile casino", "sweepstakes casino", "casino games"],
  "Fish Game": ["fish games", "fish shooting games", "fish table games", "arcade fish games"],
};

const GAME_TITLES: Record<string, string> = {
  juwa: "Juwa Casino — Download App, Slots & Create Account",
};

export function getGameSeoTitle(game: Game): string {
  return GAME_TITLES[game.slug] ?? `${game.name} ${game.category} — Download & Create Account`;
}

export function getGameSeoDescription(game: Game): string {
  return game.bio;
}

export function getGameSeoKeywords(game: Game): string[] {
  const base = [game.name, game.provider, game.category, "download", "game account", "Spinora"];
  const slugSpecific = GAME_KEYWORDS[game.slug] ?? [];
  const category = CATEGORY_KEYWORDS[game.category] ?? [];
  return [...new Set([...base, ...slugSpecific, ...category])];
}

export function getGameSitemapPriority(game: Game): number {
  if (game.trending || game.popular) return 0.95;
  if (game.topRated) return 0.9;
  return 0.85;
}

export function getGamePageUrl(game: Game): string {
  return `${SITE_URL}/games/${game.slug}`;
}
