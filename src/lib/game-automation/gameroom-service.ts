import { createAdminClient } from "@/lib/supabase/admin";
import { formatGameAutomationError } from "./error-formatter";
import {
  getGameroomApiClient,
  GameroomApiClient,
} from "./gameroom-api";

export function isGameroomApiConfigured(): boolean {
  const username = process.env.GAMEROOM_AGENT_USERNAME || process.env.GAMEROOM_USERNAME || "";
  const password = process.env.GAMEROOM_AGENT_PASSWORD || process.env.GAMEROOM_PASSWORD || "";
  return Boolean(username?.trim() && password?.trim());
}

export async function createGameroomAccount(
  params: { username: string; password?: string; nickname?: string },
  client?: GameroomApiClient
) {
  const api = client || getGameroomApiClient();
  const password = params.password || "123456";
  const nickname = (params.nickname && params.nickname !== "-") ? params.nickname : params.username;
  const res = await api.addPlayer(params.username, password, nickname, "0");
  return { success: true, account: res.data.account, password: res.data.password };
}

export async function rechargeGameroomAccount(
  params: { usernameOrId: string | number; amount: number | string; remark?: string },
  client?: GameroomApiClient
) {
  const api = client || getGameroomApiClient();
  const res = await api.rechargePlayer(params.usernameOrId, params.amount, params.remark);
  return { success: true, balance: res.data.balance };
}

export async function withdrawGameroomAccount(
  params: { usernameOrId: string | number; amount: number | string; remark?: string },
  client?: GameroomApiClient
) {
  const api = client || getGameroomApiClient();
  const res = await api.withdrawPlayer(params.usernameOrId, params.amount, params.remark);
  return { success: true, balance: res.data.balance };
}

export async function getGameroomAccountBalance(
  usernameOrId: string | number,
  client?: GameroomApiClient
) {
  const api = client || getGameroomApiClient();
  const res = await api.getPlayerScore(usernameOrId);
  return { success: true, balance: res.data.balance, isGame: res.data.is_game };
}

export async function autoFulfillGameroomRequest(
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
  if (!isGameroomApiConfigured()) {
    return { success: false, error: "Gameroom API credentials not configured." };
  }

  const admin = createAdminClient();
  if (!admin) return { success: false, error: "Database admin client unavailable." };

  try {
    if (loadType === "create_account" || loadType === "new_account") {
      const username = input.requestedUsername?.trim();
      if (!username) return { success: false, error: "Account not found" };
      const password = input.requestedPassword || `Pass_${Math.floor(1000 + Math.random() * 9000)}`;
      const created = await createGameroomAccount({ username, password });

      await admin
        .from("game_load_requests")
        .update({
          status: "completed",
          game_username: created.account,
          game_password: created.password,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      return { success: true };
    }

    if (loadType === "check_balance") {
      const username = input.gameUsername?.trim();
      if (!username) throw new Error("Game username missing");

      const scoreInfo = await getGameroomAccountBalance(username);

      await admin
        .from("game_load_requests")
        .update({
          status: "completed",
          amount: scoreInfo.balance,
          admin_notes: `Balance: $${scoreInfo.balance.toFixed(2)}${scoreInfo.isGame ? " (In Game)" : ""}`,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      return { success: true };
    }

    if (loadType === "load" || loadType === "reload") {
      const username = input.gameUsername?.trim();
      const amount = input.amount || 0;
      if (!username) throw new Error("Game username missing");

      const cleanRemark = `job${requestId.replace(/[^a-zA-Z0-9]/g, "")}`.slice(0, 50);
      await rechargeGameroomAccount({ usernameOrId: username, amount, remark: cleanRemark });

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
      const username = input.gameUsername?.trim();
      const amount = input.amount || 0;
      if (!username) throw new Error("Game username missing");

      const cleanRemark = `job${requestId.replace(/[^a-zA-Z0-9]/g, "")}`.slice(0, 50);
      await withdrawGameroomAccount({ usernameOrId: username, amount, remark: cleanRemark });

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
