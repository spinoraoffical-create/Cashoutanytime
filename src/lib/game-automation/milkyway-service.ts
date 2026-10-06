import { createAdminClient } from "@/lib/supabase/admin";
import { MilkyWayApiClient, parseMilkyWayUserBalance } from "./milkyway-api";

export interface AutoFulfillMilkyWayOptions {
  requestId?: string;
  gameSlug?: string;
  loadType: "create_account" | "check_balance" | "load" | "redeem";
  accountName: string;
  password?: string;
  amount?: number;
}

export interface AutoFulfillMilkyWayResult {
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

export async function autoFulfillMilkyWayRequest(
  options: AutoFulfillMilkyWayOptions
): Promise<AutoFulfillMilkyWayResult> {
  const client = new MilkyWayApiClient();

  const { requestId, loadType, accountName, password, amount = 0 } = options;
  const cleanAccount = accountName.trim();
  const admin = createAdminClient();

  try {
    if (loadType === "create_account") {
      console.log(`[MW Strict Flow] Initiating provider account creation for account: "${cleanAccount}"`);
      const passToUse = password?.trim() || `Pass_${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. Call registerUser on Milky Way API
      console.log(`[MW Strict Flow] Calling client.createAccount(registerUser)...`);
      const created = await client.createAccount(cleanAccount, passToUse);

      // 2. Strict Verification: Call queryInfo to confirm account exists on Milky Way server using exact same session
      console.log(`[MW Strict Flow] registerUser code 200 received! Verifying via queryInfo...`);
      const verifiedInfo = await client.queryInfo(created.account, created.session);

      if (String(verifiedInfo.code) !== "200") {
        throw new Error(`Milky Way account verification failed via queryInfo [code ${verifiedInfo.code}]: ${verifiedInfo.msg || "Account not found on provider server"}`);
      }

      console.log(`[MW Strict Flow] Provider account verified successfully! Userbalance: ${parseMilkyWayUserBalance(verifiedInfo)}`);

      // 3. Save provider account information locally ONLY AFTER verified on Milky Way provider
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
        console.log(`[MW Strict Flow] Local DB updated to completed for requestId: ${requestId}`);
      }

      return {
        success: true,
        message: `Milky Way account created and verified on provider: ${created.account}`,
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
        throw new Error(`Milky Way queryInfo failed [code ${info.code}]: ${info.msg || "Query failed"}`);
      }

      const userBalance = parseMilkyWayUserBalance(info);

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
        message: `Milky Way balance checked for ${cleanAccount}`,
        accountName: cleanAccount,
        balance: userBalance,
        rawResponse: info,
      };
    }

    if (loadType === "load") {
      if (amount <= 0) {
        throw new Error("Invalid deposit amount for Milky Way load");
      }

      const res = await client.rechargePlayer(cleanAccount, amount);
      const infoAfter = await client.queryInfo(cleanAccount);
      if (String(infoAfter.code) !== "200") {
        throw new Error(`Milky Way recharge verification failed [code ${infoAfter.code}]: ${infoAfter.msg || "Recharge verification failed"}`);
      }

      const newBal = parseMilkyWayUserBalance(infoAfter) || amount;

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
        message: `Milky Way recharged $${amount}.00 to ${cleanAccount}`,
        accountName: cleanAccount,
        newBalance: newBal,
        rawResponse: res,
      };
    }

    if (loadType === "redeem") {
      if (amount <= 0) {
        throw new Error("Invalid redeem amount for Milky Way");
      }

      const res = await client.withdrawPlayer(cleanAccount, amount);
      const infoAfter = await client.queryInfo(cleanAccount);
      if (String(infoAfter.code) !== "200") {
        throw new Error(`Milky Way redeem verification failed [code ${infoAfter.code}]: ${infoAfter.msg || "Redeem verification failed"}`);
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
        message: `Milky Way redeemed $${amount}.00 from ${cleanAccount}`,
        accountName: cleanAccount,
        newBalance: parseMilkyWayUserBalance(infoAfter),
        rawResponse: res,
      };
    }

    throw new Error(`Unsupported loadType for Milky Way: ${loadType}`);
  } catch (err: any) {
    console.error("[Milky Way Strict Verification Failure]", err.message);

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
          error_message: err.message || "Milky Way provider operation failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      console.log(`[DB] Request status marked FAILED in database for requestId: ${requestId}`);
    }

    return {
      success: false,
      message: err.message || "Milky Way provider operation failed",
      accountName: cleanAccount,
    };
  }
}
