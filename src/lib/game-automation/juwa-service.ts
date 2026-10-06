import { createAdminClient } from "@/lib/supabase/admin";
import { JuwaApiClient } from "./juwa-api";

export interface AutoFulfillJuwaOptions {
  requestId?: string;
  gameSlug?: string;
  loadType: "create_account" | "check_balance" | "load" | "redeem";
  accountName: string;
  password?: string;
  amount?: number;
}

export interface AutoFulfillJuwaResult {
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

export async function autoFulfillJuwaRequest(
  options: AutoFulfillJuwaOptions
): Promise<AutoFulfillJuwaResult> {
  const client = new JuwaApiClient();

  const { requestId, loadType, accountName, password, amount = 0 } = options;
  const cleanAccount = accountName.trim();
  const admin = createAdminClient();

  try {
    if (loadType === "create_account") {
      console.log(`[Juwa Service] Processing create_account for account: "${cleanAccount}"`);
      const passToUse = password?.trim() || `Pass_${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. Call addUser on Juwa External API
      const created = await client.addUser(cleanAccount, passToUse);
      console.log(`[Juwa Service] addUser success | userId: ${created.userId} | accountName: ${created.accountName}`);

      // 2. Update Database row to completed
      if (admin && requestId) {
        await admin
          .from("game_load_requests")
          .update({
            status: "completed",
            game_username: created.accountName,
            game_password: passToUse,
            admin_notes: `Juwa User ID: ${created.userId}`,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId);
      }

      return {
        success: true,
        message: `Juwa account created successfully: ${created.accountName}`,
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
      } catch (e) {
        userId = cleanAccount;
      }

      const bal = await client.getPlayerBalance(userId);

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
        message: `Juwa balance checked for ${cleanAccount}: $${bal.toFixed(2)}`,
        accountName: cleanAccount,
        balance: bal,
      };
    }

    if (loadType === "load") {
      if (amount <= 0) {
        throw new Error("Invalid deposit amount for Juwa load");
      }

      let userId: string;
      try {
        userId = await client.getUserID(cleanAccount);
      } catch (err) {
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
        message: `Juwa recharged $${amount}.00 to ${cleanAccount}`,
        accountName: cleanAccount,
        newBalance: newBal,
        rawResponse: res,
      };
    }

    if (loadType === "redeem") {
      if (amount <= 0) {
        throw new Error("Invalid redeem amount for Juwa");
      }

      let userId: string;
      try {
        userId = await client.getUserID(cleanAccount);
      } catch (e) {
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
        message: `Juwa redeemed $${amount}.00 from ${cleanAccount}`,
        accountName: cleanAccount,
        newBalance: newBal,
        rawResponse: res,
      };
    }

    throw new Error(`Unsupported loadType for Juwa: ${loadType}`);
  } catch (err: any) {
    console.error("[Juwa Service Error]", err.message);

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
          error_message: err.message || "Juwa API operation failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);
    }

    return {
      success: false,
      message: err.message || "Juwa API operation failed",
      accountName: cleanAccount,
    };
  }
}
