import { createAdminClient } from "@/lib/supabase/admin";
import { generateGamePassword } from "./account-username";
import {
  enqueueFireKirin,
  FireKirinApiClient,
  type FireKirinSession,
  fireKirinTransactionId,
  isWholeDollar,
  parseFireKirinUserBalance,
} from "./firekirin-api";

export interface AutoFulfillFireKirinOptions {
  requestId?: string;
  gameSlug?: string;
  loadType: "create_account" | "new_account" | "check_balance" | "load" | "reload" | "redeem";
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
  redeemedAmount?: number;
  rawResponse?: unknown;
}

const ACCOUNT_PATTERN = /^[A-Za-z0-9]{6,32}$/;

export function fireKirinLoginName(raw: string): string {
  let name = raw.replace(/[^A-Za-z0-9]/g, "").slice(0, 20);
  if (name.length < 6) {
    name = `${name || "player"}${Math.floor(100000 + Math.random() * 899999)}`;
  }
  return name.slice(0, 32);
}

export async function fireKirinNameForUser(userId: string): Promise<string> {
  const admin = createAdminClient();
  let stem = "player";
  if (admin) {
    const { data } = await admin.from("profiles").select("username, full_name").eq("id", userId).maybeSingle();
    const profile = data as { username?: string | null; full_name?: string | null } | null;
    const raw = profile?.username || profile?.full_name || "";
    if (raw.replace(/[^A-Za-z0-9]/g, "")) stem = raw;
  }
  return fireKirinLoginName(stem);
}

async function persistFireKirinAccount(userId: string, username: string, password: string) {
  const admin = createAdminClient();
  if (!admin) return;
  const now = new Date().toISOString();
  try {
    await admin.from("user_game_accounts").upsert({
      user_id: userId,
      game_slug: "fire-kirin",
      game_username: username,
      updated_at: now,
    });
  } catch {
    // The game_accounts row is what the next recharge reads.
  }
  const { data: game } = await admin.from("games").select("id").eq("slug", "fire-kirin").maybeSingle();
  const gameId = (game as { id?: string } | null)?.id;
  if (!gameId) return;
  await admin.from("game_accounts").upsert(
    {
      user_id: userId,
      game_id: gameId,
      game_username: username,
      game_password: password,
      updated_at: now,
    },
    { onConflict: "user_id,game_id" }
  );
}

/** Create the Fire Kirin login when the player has no saved account yet. */
export function provisionFireKirinAccount(
  userId: string
): Promise<{ username: string; password: string } | { error: string }> {
  return enqueueFireKirin(() => provisionFireKirinAccountNow(userId));
}

async function provisionFireKirinAccountNow(
  userId: string
): Promise<{ username: string; password: string } | { error: string }> {
  const admin = createAdminClient();
  if (admin) {
    const { data: game } = await admin.from("games").select("id").eq("slug", "fire-kirin").maybeSingle();
    const gameId = (game as { id?: string } | null)?.id;
    if (gameId) {
      const { data: account } = await admin
        .from("game_accounts")
        .select("game_username, game_password")
        .eq("user_id", userId)
        .eq("game_id", gameId)
        .maybeSingle();
      const saved = (account as { game_username?: string | null; game_password?: string | null } | null)?.game_username?.trim();
      if (saved) {
        return {
          username: saved,
          password: (account as { game_password?: string | null }).game_password || "",
        };
      }
    }
  }

  const client = new FireKirinApiClient();
  const username = await fireKirinNameForUser(userId);
  const password = `Pass${Math.floor(1000 + Math.random() * 9000)}`;
  try {
    const session = await client.getValidSession();
    const created = await openFireKirinAccount(client, session, username, password);
    await persistFireKirinAccount(userId, created.account, created.pass);
    return { username: created.account, password: created.pass };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fire Kirin account could not be created.";
    return { error: message };
  }
}

