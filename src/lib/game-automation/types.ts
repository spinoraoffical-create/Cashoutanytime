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

/** Games with agent API automation (no local workers). */
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
