import { getGameBySlug } from "@/lib/games";

/** Server-only Juwa agent panel URL (never NEXT_PUBLIC) */
export function getJuwaAdminPanelUrl(): string | null {
  return process.env.JUWA_ADMIN_URL?.trim() || null;
}

/**
 * Vegas Sweeps agent panel URL. Defaults to the public login page so the
 * feature is enabled without extra config; override with VEGAS_ADMIN_URL.
 * (The login page URL is not secret — agent credentials live only in the worker.)
 */
export function getVegasAdminPanelUrl(): string | null {
  return process.env.VEGAS_ADMIN_URL?.trim() || "https://agent.lasvegassweeps.com/login";
}

/**
 * Game Vault agent panel URL. Defaults to the public login page so the feature
 * is enabled without extra config; override with GAMEVAULT_ADMIN_URL.
 */
export function getGameVaultAdminPanelUrl(): string | null {
  return process.env.GAMEVAULT_ADMIN_URL?.trim() || "https://agent.gamevault999.com/login";
}

/**
 * Cash Frenzy agent panel URL. Same Element Plus "Backend" UI as Game Vault
 * (User List / New Account / editor → Recharge / Redeem), hosted under /admin.
 */
export function getCashFrenzyAdminPanelUrl(): string | null {
  return process.env.CASHFRENZY_ADMIN_URL?.trim() || "https://agentserver.cashfrenzy777.com/admin/login";
}

/** Layui MDI panels (same software family as Gameroom). */
export function getGameroomAdminPanelUrl(): string | null {
  return process.env.GAMEROOM_ADMIN_URL?.trim() || "https://agentserver1.gameroom777.com/admin/login";
}

export function getCashMachineAdminPanelUrl(): string | null {
  return process.env.CASHMACHINE_ADMIN_URL?.trim() || "https://agentserver.cashmachine777.com/admin/login";
}

export function getMrAllInOneAdminPanelUrl(): string | null {
  return process.env.MRALLINONE_ADMIN_URL?.trim() || "https://agentserver.mrallinone777.com/admin/login";
}

export function getMafiaAdminPanelUrl(): string | null {
  return process.env.MAFIA_ADMIN_URL?.trim() || "https://agentserver.mafia77777.com/admin/login";
}

export function getAutomationSecret(): string | null {
  return process.env.GAME_AUTOMATION_SECRET?.trim() || null;
}

/**
 * Wallet create / load / redeem UI + API — enabled for every game in the catalog
 * except upcoming (coming soon) titles. Individual bot workers claim jobs by slug;
 * games without a worker yet can still queue requests until a bot is added.
 */
export function isWalletLoadEnabledForGame(slug: string): boolean {
  const game = getGameBySlug(slug);
  return Boolean(game && !game.upcoming);
}

/** Wallet → game load limits ($5 minimum load / partial redeem, up to $500) */
export const WALLET_LOAD_LIMITS = { min: 5, max: 500 } as const;
