import { createAdminClient } from "@/lib/supabase/admin";
import { FireKirinApiClient, parseFireKirinUserBalance } from "./firekirin-api";

export interface AutoFulfillFireKirinOptions {
  requestId?: string;
  gameSlug?: string;
  loadType: "create_account" | "check_balance" | "load" | "redeem";
  accountName: string;
  password?: string;
  amount?: number;
}

export interface AutoFulfillFireKirinResult {
  success: boolean;
  message: string;
  accountName: string;
  credentials?: {
    username: string;
    password?: string;
  };
  balance?: number;
  newBalance?: number;
  rawResponse?: unknown;
}

export async function autoFulfillFireKirinRequest(
  options: AutoFulfillFireKirinOptions
): Promise<AutoFulfillFireKirinResult> {
  const client = new FireKirinApiClient();
  const { requestId, loadType, accountName, password, amount = 0 } = options;
  const cleanAccount = accountName.trim();
  const admin = createAdminClient();

  try {
    if (loadType === "create_account") {
      const passToUse = password?.trim() || `Pass_${Math.floor(1000 + Math.random() * 9000)}`;
      const created = await client.createAccount(cleanAccount, passToUse);
      const verifiedInfo = await client.queryInfo(created.account, created.session);

      if (String(verifiedInfo.code) !== "200") {
        throw new Error(
          `Fire Kirin account verification failed [code ${verifiedInfo.code}]: ${verifiedInfo.msg || "Account not found"}`
        );
      }

      if (admin && requestId) {
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
      }

      return {
        success: true,
        message: `Fire Kirin account created and verified: ${created.account}`,
        accountName: created.account,
        credentials: {
          username: created.account,
          password: created.pass,
        },
      };
    }

    if (loadType === "check_balance") {
      const info = await client.queryInfo(cleanAccount);
      const userBalance = parseFireKirinUserBalance(info);

      if (admin && requestId) {
        await admin
          .from("game_load_requests")
          .update({
            status: "completed",
            amount: userBalance,
            admin_notes: `Balance: $${userBalance.toFixed(2)}`,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId);
      }

      return {
        success: true,
        message: `Fire Kirin balance checked for ${cleanAccount}`,
        accountName: cleanAccount,
        balance: userBalance,
        rawResponse: info,
      };
    }

    if (loadType === "load") {
      if (amount <= 0) {
        throw new Error("Invalid deposit amount for Fire Kirin load");
      }

      const res = await client.rechargePlayer(cleanAccount, amount);
      const infoAfter = await client.queryInfo(cleanAccount);
      const newBal = parseFireKirinUserBalance(infoAfter) || amount;

      if (admin && requestId) {
        await admin
          .from("game_load_requests")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            admin_notes: `Recharge tx: ${res.transactionId}`,
          })
          .eq("id", requestId);
      }

      return {
        success: true,
        message: `Fire Kirin recharged $${amount.toFixed(2)} to ${cleanAccount}`,
        accountName: cleanAccount,
        newBalance: newBal,
        rawResponse: res,
      };
    }

    if (loadType === "redeem") {
      if (amount <= 0) {
        throw new Error("Invalid redeem amount for Fire Kirin");
      }

      const res = await client.withdrawPlayer(cleanAccount, amount);
      const infoAfter = await client.queryInfo(cleanAccount);

      if (admin && requestId) {
        await admin
          .from("game_load_requests")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            admin_notes: `Redeem tx: ${res.transactionId}`,
          })
          .eq("id", requestId);
      }

      return {
        success: true,
        message: `Fire Kirin redeemed $${amount.toFixed(2)} from ${cleanAccount}`,
        accountName: cleanAccount,
        newBalance: parseFireKirinUserBalance(infoAfter),
        rawResponse: res,
      };
    }

    throw new Error(`Unsupported loadType for Fire Kirin: ${loadType}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fire Kirin provider operation failed";
    console.error("[Fire Kirin automation failure]", message);

    if (admin && requestId) {
      if (loadType === "load") {
        try {
          await admin.rpc("refund_game_load_wallet", { p_request_id: requestId });
        } catch {
          // non-fatal
        }
      }

      await admin
        .from("game_load_requests")
        .update({
          status: "failed",
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);
    }

    return {
      success: false,
      message,
      accountName: cleanAccount,
    };
  }
}
