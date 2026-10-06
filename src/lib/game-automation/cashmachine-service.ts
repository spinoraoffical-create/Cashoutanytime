import { createAdminClient } from "@/lib/supabase/admin";
import { formatGameAutomationError } from "./error-formatter";
import {
  getCashMachineApiClient,
  CashMachineApiClient,
  CashMachinePlayer,
} from "./cashmachine-api";

export interface CreateCashMachineAccountParams {
  username: string;
  password?: string;
  nickname?: string;
  initialMoney?: number | string;
}

export interface RechargeCashMachineAccountParams {
  usernameOrId: string | number;
  amount: number | string;
  remark?: string;
}

export interface WithdrawCashMachineAccountParams {
  usernameOrId: string | number;
  amount: number | string;
  remark?: string;
}

/**
 * Check if CashMachine API credentials are configured in environment
 */
export function isCashMachineApiConfigured(): boolean {
  const username = process.env.CASHMACHINE_AGENT_USERNAME || process.env.CASHMACHINE_USERNAME || "";
  const password = process.env.CASHMACHINE_AGENT_PASSWORD || process.env.CASHMACHINE_PASSWORD || "";
  return Boolean(username?.trim() && password?.trim());
}

/**
 * Higher-level service functions for CashMachine web application operations.
 */

export async function createCashMachineAccount(
  params: CreateCashMachineAccountParams,
  client?: CashMachineApiClient
) {
  const api = client || getCashMachineApiClient();
  const password = params.password || "123456";
  const nickname = (params.nickname && params.nickname !== "-")
    ? params.nickname
    : params.username;
  const initialMoney = params.initialMoney ?? "0";

  const res = await api.addPlayer(params.username, password, nickname, initialMoney);

  return {
    success: true,
    account: res.data.account,
    password: res.data.password,
    balance: res.data.balance,
    time: res.data.time,
    message: res.message || "Account created successfully",
  };
}

export async function rechargeCashMachineAccount(
  params: RechargeCashMachineAccountParams,
  client?: CashMachineApiClient
) {
  const api = client || getCashMachineApiClient();
  const res = await api.rechargePlayer(params.usernameOrId, params.amount, params.remark);

  return {
    success: true,
    gameId: res.data.game_id,
    username: res.data.username,
    newBalance: res.data.balance,
    remark: res.data.remark,
    time: res.data.time,
    message: res.message || "Recharge successful",
  };
}

export async function withdrawCashMachineAccount(
  params: WithdrawCashMachineAccountParams,
  client?: CashMachineApiClient
) {
  const api = client || getCashMachineApiClient();
  const res = await api.withdrawPlayer(params.usernameOrId, params.amount, params.remark);

  return {
    success: true,
    gameId: res.data.game_id,
    username: res.data.username,
    newBalance: res.data.balance,
    remark: res.data.remark,
    time: res.data.time,
    message: res.message || "Withdrawal successful",
  };
}

export async function getCashMachineAccountBalance(
  usernameOrId: string | number,
  client?: CashMachineApiClient
) {
  const api = client || getCashMachineApiClient();
  const res = await api.getPlayerScore(usernameOrId);

  return {
    success: true,
    username: res.data.username,
    balance: res.data.balance,
    isGame: res.data.is_game,
    message: res.message || "Query successful",
  };
}

export async function listCashMachineAccounts(
  limit: number = 50,
  page: number = 1,
  client?: CashMachineApiClient
): Promise<{ count: number; players: CashMachinePlayer[] }> {
  const api = client || getCashMachineApiClient();
  const res = await api.getPlayerList(limit, page);

  return {
    count: res.count || 0,
    players: res.data || [],
  };
}

/**
 * Direct Instant Auto-Fulfillment for CashMachine Requests in Next.js Server Actions.
 * Completes jobs in real-time (milliseconds) without waiting for background bot workers!
 */
export async function autoFulfillCashMachineRequest(
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
  if (!isCashMachineApiConfigured()) {
    return { success: false, error: "CashMachine API credentials not configured." };
  }

  const admin = createAdminClient();
  if (!admin) return { success: false, error: "Database admin client unavailable." };

  try {
    // 1. Create account / Replace account
    if (loadType === "create_account" || loadType === "new_account") {
      const username = input.requestedUsername || `CM${Math.floor(100000 + Math.random() * 900000)}`;
      const password = input.requestedPassword || `Pass_${Math.floor(1000 + Math.random() * 9000)}`;

      const created = await createCashMachineAccount({ username, password });

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

    // 2. Check balance
    if (loadType === "check_balance") {
      const username = input.gameUsername?.trim();
      if (!username) throw new Error("Game username missing");

      const scoreInfo = await getCashMachineAccountBalance(username);

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

    // 3. Load (Deposit)
    if (loadType === "load" || loadType === "reload") {
      const username = input.gameUsername?.trim();
      const amount = input.amount || 0;
      if (!username) throw new Error("Game username missing");

      const cleanRemark = `job${requestId.replace(/[^a-zA-Z0-9]/g, "")}`.slice(0, 50);
      await rechargeCashMachineAccount({ usernameOrId: username, amount, remark: cleanRemark });

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

      const cleanRemark = `job${requestId.replace(/[^a-zA-Z0-9]/g, "")}`.slice(0, 50);
      await withdrawCashMachineAccount({ usernameOrId: username, amount, remark: cleanRemark });

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
