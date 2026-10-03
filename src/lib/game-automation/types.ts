export type GameLoadStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";
export type GameLoadType =
  | "create_account"
  | "load"
  | "redeem"
  | "new_account"
  | "reload"
  | "check_balance";
export type GameLoadWalletType = "current" | "bonus";

export interface GameLoadRequest {
  id: string;
  user_id: string;
  game_slug: string;
  game_name: string;
  amount: number;
  wallet_type: GameLoadWalletType;
  load_type: GameLoadType;
  redeem_all?: boolean;
  game_username: string | null;
  game_password: string | null;
  status: GameLoadStatus;
  error_message: string | null;
  bot_attempts: number;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/** Games with a dedicated bot worker in `workers/*-bot/` */
export const AUTOMATED_GAME_SLUGS = [
  "juwa",
  "vegas-sweeps",
  "game-vault",
  "gameroom",
  "cash-machine",
  "mr-all-in-one",
  "mafia",
  "cash-frenzy",
] as const;
export type AutomatedGameSlug = (typeof AUTOMATED_GAME_SLUGS)[number];

export function isAutomatedGameSlug(slug: string): slug is AutomatedGameSlug {
  return (AUTOMATED_GAME_SLUGS as readonly string[]).includes(slug);
}

/** Folder name under `workers/` for each automated game bot */
export const AUTOMATED_BOT_WORKER_DIR: Record<AutomatedGameSlug, string> = {
  juwa: "juwa-bot",
  "vegas-sweeps": "vegas-bot",
  "game-vault": "gamevault-bot",
  gameroom: "gameroom-bot",
  "cash-machine": "cashmachine-bot",
  "mr-all-in-one": "mr-all-in-one-bot",
  mafia: "mafia-bot",
  "cash-frenzy": "cash-frenzy-bot",
};
