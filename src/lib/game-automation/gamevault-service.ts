import { createAdminClient } from "@/lib/supabase/admin";
import { formatGameAutomationError } from "./error-formatter";
import {
  getGameVaultApiClient,
  GameVaultApiClient,
} from "./gamevault-api";

export function isGameVaultApiConfigured(): boolean {
  const agentId = process.env.GAMEVAULT_AGENT_ID || "";
  const secretKey = process.env.GAMEVAULT_SECRET_KEY || "";
  return Boolean(agentId?.trim() && secretKey?.trim());
}

export async function createGameVaultAccount(
  params: { username: string; password?: string },
  client?: GameVaultApiClient
) {
  const api = client || getGameVaultApiClient();
  // Ensure username is strictly alphanumeric (Game Vault requirement)
  const cleanUsername = params.username.replace(/[^a-zA-Z0-9]/g, "");
  if (cleanUsername.length < 4) {
    throw new Error("Account not found");
  }
  const finalUsername = cleanUsername;

  const password = params.password || "123123";
  const res = await api.addUser(finalUsername, password);
  return {
    success: true,
    account: res.data.account_name,
    password,
    userId: res.data.user_id,
  };
}

export async function rechargeGameVaultAccount(
  params: { usernameOrId: string | number; amount: number | string; orderId?: string },
  client?: GameVaultApiClient
) {
  const api = client || getGameVaultApiClient();
  const res = await api.recharge(params.usernameOrId, params.amount, params.orderId);
  return { success: true, balance: parseFloat(res.data.user_balance) || 0 };
}

export async function withdrawGameVaultAccount(
  params: { usernameOrId: string | number; amount: number | string; orderId?: string },
  client?: GameVaultApiClient
) {
  const api = client || getGameVaultApiClient();
  const res = await api.withdraw(params.usernameOrId, params.amount, params.orderId);
  return { success: true, balance: parseFloat(res.data.user_balance) || 0 };
}

export async function getGameVaultAccountBalance(
  usernameOrId: string | number,
  client?: GameVaultApiClient
) {
  const api = client || getGameVaultApiClient();
  const res = await api.getUserBalance(usernameOrId);
  return { success: true, balance: parseFloat(res.data.user_balance) || 0 };
}

/**
 * Resolve numeric Game Vault user_id from DB, or look up by account name via API.
 */
async function resolveGameVaultUserId(
  admin: any,
  inputUsername: string,
  userId?: string
): Promise<string> {
  const clean = inputUsername.trim();
  if (/^\d{5,}$/.test(clean)) return clean;

  if (admin && userId) {
    const { data: userAccounts } = await admin
      .from("user_game_accounts")
      .select("game_username, admin_notes")
      .eq("user_id", userId)
      .eq("game_slug", "game-vault")
      .maybeSingle();

    if (userAccounts?.admin_notes && /^\d{5,}$/.test(userAccounts.admin_notes.trim())) {
      return userAccounts.admin_notes.trim();
    }
    if (userAccounts?.game_username && /^\d{5,}$/.test(userAccounts.game_username.trim())) {
      return userAccounts.game_username.trim();
    }

    const { data: pastReqs } = await admin
      .from("game_load_requests")
      .select("admin_notes, game_username")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(5);

    if (pastReqs) {
      for (const r of pastReqs) {
        if (r.admin_notes && /^\d{5,}$/.test(r.admin_notes.trim())) {
          return r.admin_notes.trim();
        }
        if (r.game_username && /^\d{5,}$/.test(r.game_username.trim())) {
          return r.game_username.trim();
        }
      }
    }
  }

  // Account name → numeric user_id (required by recharge/withdraw/balance APIs)
  const api = getGameVaultApiClient();
  try {
    return await api.getUserID(clean);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not resolve Game Vault user_id for "${clean}". Recharge/redeem need the numeric ID. (${msg})`
    );
  }
}

export async function autoFulfillGameVaultRequest(
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
  if (!isGameVaultApiConfigured()) {
    return { success: false, error: "Game Vault API credentials not configured." };
  }

  const admin = createAdminClient();
  if (!admin) return { success: false, error: "Database admin client unavailable." };

  try {
    if (loadType === "create_account" || loadType === "new_account") {
      const rawUser = input.requestedUsername?.trim() || "";
      const cleanUser = rawUser.replace(/[^a-zA-Z0-9]/g, "");
      if (cleanUser.length < 4) return { success: false, error: "Account not found" };
      const username = cleanUser;
      const password = input.requestedPassword || `Pass${Math.floor(1000 + Math.random() * 9000)}`;
      const created = await createGameVaultAccount({ username, password });

      await admin
        .from("game_load_requests")
        .update({
          status: "completed",
          game_username: created.account,
          game_password: created.password,
          admin_notes: created.userId,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      try {
        await admin.from("user_game_accounts").upsert({
          user_id: input.userId,
          game_slug: "game-vault",
          game_username: created.account,
          admin_notes: created.userId,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {}

      return { success: true };
    }

    if (loadType === "check_balance") {
      const inputUsername = input.gameUsername?.trim();
      if (!inputUsername) throw new Error("Game username missing");

      const targetId = await resolveGameVaultUserId(admin, inputUsername, input.userId);
      const scoreInfo = await getGameVaultAccountBalance(targetId);

      await admin
        .from("game_load_requests")
        .update({
          status: "completed",
          amount: scoreInfo.balance,
          admin_notes: `Balance: $${scoreInfo.balance.toFixed(2)}`,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      return { success: true };
    }

    if (loadType === "load" || loadType === "reload") {
      const inputUsername = input.gameUsername?.trim();
      const amount = input.amount || 0;
      if (!inputUsername) throw new Error("Game username missing");

      const targetId = await resolveGameVaultUserId(admin, inputUsername, input.userId);
      const orderId = `job_${requestId.replace(/[^a-zA-Z0-9]/g, "")}`.slice(0, 32);
      await rechargeGameVaultAccount({ usernameOrId: targetId, amount, orderId });

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

    if (loadType === "redeem") {
      const inputUsername = input.gameUsername?.trim();
      const amount = input.amount || 0;
      if (!inputUsername) throw new Error("Game username missing");

      const targetId = await resolveGameVaultUserId(admin, inputUsername, input.userId);
      const orderId = `job_${requestId.replace(/[^a-zA-Z0-9]/g, "")}`.slice(0, 32);
      await withdrawGameVaultAccount({ usernameOrId: targetId, amount, orderId });

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