async function saveFireKirinLogin(
  requestId: string | undefined,
  username: string,
  password: string | undefined,
  markCompleted: boolean
) {
  if (!requestId) return;
  const admin = createAdminClient();
  if (!admin) return;
  const now = new Date().toISOString();
  await admin
    .from("game_load_requests")
    .update({
      game_username: username,
      game_password: password ?? null,
      ...(markCompleted ? { status: "completed", completed_at: now } : {}),
      updated_at: now,
    })
    .eq("id", requestId);

  const { data: row } = await admin.from("game_load_requests").select("user_id").eq("id", requestId).maybeSingle();
  const userId = (row as { user_id?: string } | null)?.user_id;
  if (!userId || !password) return;
  await persistFireKirinAccount(userId, username, password);
}

async function closeFireKirinRequest(input: {
  requestId?: string;
  success: boolean;
  errorMessage?: string | null;
  gameUsername?: string | null;
  gamePassword?: string | null;
  redeemedAmount?: number | null;
}) {
  if (!input.requestId) return;
  const admin = createAdminClient();
  if (!admin) throw new Error("Database admin client unavailable.");
  const { error } = await admin.rpc("complete_game_load", {
    p_request_id: input.requestId,
    p_success: input.success,
    p_game_username: input.gameUsername ?? null,
    p_game_password: input.gamePassword ?? null,
    p_error_message: input.errorMessage ?? null,
    p_redeemed_amount: input.redeemedAmount ?? null,
  });
  if (error) throw new Error(error.message);
}

