export interface GameLoadJob {
  id: string;
  user_id: string;
  game_slug: string;
  game_name: string;
  amount: number;
  wallet_type: string;
  load_type: "new_account" | "reload" | "create_account" | "load" | "redeem" | "check_balance";
  game_username: string | null;
  game_password?: string | null;
  redeem_all?: boolean;
  status: string;
  admin_notes?: string | null;
  requester_name?: string | null;
  requester_email?: string | null;
  prior_game_username?: string | null;
}

export interface JuwaBotResult {
  username: string;
  password?: string;
  redeemedAmount?: number;
  balance?: number;
}
