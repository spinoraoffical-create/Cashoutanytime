import { createAdminClient } from "@/lib/supabase/admin";
import { VegasApiClient } from "./vegas-api";

export interface AutoFulfillVegasOptions {
  requestId?: string;
  gameSlug?: string;
  loadType: "create_account" | "check_balance" | "load" | "redeem";
  accountName: string;
  password?: string;
  amount?: number;
}

export interface AutoFulfillVegasResult {
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

export async function autoFulfillVegasRequest(
  options: AutoFulfillVegasOptions
): Promise<AutoFulfillVegasResult> {
  const client = new VegasApiClient();
  const { requestId, loadType, accountName, password, amount = 0 } = options;
  const cleanAccount = accountName.trim();
  const admin = createAdminClient();

  try {
    if (loadType === "create_account") {
      console.log(`[Vegas Service] Processing create_account for account: "${cleanAccount}"`);
      const passToUse = password?.trim() || `Pass_${Math.floor(1000 + Math.random() * 9000)}`;

      const created = await client.addUser(cleanAccount, passToUse);
      console.log(
        `[Vegas Service] addUser success | userId: ${created.userId} | accountName: ${created.accountName}`
      );

      if (admin && requestId) {
        await admin
          .from("game_load_requests")
          .update({
            status: "completed",
            game_username: created.accountName,
            game_password: passToUse,
            admin_notes: `Vegas User ID: ${created.userId}`,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId);
      }

      return {
        success: true,
        message: `Vegas account created successfully: ${created.accountName}`,
        accountName: created.accountName,
        credentials: {
          username: created.accountName,
          password: passToUse,
        },
      };
    }

    if (loadType === "check_balance") {
      let userId: string;
      try {
        userId = await client.getUserID(cleanAccount);
      } catch {
        userId = cleanAccount;
      }

      const bal = await client.getUserBalance(userId);

      if (admin && requestId) {
        await admin
          .from("game_load_requests")
          .update({
            status: "completed",
            amount: bal,
            admin_notes: `Balance: $${bal.toFixed(2)}`,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId);
      }

      return {
        success: true,
        message: `Vegas balance checked for ${cleanAccount}: $${bal.toFixed(2)}`,
        accountName: cleanAccount,
        balance: bal,
      };
    }

    if (loadType === "load") {
      if (amount <= 0) {
        throw new Error("Invalid deposit amount for Vegas load");
      }

      let userId: string;
      try {
        userId = await client.getUserID(cleanAccount);
      } catch {
        const passToUse = password?.trim() || `Pass_${Math.floor(1000 + Math.random() * 9000)}`;
        const newUser = await client.addUser(cleanAccount, passToUse);
        userId = newUser.userId;
      }

      const res = await client.recharge(userId, amount, requestId);
      const newBal = parseFloat(res.data?.user_balance || String(amount));

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
        message: `Vegas recharged $${amount}.00 to ${cleanAccount}`,
        accountName: cleanAccount,
        newBalance: newBal,
        rawResponse: res,
      };
    }

    if (loadType === "redeem") {
      if (amount <= 0) {
        throw new Error("Invalid redeem amount for Vegas");
      }

      let userId: string;
      try {
        userId = await client.getUserID(cleanAccount);
      } catch {
        userId = cleanAccount;
      }

      const res = await client.withdraw(userId, amount, requestId);
      const newBal = parseFloat(res.data?.user_balance || "0");

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
        message: `Vegas redeemed $${amount}.00 from ${cleanAccount}`,
        accountName: cleanAccount,
        newBalance: newBal,
        rawResponse: res,
      };
    }

    throw new Error(`Unsupported loadType for Vegas: ${loadType}`);
  } catch (err: any) {
    console.error("[Vegas Service Error]", err.message);

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
          error_message: err.message || "Vegas API operation failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);
    }

    return {
      success: false,
      message: err.message || "Vegas API operation failed",
      accountName: cleanAccount,
    };
  }
}