async function failRequest(requestId: string | undefined, message: string, refund: boolean) {
  if (!requestId) return;
  const admin = createAdminClient();
  if (!admin) return;
  if (refund) {
    try {
      await admin.rpc("refund_game_load_wallet", { p_request_id: requestId });
    } catch {
      // The status update still stops the request from waiting on staff.
    }
  }
  await admin
    .from("game_load_requests")
    .update({
      status: "failed",
      error_message: message.slice(0, 400),
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .in("status", ["pending", "processing"]);
}

export function autoFulfillFireKirinRequest(
  options: AutoFulfillFireKirinOptions
): Promise<AutoFulfillFireKirinResult> {
  return enqueueFireKirin(() => autoFulfillFireKirinNow(options));
}

async function autoFulfillFireKirinNow(
  options: AutoFulfillFireKirinOptions
): Promise<AutoFulfillFireKirinResult> {
  const { requestId, accountName, password, amount = 0 } = options;
  const loadType = options.loadType === "new_account" ? "create_account" : options.loadType === "reload" ? "load" : options.loadType;
  const cleanAccount = accountName.trim();
  const admin = createAdminClient();
  let redeemedAmount: number | undefined;

  if (loadType === "create_account") {
    const passToUse = password?.trim() || generateGamePassword();
    try {
      if (!/^[A-Za-z0-9]{7,13}$/.test(cleanAccount)) {
        throw new Error("Fire Kirin username must be 7 to 13 letters or numbers.");
      }
      const { createFireKirinPlayerOnStore } = await import("./firekirin-store");
      await createFireKirinPlayerOnStore(cleanAccount, passToUse);
      await saveFireKirinLogin(requestId, cleanAccount, passToUse, false);
      return {
        success: true,
        message: `Fire Kirin account created: ${cleanAccount}`,
        accountName: cleanAccount,
        credentials: { username: cleanAccount, password: passToUse },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fire Kirin store could not create the player.";
      console.error("[Fire Kirin automation failure]", message);
      await failRequest(requestId, message, false);
      return { success: false, message, accountName: cleanAccount };
    }
  }

  const client = new FireKirinApiClient();

  try {
    if (!ACCOUNT_PATTERN.test(cleanAccount)) {
      throw new Error("Fire Kirin player account must be 6 to 32 letters or numbers.");
    }
    if (client.name && cleanAccount.toLowerCase() === client.name.toLowerCase()) {
      throw new Error("Fire Kirin registerUser refused: player account cannot be the agent login.");
    }

    const session = await client.getValidSession();
    const transactionId = requestId ? fireKirinTransactionId(requestId) : "";

    if (loadType === "check_balance") {
      const info = await client.queryInfo(cleanAccount, session);
      const userBalance = parseFireKirinUserBalance(info);
      await closeFireKirinRequest({
        requestId,
        success: true,
        gameUsername: cleanAccount,
        redeemedAmount: userBalance,
      });
      return {
        success: true,
        message: `Fire Kirin balance checked for ${cleanAccount}`,
        accountName: cleanAccount,
        balance: userBalance,
        redeemedAmount: userBalance,
        rawResponse: info,
      };
    }

    if (loadType === "load") {
      if (!isWholeDollar(amount)) {
        throw new Error("Fire Kirin recharge amount must be a whole dollar.");
      }
      const account = await ensureFireKirinAccount(client, session, cleanAccount, password);
      const res = await client.rechargePlayer(account.account, amount, session, transactionId);
      return {
        success: true,
        message: `Fire Kirin recharged $${res.amount.toFixed(2)} to ${account.account}`,
        accountName: account.account,
        credentials: account.pass ? { username: account.account, password: account.pass } : undefined,
        newBalance: res.amount,
        rawResponse: res,
      };
    }

    if (loadType === "redeem") {
      let redeemAll = !(amount > 0);
      if (admin && requestId) {
        const { data: requestRow } = await admin
          .from("game_load_requests")
          .select("redeem_all")
          .eq("id", requestId)
          .maybeSingle();
        if ((requestRow as { redeem_all?: boolean } | null)?.redeem_all) redeemAll = true;
      }
      if (!redeemAll && !isWholeDollar(amount)) {
        throw new Error("Fire Kirin redeem amount must be a whole dollar.");
      }

      await client.kickPlayerOut(cleanAccount, session);
      const info = await client.queryInfo(cleanAccount, session);
      const balance = parseFireKirinUserBalance(info);
      if (!(balance > 0)) {
        throw new Error("Fire Kirin balance is 0.");
      }

      let take: number;
      if (redeemAll || amount > balance) {
        if (!isWholeDollar(balance)) {
          throw new Error("Fire Kirin balance is not a whole dollar.");
        }
        take = Math.trunc(balance);
      } else {
        take = Math.trunc(amount);
      }

      const res = await client.withdrawPlayer(cleanAccount, take, session, transactionId);
      redeemedAmount = res.amount;
      await closeFireKirinRequest({
        requestId,
        success: true,
        gameUsername: cleanAccount,
        redeemedAmount: res.amount,
      });
      return {
        success: true,
        message: `Fire Kirin redeemed $${res.amount.toFixed(2)} from ${cleanAccount}`,
        accountName: cleanAccount,
        redeemedAmount: res.amount,
        rawResponse: res,
      };
    }

    throw new Error(`Unsupported loadType for Fire Kirin: ${options.loadType}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fire Kirin provider operation failed";
    console.error("[Fire Kirin automation failure]", message);

    if (loadType === "redeem" && redeemedAmount != null) {
      return {
        success: true,
        message,
        accountName: cleanAccount,
        redeemedAmount,
      };
    }

    await failRequest(requestId, message, loadType === "load");
    return {
      success: false,
      message,
      accountName: cleanAccount,
    };
  }
}

async function openFireKirinAccount(
  client: FireKirinApiClient,
  session: FireKirinSession,
  account: string,
  password?: string
) {
  const passToUse = password?.trim() || `Pass${Math.floor(1000 + Math.random() * 9000)}`;
  const created = await client.createAccount(account, passToUse, session);
  const verified = await client.queryInfo(created.account, created.session);
  if (String(verified.code) !== "200") {
    throw new Error(`Fire Kirin account verification failed [code ${verified.code}]: ${verified.msg || "Account not found"}`);
  }
  return created;
}

async function ensureFireKirinAccount(
  client: FireKirinApiClient,
  session: FireKirinSession,
  account: string,
  password: string | undefined
) {
  await client.queryInfo(account, session);
  return { account, pass: password };
}
