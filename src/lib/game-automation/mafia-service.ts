import { createAdminClient } from "@/lib/supabase/admin";
import { formatGameAutomationError } from "./error-formatter";
import { MafiaApiClient, isMafiaApiConfigured } from "./mafia-api";

export interface MafiaDirectApiResult {
  success: boolean;
  message?: string;
  userBalanceAfter?: number;
  agentBalanceAfter?: number;
  transactionId?: string;
  gameId?: number;
  password?: string;
}

export { isMafiaApiConfigured };

export async function processMafiaLoadDirectApi(
  accountName: string,
  amount: number
): Promise<MafiaDirectApiResult> {
  if (!isMafiaApiConfigured()) {
    return {
      success: false,
      message: "Mafia API credentials are not configured on server",
    };
  }

  try {
    const client = new MafiaApiClient();
    const result = await client.rechargePlayer(accountName, amount);
    return {
      success: true,
      message: `Successfully loaded $${amount} on Mafia account ${accountName}`,
      userBalanceAfter: result.balance,
      gameId: result.game_id,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Mafia load failed via direct API",
    };
  }
}

export async function processMafiaAccountCreationDirectApi(
  accountName: string,
  desiredPassword?: string
): Promise<MafiaDirectApiResult> {
  if (!isMafiaApiConfigured()) {
    return {
      success: false,
      message: "Mafia API credentials are not configured on server",
    };
  }

  try {
    const client = new MafiaApiClient();
    const pass = desiredPassword || "123123";
    const result = await client.createAccount(accountName, pass);
    return {
      success: true,
      message: `Successfully created Mafia account ${result.account}`,
      password: result.pass,
      gameId: result.id,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Mafia account creation failed via direct API",
    };
  }
}

export async function getMafiaBalanceDirectApi(accountName: string): Promise<{ success: boolean; balance?: number; message?: string }> {
  try {
    const client = new MafiaApiClient();
    const player = await client.findPlayerByAccount(accountName);
    if (!player) {
      return { success: false, message: `Player ${accountName} not found` };
    }
    return { success: true, balance: player.score || 0 };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Direct Instant Auto-Fulfillment for Mafia Requests in Next.js Server Actions.
 */
export async function autoFulfillMafiaRequest(
  requestId: string,
  loadType: "create_account" | "new_account" | "check_balance" | "load" | "reload" | "redeem",
  input: {
    userId: string;
    gameUsername?: string | null;
    amount?: number | null;
    requestedUsername?: string | null;
    requestedPassword?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!isMafiaApiConfigured()) {
    return { success: false, error: "Mafia API credentials not configured." };
  }

  const admin = createAdminClient();
  if (!admin) return { success: false, error: "Database admin client unavailable." };

  try {
    const client = new MafiaApiClient();

    // 1. Create account / New account
    if (loadType === "create_account" || loadType === "new_account") {
      const username = input.requestedUsername || `Mafia_${Math.floor(100000 + Math.random() * 900000)}`;
      const password = input.requestedPassword || "123123";

      const created = await client.createAccount(username, password);

      await admin
        .from("game_load_requests")
        .update({
          status: "completed",
          game_username: created.account,
          game_password: created.pass,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      return { success: true };
    }

    // 2. Check balance
    if (loadType === "check_balance") {
      const username = input.gameUsername?.trim();
      if (!username) throw new Error("Game username missing");

      const player = await client.findPlayerByAccount(username);
      const balance = player ? player.score || 0 : 0;

      await admin
        .from("game_load_requests")
        .update({
          status: "completed",
          amount: balance,
          admin_notes: `Balance: $${balance.toFixed(2)}`,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      return { success: true };
    }

    // 3. Load / Reload
    if (loadType === "load" || loadType === "reload") {
      const username = input.gameUsername?.trim();
      const amount = input.amount || 0;
      if (!username) throw new Error("Game username missing");

      await client.rechargePlayer(username, amount);

      await admin
        .from("game_load_requests")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      return { success: true };
    }

    // 4. Redeem (Withdraw)
    if (loadType === "redeem") {
      const username = input.gameUsername?.trim();
      const amount = input.amount || 0;
      if (!username) throw new Error("Game username missing");

      await client.withdrawPlayer(username, amount);

      await admin
        .from("game_load_requests")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      return { success: true };
    }

    return { success: false, error: `Unknown load type: ${loadType}` };
  } catch (err: any) {
    const userError = formatGameAutomationError(err, input.amount);

    if (loadType === "load" || loadType === "reload") {
      try {
        await admin.rpc("refund_game_load_wallet", { p_request_id: requestId });
      } catch {}
    }

    await admin
      .from("game_load_requests")
      .update({
        status: "failed",
        error_message: userError,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    return { success: false, error: userError };
  }
}
