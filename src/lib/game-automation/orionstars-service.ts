import { createAdminClient } from "@/lib/supabase/admin";
import { OrionStarsApiClient, parseOrionStarsUserBalance } from "./orionstars-api";

export interface AutoFulfillOrionStarsOptions {
  requestId?: string;
  gameSlug?: string;
  loadType: "create_account" | "check_balance" | "load" | "redeem";
  accountName: string;
  password?: string;
  amount?: number;
}

export interface AutoFulfillOrionStarsResult {
  success: boolean;
  message: string;
  accountName: string;
  credentials?: {
    username: string;
    password?: string;
  };
  balance?: number;
  newBalance?: number;
  rawResponse?: any;
}

export async function autoFulfillOrionStarsRequest(
  options: AutoFulfillOrionStarsOptions
): Promise<AutoFulfillOrionStarsResult> {
  const client = new OrionStarsApiClient();

  const { requestId, loadType, accountName, password, amount = 0 } = options;
  const cleanAccount = accountName.trim();
  const admin = createAdminClient();

  try {
    if (loadType === "create_account") {
      console.log(`[OS Strict Flow] Initiating provider account creation for account: "${cleanAccount}"`);
      const passToUse = password?.trim() || `Pass_${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. Call registerUser on Orion Stars API
      console.log(`[OS Strict Flow] Calling client.createAccount(registerUser)...`);
      const created = await client.createAccount(cleanAccount, passToUse);

      // 2. Strict Verification: Call queryInfo to confirm account exists on Orion Stars server using exact same session
      console.log(`[OS Strict Flow] registerUser code 200 received! Verifying via queryInfo...`);
      const verifiedInfo = await client.queryInfo(created.account, created.session);

      if (String(verifiedInfo.code) !== "200") {
        throw new Error(`Orion Stars account verification failed via queryInfo [code ${verifiedInfo.code}]: ${verifiedInfo.msg || "Account not found on provider server"}`);
      }

      console.log(`[OS Strict Flow] Provider account verified successfully! Userbalance: ${parseOrionStarsUserBalance(verifiedInfo)}`);

      // 3. Save provider account information locally ONLY AFTER verified on Orion Stars provider
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
        console.log(`[OS Strict Flow] Local DB updated to completed for requestId: ${requestId}`);
      }

      return {
        success: true,
        message: `Orion Stars account created and verified on provider: ${created.account}`,
        accountName: created.account,
        credentials: {
          username: created.account,
          password: created.pass,
        },
      };
    }

    if (loadType === "check_balance") {
      const info = await client.queryInfo(cleanAccount);
      if (String(info.code) !== "200") {
        throw new Error(`Orion Stars queryInfo failed [code ${info.code}]: ${info.msg || "Query failed"}`);
      }

      const userBalance = parseOrionStarsUserBalance(info);

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
        message: `Orion Stars balance checked for ${cleanAccount}`,
        accountName: cleanAccount,
        balance: userBalance,
        rawResponse: info,
      };
    }

    if (loadType === "load") {
      if (amount <= 0) {
        throw new Error("Invalid deposit amount for Orion Stars load");
      }

      const res = await client.rechargePlayer(cleanAccount, amount);
      const infoAfter = await client.queryInfo(cleanAccount);
      if (String(infoAfter.code) !== "200") {
        throw new Error(`Orion Stars recharge verification failed [code ${infoAfter.code}]: ${infoAfter.msg || "Recharge verification failed"}`);
      }

      const newBal = parseOrionStarsUserBalance(infoAfter) || amount;

      if (admin && requestId) {
        await admin
          .from("game_load_requests")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId);
      }

      return {
        success: true,
        message: `Orion Stars recharged $${amount}.00 to ${cleanAccount}`,
        accountName: cleanAccount,
        newBalance: newBal,
        rawResponse: res,
      };
    }

    if (loadType === "redeem") {
      if (amount <= 0) {
        throw new Error("Invalid redeem amount for Orion Stars");
      }

      const res = await client.withdrawPlayer(cleanAccount, amount);
      const infoAfter = await client.queryInfo(cleanAccount);
      if (String(infoAfter.code) !== "200") {
        throw new Error(`Orion Stars redeem verification failed [code ${infoAfter.code}]: ${infoAfter.msg || "Redeem verification failed"}`);
      }

      if (admin && requestId) {
        await admin
          .from("game_load_requests")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId);
      }

      return {
        success: true,
        message: `Orion Stars redeemed $${amount}.00 from ${cleanAccount}`,
        accountName: cleanAccount,
        newBalance: parseOrionStarsUserBalance(infoAfter),
        rawResponse: res,
      };
    }

    throw new Error(`Unsupported loadType for Orion Stars: ${loadType}`);
  } catch (err: any) {
    console.error("[Orion Stars Strict Verification Failure]", err.message);

    if (admin && requestId) {
      if (loadType === "load") {
        try {
          await admin.rpc("refund_game_load_wallet", { p_request_id: requestId });
        } catch {}
      }

      await admin
        .from("game_load_requests")
        .update({
          status: "failed",
          error_message: err.message || "Orion Stars provider operation failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      console.log(`[DB] Request status marked FAILED in database for requestId: ${requestId}`);
    }

    return {
      success: false,
      message: err.message || "Orion Stars provider operation failed",
      accountName: cleanAccount,
    };
  }
}
