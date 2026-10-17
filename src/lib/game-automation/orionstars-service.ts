import { createAdminClient } from "@/lib/supabase/admin";
import { generateGamePassword } from "./account-username";
import { OrionStarsApiClient, parseOrionStarsUserBalance } from "./orionstars-api";
import { shouldRefundProviderError } from "./load-outcome";
import { claimProviderAccount, finishProviderAccount } from "./account-claim";
import { openTerminalPlayerAccount, probeFromError, TERMINAL_ACCOUNT_CREATION_ARMED, type ProviderProbe } from "./terminal-account";

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
      let savedPassword = "";
      let checked: Promise<ProviderProbe> | null = null;
      const nameCheck = () => {
        checked ??= client.checkAccountName(cleanAccount).then((result) => ({
          code: result.code,
          message: result.message,
          nameState: result.nameState,
        }));
        return checked;
      };
      const outcome = await openTerminalPlayerAccount({
        provider: "orion-stars",
        account: cleanAccount,
        armed: TERMINAL_ACCOUNT_CREATION_ARMED,
        capability: nameCheck,
        lookup: nameCheck,
        register: async () => {
          const passToUse = password?.trim() || generateGamePassword();
          try {
            const created = await client.createAccount(cleanAccount, passToUse);
            savedPassword = created.pass;
            return { code: "200", message: "" };
          } catch (error) {
            return probeFromError(error);
          }
        },
        verify: async () => readOrionLookup(client, cleanAccount),
        claim: () => claimProviderAccount("orion-stars", cleanAccount),
        finish: (outcome) => finishProviderAccount("orion-stars", cleanAccount, outcome),
      });
      if (outcome.status !== "confirmed" || !savedPassword) {
        throw new Error(outcome.reason);
      }

      if (admin && requestId) {
        await admin
          .from("game_load_requests")
          .update({
            game_username: cleanAccount,
            game_password: savedPassword,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId);
      }

      return {
        success: true,
        message: `Orion Stars account created and confirmed by lookup: ${cleanAccount}`,
        accountName: cleanAccount,
        credentials: {
          username: cleanAccount,
          password: savedPassword,
        },
      };
    }

    if (loadType === "check_balance") {
      const info = await client.queryInfo(cleanAccount);
      if (String(info.code) !== "200") {
        throw new Error(`Orion Stars queryInfo failed [code ${info.code}]: ${info.msg || "Query failed"}`);
      }

      const userBalance = parseOrionStarsUserBalance(info);
      if (userBalance === null) {
        throw new Error("Provider outcome unknown. Balance was not returned.");
      }

      if (admin && requestId) {
        await admin
          .from("game_load_requests")
          .update({
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
        credentials: { username: cleanAccount },
        balance: userBalance,
        rawResponse: info,
      };
    }

    if (loadType === "load") {
      if (amount <= 0) {
        throw new Error("Invalid deposit amount for Orion Stars load");
      }

      const res = await client.rechargePlayer(cleanAccount, amount, undefined, requestId);
      let infoAfter;
      try {
        infoAfter = await client.queryInfo(cleanAccount);
      } catch (error) {
        const message = error instanceof Error ? error.message : "verification failed";
        throw new Error(`Provider outcome unknown. ${message}`);
      }
      if (String(infoAfter.code) !== "200") {
        throw new Error(`Provider outcome unknown. Recharge verification failed [code ${infoAfter.code}].`);
      }

      const newBal = parseOrionStarsUserBalance(infoAfter);
      if (newBal === null) {
        throw new Error("Provider outcome unknown. Balance was not returned.");
      }
      if (!(await client.confirmOperation(res.operationKey))) {
        throw new Error("Provider outcome unknown. Balance was read and the transfer was not confirmed.");
      }

      if (admin && requestId) {
        await admin
          .from("game_load_requests")
          .update({
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

      const res = await client.withdrawPlayer(cleanAccount, amount, undefined, requestId);
      let infoAfter;
      try {
        infoAfter = await client.queryInfo(cleanAccount);
      } catch (error) {
        const message = error instanceof Error ? error.message : "verification failed";
        throw new Error(`Provider outcome unknown. ${message}`);
      }
      if (String(infoAfter.code) !== "200") {
        throw new Error(`Provider outcome unknown. Redeem verification failed [code ${infoAfter.code}].`);
      }
      const redeemedBalance = parseOrionStarsUserBalance(infoAfter);
      if (redeemedBalance === null) {
        throw new Error("Provider outcome unknown. Balance was not returned.");
      }
      if (!(await client.confirmOperation(res.operationKey))) {
        throw new Error("Provider outcome unknown. Balance was read and the transfer was not confirmed.");
      }

      if (admin && requestId) {
        await admin
          .from("game_load_requests")
          .update({
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId);
      }

      return {
        success: true,
        message: `Orion Stars redeemed $${amount}.00 from ${cleanAccount}`,
        accountName: cleanAccount,
        newBalance: redeemedBalance,
        rawResponse: res,
      };
    }

    throw new Error(`Unsupported loadType for Orion Stars: ${loadType}`);
  } catch (err: any) {
    console.error("[Orion Stars Strict Verification Failure]", err.message);

    if (admin && requestId) {
      if (shouldRefundProviderError(err.message, loadType)) {
        try {
          await admin.rpc("refund_game_load_wallet", { p_request_id: requestId });
        } catch {}
      }

      await admin
        .from("game_load_requests")
        .update({
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

async function readOrionLookup(client: OrionStarsApiClient, account: string): Promise<ProviderProbe> {
  try {
    const info = await client.queryInfo(account);
    return { code: String(info.code), message: info.msg || "", balance: parseOrionStarsUserBalance(info) };
  } catch (error) {
    return probeFromError(error);
  }
}
