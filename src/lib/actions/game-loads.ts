"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/actions/notifications";
import { notifyAdminOfWalletActivity } from "@/lib/telegram/notify-admin-wallet-activity";
import { getJuwaAdminPanelUrl, getVegasAdminPanelUrl, getGameVaultAdminPanelUrl, getCashFrenzyAdminPanelUrl, getFireKirinAdminPanelUrl, getVblinkAdminPanelUrl, isWalletLoadEnabledForGame, WALLET_LOAD_LIMITS } from "@/lib/game-automation/config";
import {
  ensureGameAccountUsername,
  freshAccountName,
  generateGamePassword,
  validateCustomGameAccountCredentials,
} from "@/lib/game-automation/account-username";
import type { GameLoadWalletType } from "@/lib/game-automation/types";
import {
  depositRolloverBounds,
  DEPOSIT_LOAD_TYPES,
  type DepositRolloverBounds,
} from "@/lib/wallet/deposit-redeem-rollover";
import { autoFulfillCashMachineRequest, isCashMachineApiConfigured } from "@/lib/game-automation/cashmachine-service";
import { autoFulfillCashFrenzyRequest, isCashFrenzyApiConfigured } from "@/lib/game-automation/cashfrenzy-service";
import { autoFulfillGameroomRequest, isGameroomApiConfigured } from "@/lib/game-automation/gameroom-service";
import { autoFulfillMrAllInOneRequest, isMrAllInOneApiConfigured } from "@/lib/game-automation/mrallinone-service";
import { autoFulfillGameVaultRequest, isGameVaultApiConfigured } from "@/lib/game-automation/gamevault-service";
import { autoFulfillMafiaRequest, isMafiaApiConfigured } from "@/lib/game-automation/mafia-service";
import { autoFulfillOrionStarsRequest } from "@/lib/game-automation/orionstars-service";
import { isOrionStarsApiConfigured } from "@/lib/game-automation/orionstars-api";
import { autoFulfillMilkyWayRequest } from "@/lib/game-automation/milkyway-service";
import { isMilkyWayApiConfigured } from "@/lib/game-automation/milkyway-api";
import { autoFulfillFireKirinRequest, provisionFireKirinAccount } from "@/lib/game-automation/firekirin-service";
import { autoFulfillVblinkRequest, isVblinkApiConfigured } from "@/lib/game-automation/vblink-service";
import { isFireKirinApiConfigured } from "@/lib/game-automation/firekirin-api";
import { autoFulfillJuwaRequest } from "@/lib/game-automation/juwa-service";
import { isJuwaApiConfigured } from "@/lib/game-automation/juwa-api";
import { autoFulfillVegasRequest } from "@/lib/game-automation/vegas-service";
import { isVegasApiConfigured } from "@/lib/game-automation/vegas-api";
import { userFacingGameLoadError } from "@/lib/game-automation/user-facing-errors";
import { usernameForOwner } from "@/lib/games/owned-account";
import { finishGameLoad } from "@/lib/game-automation/finish-game-load";

async function ownedGameUsername(userId: string, gameSlug: string) {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: game } = await admin.from("games").select("id").eq("slug", gameSlug).maybeSingle();
  const gameId = (game as { id?: string } | null)?.id;
  if (!gameId) return null;
  const { data } = await admin
    .from("game_accounts")
    .select("game_username")
    .eq("user_id", userId)
    .eq("game_id", gameId)
    .maybeSingle();
  const match = usernameForOwner(
    [
      {
        userId,
        gameSlug,
        username: (data as { game_username?: string | null } | null)?.game_username ?? "",
      },
    ],
    userId,
    gameSlug
  );
  return "username" in match ? match.username : null;
}

async function generatedLoginForUser(
  userId: string,
  gameSlug: string
): Promise<{ username: string; password: string }> {
  if (gameSlug === "fire-kirin") {
    const admin = createAdminClient();
    let stem = "player";
    if (admin) {
      const { data } = await admin
        .from("profiles")
        .select("username, full_name")
        .eq("id", userId)
        .maybeSingle();
      const profile = data as { username?: string | null; full_name?: string | null } | null;
      const raw = (profile?.username || profile?.full_name || "").replace(/[^A-Za-z0-9]/g, "");
      if (raw) stem = raw;
    }
    return {
      username: ensureGameAccountUsername(stem, gameSlug),
      password: generateGamePassword(),
    };
  }
  const admin = createAdminClient();
  let stem = "player";
  if (admin) {
    const { data } = await admin
      .from("profiles")
      .select("username, full_name")
      .eq("id", userId)
      .maybeSingle();
    const profile = data as { username?: string | null; full_name?: string | null } | null;
    const raw = profile?.username || profile?.full_name || "";
    if (raw.trim()) stem = raw;
  }
  const base = ensureGameAccountUsername(stem.replace(/[^A-Za-z0-9]/g, "") || "player", gameSlug);
  return {
    username: freshAccountName(base, gameSlug),
    password: generateGamePassword(),
  };
}

async function clearStaleRequests(userId: string, gameSlug: string) {
  const admin = createAdminClient();
  if (!admin) return;
  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  await admin
    .from("game_load_requests")
    .update({
      status: "failed",
      error_message: "This request timed out. Try again.",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("game_slug", gameSlug)
    .in("status", ["pending", "processing"])
    .lt("created_at", cutoff);
}

function playerGameError(message: string | null | undefined, loadType?: string | null): string {
  if (message?.trim()) console.error("[game-loads]", message);
  return (
    userFacingGameLoadError(message, loadType) ||
    "Request failed. Please try again or contact support."
  );
}

async function fulfillOrFail(
  gameSlug: string,
  requestId: string,
  loadType: "create_account" | "new_account" | "check_balance" | "load" | "reload" | "redeem",
  input: {
    userId: string;
    gameUsername?: string | null;
    amount?: number | null;
    requestedUsername?: string | null;
    requestedPassword?: string | null;
  }
) {
  try {
    const result = await autoFulfillGameRequest(gameSlug, requestId, loadType, input);
    if (!result) {
      await finishGameLoad({
        requestId,
        success: false,
        errorMessage: "Game API credentials are not configured.",
      });
      return { success: false as const, error: "Game API credentials are not configured." };
    }
    const redeemed =
      result.redeemedAmount ??
      (result.success && (loadType === "redeem" || loadType === "check_balance") ? input.amount : null);
    await finishGameLoad({
      requestId,
      success: result.success,
      errorMessage: result.success ? null : result.error,
      gameUsername: result.username,
      gamePassword: result.password,
      redeemedAmount: redeemed,
    });
    return result.success
      ? { success: true as const }
      : { success: false as const, error: result.error || "Game load failed." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Game request failed";
    console.error("[game-loads] fulfill threw", message);
    await finishGameLoad({
      requestId,
      success: false,
      errorMessage: message.slice(0, 400),
    });
    return { success: false as const, error: message };
  }
}

export async function fulfillTrackedRequest(requestId: string) {
  const admin = createAdminClient();
  if (!admin) return { success: false as const, error: "SUPABASE_SERVICE_ROLE_KEY is not configured." };
  const { data } = await admin
    .from("game_load_requests")
    .select("id, user_id, game_slug, game_name, amount, load_type, game_username, game_password, status")
    .eq("id", requestId)
    .maybeSingle();
  const row = data as {
    id: string;
    user_id: string;
    game_slug: string;
    amount: number | null;
    load_type: "create_account" | "new_account" | "load" | "reload";
    game_username: string | null;
    game_password: string | null;
    status: string;
  } | null;
  if (!row) return { success: false as const, error: "Load request not found." };
  if (row.status === "completed") return { success: true as const };
  const result = await fulfillOrFail(row.game_slug, row.id, row.load_type, {
    userId: row.user_id,
    gameUsername: row.game_username,
    amount: row.amount,
    requestedUsername: row.game_username,
    requestedPassword: row.game_password,
  });
  return result.success
    ? { success: true as const }
    : { success: false as const, error: result.error || "Game load failed." };
}

const API_CONFIGURED_GAMES = ["cash-machine", "cash-frenzy", "gameroom", "game-vault", "mafia", "juwa", "vegas-sweeps", "mr-all-in-one", "orion-stars", "milky-way", "fire-kirin", "vblink"];

const GAME_API_UNAVAILABLE = "This game is not connected yet. Try again later or contact support.";

function isGameApiReady(slug: string): boolean {
  switch (slug) {
    case "juwa":
      return isJuwaApiConfigured();
    case "vegas-sweeps":
      return isVegasApiConfigured();
    case "cash-machine":
      return isCashMachineApiConfigured();
    case "cash-frenzy":
      return isCashFrenzyApiConfigured();
    case "gameroom":
      return isGameroomApiConfigured();
    case "mr-all-in-one":
      return isMrAllInOneApiConfigured();
    case "game-vault":
      return isGameVaultApiConfigured();
    case "mafia":
      return isMafiaApiConfigured();
    case "orion-stars":
      return isOrionStarsApiConfigured();
    case "milky-way":
      return isMilkyWayApiConfigured();
    case "fire-kirin":
      return isFireKirinApiConfigured();
    case "vblink":
      return isVblinkApiConfigured();
    default:
      return false;
  }
}

async function autoFulfillGameRequest(
  gameSlug: string,
  requestId: string,
  loadType: "create_account" | "new_account" | "check_balance" | "load" | "reload" | "redeem",
  input: {
    userId: string;
    gameUsername?: string | null;
    amount?: number | null;
    requestedUsername?: string | null;
    requestedPassword?: string | null;
  }
): Promise<{
  success: boolean;
  error?: string;
  username?: string;
  password?: string;
  redeemedAmount?: number;
} | null> {
  const movingMoney =
    loadType === "load" || loadType === "reload" || loadType === "redeem" || loadType === "check_balance";
  let targetAccount = (
    movingMoney ? input.gameUsername : input.requestedUsername || input.gameUsername
  )?.trim();
  let requestedPassword = input.requestedPassword || undefined;
  if (!targetAccount && (loadType === "create_account" || loadType === "new_account")) {
    const generated = await generatedLoginForUser(input.userId, gameSlug);
    targetAccount = generated.username;
    requestedPassword = requestedPassword || generated.password;
  }
  if (!targetAccount) return { success: false, error: "Account not found" };
  const fulfillInput = {
    ...input,
    gameUsername: movingMoney ? input.gameUsername : targetAccount,
    requestedUsername: movingMoney ? input.requestedUsername : targetAccount,
    requestedPassword,
  };

  if (gameSlug === "juwa" && isJuwaApiConfigured()) {
    const mapType = loadType === "new_account" ? "create_account" : loadType === "reload" ? "load" : loadType;
    const res = await autoFulfillJuwaRequest({
      requestId,
      gameSlug,
      loadType: mapType as any,
      accountName: targetAccount,
      password: requestedPassword,
      amount: input.amount || 0,
    });
    return {
      success: res.success,
      error: res.success ? undefined : res.message,
      username: res.credentials?.username,
      password: res.credentials?.password,
      redeemedAmount: loadType === "redeem" ? input.amount ?? undefined : loadType === "check_balance" ? res.balance : undefined,
    };
  }
  if (gameSlug === "vegas-sweeps" && isVegasApiConfigured()) {
    const mapType = loadType === "new_account" ? "create_account" : loadType === "reload" ? "load" : loadType;
    const res = await autoFulfillVegasRequest({
      requestId,
      gameSlug,
      loadType: mapType as any,
      accountName: targetAccount,
      password: requestedPassword,
      amount: input.amount || 0,
    });
    return {
      success: res.success,
      error: res.success ? undefined : res.message,
      username: res.credentials?.username,
      password: res.credentials?.password,
      redeemedAmount: loadType === "redeem" ? input.amount ?? undefined : loadType === "check_balance" ? res.balance : undefined,
    };
  }
  if (gameSlug === "cash-machine" && isCashMachineApiConfigured()) {
    return autoFulfillCashMachineRequest(requestId, loadType, fulfillInput);
  }
  if (gameSlug === "cash-frenzy" && isCashFrenzyApiConfigured()) {
    return autoFulfillCashFrenzyRequest(requestId, loadType, fulfillInput);
  }
  if (gameSlug === "gameroom" && isGameroomApiConfigured()) {
    return autoFulfillGameroomRequest(requestId, loadType, fulfillInput);
  }
  if (gameSlug === "mr-all-in-one" && isMrAllInOneApiConfigured()) {
    return autoFulfillMrAllInOneRequest(requestId, loadType, fulfillInput);
  }
  if (gameSlug === "game-vault" && isGameVaultApiConfigured()) {
    return autoFulfillGameVaultRequest(requestId, loadType, fulfillInput);
  }
  if (gameSlug === "mafia" && isMafiaApiConfigured()) {
    return autoFulfillMafiaRequest(requestId, loadType, fulfillInput);
  }
  if (gameSlug === "orion-stars" && isOrionStarsApiConfigured()) {
    const mapType = loadType === "new_account" ? "create_account" : loadType === "reload" ? "load" : loadType;
    const res = await autoFulfillOrionStarsRequest({
      requestId,
      gameSlug,
      loadType: mapType as any,
      accountName: targetAccount,
      password: requestedPassword,
      amount: input.amount || 0,
    });
    return {
      success: res.success,
      error: res.success ? undefined : res.message,
      username: res.credentials?.username,
      password: res.credentials?.password,
      redeemedAmount: loadType === "redeem" ? input.amount ?? undefined : loadType === "check_balance" ? res.balance : undefined,
    };
  }
  if (gameSlug === "milky-way" && isMilkyWayApiConfigured()) {
    const mapType = loadType === "new_account" ? "create_account" : loadType === "reload" ? "load" : loadType;
    const res = await autoFulfillMilkyWayRequest({
      requestId,
      gameSlug,
      loadType: mapType as any,
      accountName: targetAccount,
      password: requestedPassword,
      amount: input.amount || 0,
    });
    return {
      success: res.success,
      error: res.success ? undefined : res.message,
      username: res.credentials?.username,
      password: res.credentials?.password,
      redeemedAmount: loadType === "redeem" ? input.amount ?? undefined : loadType === "check_balance" ? res.balance : undefined,
    };
  }
  if (gameSlug === "vblink" && isVblinkApiConfigured()) {
    return autoFulfillVblinkRequest(requestId, loadType, fulfillInput);
  }
  if (gameSlug === "fire-kirin" && isFireKirinApiConfigured()) {
    const mapType = loadType === "new_account" ? "create_account" : loadType === "reload" ? "load" : loadType;
    const res = await autoFulfillFireKirinRequest({
      requestId,
      gameSlug,
      loadType: mapType as any,
      accountName: targetAccount,
      password: requestedPassword,
      amount: input.amount || 0,
    });
    return {
      success: res.success,
      error: res.success ? undefined : res.message,
      username: res.credentials?.username,
      password: res.credentials?.password,
      redeemedAmount:
        loadType === "redeem"
          ? res.redeemedAmount
          : loadType === "check_balance"
            ? res.balance
            : undefined,
    };
  }
  return null;
}

export async function requestGameAccountCreate(input: {
  gameSlug: string;
  gameName: string;
  username?: string;
  password?: string;
  /** Required when the user already has completed game credentials for this slug. */
  replaceAccount?: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!isWalletLoadEnabledForGame(input.gameSlug)) {
    return { error: "Wallet load is not enabled for this game yet." };
  }
  if (!isGameApiReady(input.gameSlug)) {
    return { error: GAME_API_UNAVAILABLE };
  }

  // Fail jobs stuck in pending/processing (no-op if SQL migration not applied yet).
  void supabase.rpc("fail_my_stale_game_load", {
    p_stale_minutes: 5,
    p_game_slug: input.gameSlug,
  });

  const existing = await getMyGameAccount(input.gameSlug);
  const hasAccount = Boolean(existing?.game_username);
  const shouldReplace = input.replaceAccount || hasAccount;

  const rawUsername = input.username?.trim() || undefined;
  const password = input.password?.trim() || undefined;

  let username: string | undefined;
  let finalPassword: string | undefined;

  if (rawUsername || password) {
    if (!rawUsername || !password) {
      return { error: "Username and password are required for a custom login." };
    }
    const validated = validateCustomGameAccountCredentials(
      rawUsername,
      password,
      input.gameSlug
    );
    if (!validated.ok) return { error: validated.error };
    username = validated.username;
    finalPassword = validated.password;
  } else {
    const generated = await generatedLoginForUser(user.id, input.gameSlug);
    username = generated.username;
    finalPassword = generated.password;
  }

  await clearStaleRequests(user.id, input.gameSlug);

  const { data: pending } = await supabase
    .from("game_load_requests")
    .select("id, load_type, game_username")
    .eq("user_id", user.id)
    .eq("game_slug", input.gameSlug)
    .in("status", ["pending", "processing"])
    .maybeSingle();

  const stuckCreate = pending as { id: string; game_username: string | null } | null;
  if (stuckCreate && !stuckCreate.game_username) {
    const admin = createAdminClient();
    if (admin) {
      await admin
        .from("game_load_requests")
        .update({
          status: "failed",
          error_message: "Replaced by a new account request.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", stuckCreate.id)
        .in("status", ["pending", "processing"]);
    }
  } else if (pending) {
    return {
      error:
        "A request is already in progress. Cancel the stuck item under Recent activity below, then try Replace again.",
    };
  }

  const { data: requestId, error } = await supabase.rpc("request_game_account_create", {
    p_game_slug: input.gameSlug,
    p_game_name: input.gameName,
    p_username: username ?? null,
    p_password: finalPassword ?? password ?? null,
    p_replace: shouldReplace,
  });

  if (error) return { error: playerGameError(error.message, "create_account") };

  const fulfillResult = await fulfillOrFail(input.gameSlug, requestId as string, "create_account", {
    userId: user.id,
    requestedUsername: username,
    requestedPassword: finalPassword,
  });
  if (!fulfillResult?.success) {
    revalidatePath(`/games/${input.gameSlug}`);
    revalidatePath("/admin/game-loads");
    return {
      error: playerGameError(fulfillResult?.error || GAME_API_UNAVAILABLE, "create_account"),
      requestId: requestId as string,
    };
  }

  revalidatePath(`/games/${input.gameSlug}`);
  revalidatePath("/admin/game-loads");

  void notifyAdminOfWalletActivity({
    userId: user.id,
    gameName: input.gameName,
    gameSlug: input.gameSlug,
    kind: "create_account",
    requestId: requestId as string,
  });

  return { success: true, requestId: requestId as string };
}

export async function requestGameCheckBalance(input: {
  gameSlug: string;
  gameName: string;
  gameUsername: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!isWalletLoadEnabledForGame(input.gameSlug)) {
    return { error: "Wallet load is not enabled for this game yet." };
  }
  if (!isGameApiReady(input.gameSlug)) {
    return { error: GAME_API_UNAVAILABLE };
  }

  const gameUsername = await ownedGameUsername(user.id, input.gameSlug);
  if (!gameUsername) return { error: "Account not found" };

  await clearStaleRequests(user.id, input.gameSlug);

  if (API_CONFIGURED_GAMES.includes(input.gameSlug)) {
    const admin = createAdminClient();
    if (admin) {
      const { data: stuck } = await admin
        .from("game_load_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("game_slug", input.gameSlug)
        .eq("load_type", "check_balance")
        .in("status", ["pending", "processing"]);
      for (const row of (stuck ?? []) as { id: string }[]) {
        await admin.rpc("cancel_game_load_service", { p_request_id: row.id });
      }
    }
  }

  const { data: pending } = await supabase
    .from("game_load_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("game_slug", input.gameSlug)
    .in("status", ["pending", "processing"])
    .maybeSingle();

  if (pending) {
    return { error: "You already have a request in progress for this game." };
  }

  const { data: requestId, error } = await supabase.rpc("request_game_check_balance", {
    p_game_slug: input.gameSlug,
    p_game_name: input.gameName,
  });

  if (error) return { error: playerGameError(error.message, "check_balance") };

  const fulfillResult = await fulfillOrFail(input.gameSlug, requestId as string, "check_balance", {
    userId: user.id,
    gameUsername,
  });
  if (!fulfillResult?.success) {
    revalidatePath(`/games/${input.gameSlug}`);
    revalidatePath("/admin/game-loads");
    return {
      error: playerGameError(fulfillResult?.error || GAME_API_UNAVAILABLE, "check_balance"),
      requestId: requestId as string,
    };
  }

  revalidatePath(`/games/${input.gameSlug}`);
  revalidatePath("/admin/game-loads");
  return { success: true, requestId: requestId as string };
}

export async function requestGameLoad(input: {
  gameSlug: string;
  gameName: string;
  amount: number;
  walletType: GameLoadWalletType;
  gameUsername: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { responsibleBlock } = await import("@/lib/responsible/play-guard");
  const blocked = await responsibleBlock(input.amount);
  if (blocked) return { error: blocked };

  if (!isWalletLoadEnabledForGame(input.gameSlug)) {
    return { error: "Wallet load is not enabled for this game yet." };
  }
  if (!isGameApiReady(input.gameSlug)) {
    return { error: GAME_API_UNAVAILABLE };
  }

  const amount = Math.round(input.amount * 100) / 100;
  if (amount < WALLET_LOAD_LIMITS.min || amount > WALLET_LOAD_LIMITS.max) {
    return {
      error: `Amount must be between $${WALLET_LOAD_LIMITS.min} and $${WALLET_LOAD_LIMITS.max}`,
    };
  }

  let gameUsername = await ownedGameUsername(user.id, input.gameSlug);
  if (!gameUsername && input.gameSlug === "fire-kirin") {
    const opened = await provisionFireKirinAccount(user.id);
    if ("error" in opened) return { error: opened.error };
    gameUsername = opened.username;
  }
  if (!gameUsername) return { error: "Account not found" };

  if (input.walletType !== "current") {
    return { error: "Loads must use Total Deposit wallet." };
  }

  await clearStaleRequests(user.id, input.gameSlug);

  const { data: pending } = await supabase
    .from("game_load_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("game_slug", input.gameSlug)
    .in("status", ["pending", "processing"])
    .maybeSingle();

  if (pending) {
    return { error: "You already have a request in progress for this game." };
  }

  const { data: requestId, error } = await supabase.rpc("request_game_load", {
    p_game_slug: input.gameSlug,
    p_game_name: input.gameName,
    p_amount: amount,
    p_wallet_type: "current",
    p_load_type: "load",
  });

  if (error) return { error: playerGameError(error.message, "load") };

  const fulfillResult = await fulfillOrFail(input.gameSlug, requestId as string, "load", {
    userId: user.id,
    gameUsername,
    amount,
  });
  if (!fulfillResult?.success) {
    revalidatePath(`/games/${input.gameSlug}`);
    revalidatePath("/admin/game-loads");
    return {
      error: playerGameError(fulfillResult?.error || GAME_API_UNAVAILABLE, "load"),
      requestId: requestId as string,
    };
  }

  revalidatePath(`/games/${input.gameSlug}`);
  revalidatePath("/dashboard");
  revalidatePath("/admin/game-loads");

  void notifyAdminOfWalletActivity({
    userId: user.id,
    gameName: input.gameName,
    gameSlug: input.gameSlug,
    kind: "load",
    amount,
    walletType: input.walletType,
    requestId: requestId as string,
  });

  return { success: true, requestId: requestId as string };
}

export async function requestGameRedeem(input: {
  gameSlug: string;
  gameName: string;
  amount?: number;
  redeemAll?: boolean;
  gameUsername: string;
  walletType?: GameLoadWalletType;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!isWalletLoadEnabledForGame(input.gameSlug)) {
    return { error: "Wallet load is not enabled for this game yet." };
  }
  if (!isGameApiReady(input.gameSlug)) {
    return { error: GAME_API_UNAVAILABLE };
  }

  const redeemAll = Boolean(input.redeemAll);

  if (!redeemAll) {
    const amount = Math.round((input.amount ?? 0) * 100) / 100;
    if (amount < WALLET_LOAD_LIMITS.min || amount > WALLET_LOAD_LIMITS.max) {
      return {
        error: `Enter $${WALLET_LOAD_LIMITS.min}–$${WALLET_LOAD_LIMITS.max}`,
      };
    }
  }

  const gameUsername = await ownedGameUsername(user.id, input.gameSlug);
  if (!gameUsername) return { error: "Account not found" };

  const walletType = "current" as const;

  const depositRollover = await fetchActiveDepositRolloverForUser(
    supabase,
    user.id,
    input.gameSlug
  );
  const bounds = depositRolloverBounds(depositRollover);

  if (bounds.activeDepositAmount > 0) {
    const lastBalance = await fetchLastGameBalanceForUser(supabase, user.id, input.gameSlug);

    if (lastBalance === null) {
      return {
        error: `Check your live game balance first — you need at least $${bounds.minGameBalance.toFixed(2)} in game (3x your $${bounds.activeDepositAmount.toFixed(2)} deposit) to redeem.`,
      };
    }

    if (lastBalance < bounds.minGameBalance) {
      return {
        error: `Need at least $${bounds.minGameBalance.toFixed(2)} in game (3x your $${bounds.activeDepositAmount.toFixed(2)} deposit). Last checked: $${lastBalance.toFixed(2)}.`,
      };
    }

    if (bounds.maxRedeemRemaining <= 0) {
      return { error: "You have reached the 8x redeem limit for this deposit." };
    }

    if (!redeemAll) {
      const amount = Math.round((input.amount ?? 0) * 100) / 100;
      if (amount > bounds.maxRedeemRemaining) {
        return {
          error: `Maximum redeem is $${bounds.maxRedeemRemaining.toFixed(2)} (8x this deposit minus prior redeems).`,
        };
      }
    }
  } else {
    return { error: "Load credits from Total Deposit into this game before redeeming." };
  }

  await clearStaleRequests(user.id, input.gameSlug);

  const { data: pending } = await supabase
    .from("game_load_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("game_slug", input.gameSlug)
    .in("status", ["pending", "processing"])
    .maybeSingle();

  if (pending) {
    return { error: "You already have a request in progress for this game." };
  }

  const { data: requestId, error } = await supabase.rpc("request_game_redeem", {
    p_game_slug: input.gameSlug,
    p_game_name: input.gameName,
    p_amount: redeemAll ? 0 : input.amount,
    p_redeem_all: redeemAll,
  });

  if (error) return { error: playerGameError(error.message, "redeem") };

  const fulfillResult = await fulfillOrFail(input.gameSlug, requestId as string, "redeem", {
    userId: user.id,
    gameUsername,
    amount: redeemAll ? null : input.amount,
  });
  if (!fulfillResult?.success) {
    revalidatePath(`/games/${input.gameSlug}`);
    revalidatePath("/admin/game-loads");
    return {
      error: playerGameError(fulfillResult?.error || GAME_API_UNAVAILABLE, "redeem"),
      requestId: requestId as string,
    };
  }

  revalidatePath(`/games/${input.gameSlug}`);
  revalidatePath("/dashboard");
  revalidatePath("/admin/game-loads");

  void notifyAdminOfWalletActivity({
    userId: user.id,
    gameName: input.gameName,
    gameSlug: input.gameSlug,
    kind: "redeem",
    amount: redeemAll ? null : input.amount,
    walletType,
    redeemAll,
    requestId: requestId as string,
  });

  return { success: true, requestId: requestId as string };
}

async function fetchActiveDepositRolloverForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  gameSlug: string
) {
  const { data, error } = await supabase.rpc("get_deposit_rollover_totals", {
    p_user_id: userId,
    p_game_slug: gameSlug,
  });

  if (!error && data?.length) {
    const row = data[0] as {
      active_load_amount?: number;
      redeemed_since_active?: number;
      total_loads?: number;
      total_redeemed?: number;
    };
    return {
      activeDepositAmount: Number(
        row.active_load_amount ?? row.total_loads ?? 0
      ),
      redeemedSinceActiveDeposit: Number(
        row.redeemed_since_active ?? row.total_redeemed ?? 0
      ),
    };
  }

  return fetchActiveWalletRolloverFallback(
    supabase,
    userId,
    gameSlug,
    "current",
    DEPOSIT_LOAD_TYPES
  );
}

async function fetchActiveWalletRolloverFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  gameSlug: string,
  walletType: "current" | "bonus",
  loadTypes: readonly string[]
) {
  const { data: latestLoad } = await supabase
    .from("game_load_requests")
    .select("amount, completed_at")
    .eq("user_id", userId)
    .eq("game_slug", gameSlug)
    .eq("wallet_type", walletType)
    .in("load_type", [...loadTypes])
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestLoad) {
    return { activeDepositAmount: 0, redeemedSinceActiveDeposit: 0 };
  }

  let redeemQuery = supabase
    .from("game_load_requests")
    .select("amount")
    .eq("user_id", userId)
    .eq("game_slug", gameSlug)
    .eq("wallet_type", walletType)
    .eq("load_type", "redeem")
    .eq("status", "completed");

  if (latestLoad.completed_at) {
    redeemQuery = redeemQuery.gte("completed_at", latestLoad.completed_at);
  }

  const { data: redeems } = await redeemQuery;

  const sum = (rows: { amount: number }[] | null) =>
    Math.round((rows ?? []).reduce((acc, row) => acc + Number(row.amount ?? 0), 0) * 100) / 100;

  return {
    activeDepositAmount: Math.round(Number(latestLoad.amount ?? 0) * 100) / 100,
    redeemedSinceActiveDeposit: sum(redeems),
  };
}

async function fetchLastGameBalanceForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  gameSlug: string
): Promise<number | null> {
  const { data } = await supabase
    .from("game_load_requests")
    .select("amount")
    .eq("user_id", userId)
    .eq("game_slug", gameSlug)
    .eq("load_type", "check_balance")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return Math.round(Number(data.amount ?? 0) * 100) / 100;
}

export async function getDepositRolloverForGame(
  gameSlug: string
): Promise<DepositRolloverBounds | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const rollover = await fetchActiveDepositRolloverForUser(supabase, user.id, gameSlug);
  return depositRolloverBounds(rollover);
}

export async function getMyGameLoads(gameSlug?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("game_load_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (gameSlug) query = query.eq("game_slug", gameSlug);

  const { data } = await query;
  return data ?? [];
}

export async function getMyGameAccount(gameSlug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("game_load_requests")
    .select("game_username, game_password, status, completed_at")
    .eq("user_id", user.id)
    .eq("game_slug", gameSlug)
    .eq("status", "completed")
    .in("load_type", ["create_account", "new_account"])
    .not("game_username", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

/** Fail pending/processing jobs older than N minutes (frees blocked Replace / Load clicks). */
export async function healStaleGameLoads(gameSlug: string, staleMinutes = 15) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { healed: 0 };

  const { data, error } = await supabase.rpc("fail_my_stale_game_load", {
    p_stale_minutes: staleMinutes,
    p_game_slug: gameSlug,
  });

  if (!error) return { healed: Number(data ?? 0) };

  const admin = createAdminClient();
  if (!admin) return { healed: 0 };

  const now = Date.now();
  const cutoff = new Date(now - staleMinutes * 60 * 1000).toISOString();
  const oldProcessingCutoff = new Date(now - 30 * 60 * 1000).toISOString();

  const { data: oldRows } = await admin
    .from("game_load_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("game_slug", gameSlug)
    .eq("status", "processing")
    .lt("created_at", oldProcessingCutoff);

  const { data: rows } = await admin
    .from("game_load_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("game_slug", gameSlug)
    .in("status", ["pending", "processing"])
    .lt("updated_at", cutoff);

  const ids = new Set<string>();
  for (const row of [...(oldRows ?? []), ...(rows ?? [])] as { id: string }[]) ids.add(row.id);
  for (const id of ids) {
    await finishGameLoad({
      requestId: id,
      success: false,
      errorMessage: "This request timed out. Try again in a few minutes.",
    });
  }

  return { healed: ids.size };
}

export async function cancelMyGameLoad(requestId: string, gameSlug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("cancel_my_game_load", {
    p_request_id: requestId,
  });

  if (!error) {
    revalidatePath(`/games/${gameSlug}`);
    revalidatePath("/admin/game-loads");
    return { success: true };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { error: playerGameError(error.message, "load") };
  }

  const { data: owned } = await admin
    .from("game_load_requests")
    .select("id")
    .eq("id", requestId)
    .eq("user_id", user.id)
    .in("status", ["pending", "processing"])
    .maybeSingle();
  if (!owned) {
    return { error: playerGameError(error.message, "load") };
  }
  const { error: cancelError } = await admin.rpc("cancel_game_load_service", { p_request_id: requestId });
  if (cancelError) {
    return { error: playerGameError(cancelError.message, "load") };
  }

  revalidatePath(`/games/${gameSlug}`);
  revalidatePath("/admin/game-loads");
  return { success: true };
}

export async function getAdminPanelUrlForGame(gameSlug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Unauthorized" };

  if (gameSlug === "juwa") {
    const url = getJuwaAdminPanelUrl();
    if (!url) return { error: "JUWA_ADMIN_URL not configured" };
    return { url };
  }

  if (gameSlug === "vegas-sweeps") {
    const url = getVegasAdminPanelUrl();
    if (!url) return { error: "VEGAS_ADMIN_URL not configured" };
    return { url };
  }

  if (gameSlug === "game-vault") {
    const url = getGameVaultAdminPanelUrl();
    if (!url) return { error: "GAMEVAULT_ADMIN_URL not configured" };
    return { url };
  }

  if (gameSlug === "cash-frenzy") {
    const url = getCashFrenzyAdminPanelUrl();
    if (!url) return { error: "CASHFRENZY_ADMIN_URL not configured" };
    return { url };
  }

  if (gameSlug === "fire-kirin") {
    const url = getFireKirinAdminPanelUrl();
    if (!url) return { error: "FIREKIRIN_ADMIN_URL not configured" };
    return { url };
  }

  if (gameSlug === "vblink") {
    const url = getVblinkAdminPanelUrl();
    if (!url) return { error: "VBLINK_API_URL not configured" };
    return { url };
  }

  return { error: "No admin panel configured for this game" };
}

export async function adminUpdateGameLoadStatus(
  requestId: string,
  status: "completed" | "failed" | "cancelled",
  notes?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Unauthorized" };

  const { data: existing } = await supabase
    .from("game_load_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!existing) return { error: "Request not found" };

  if (status === "cancelled") {
    const admin = createAdminClient();
    const { error } = await (admin ?? supabase).rpc("cancel_game_load_service", { p_request_id: requestId });
    if (error) return { error: "Could not update that request." };
  } else {
    const finished = await finishGameLoad({
      requestId,
      success: status === "completed",
      errorMessage: status === "completed" ? notes ?? null : notes || "Marked failed by staff",
      redeemedAmount: status === "completed" && existing.load_type === "redeem" ? Number(existing.amount) : null,
    });
    if (!finished.ok) return { error: "Could not update that request." };
  }

  if (status === "completed") {
    const isRedeem = existing.load_type === "redeem";
    await createNotification(
      existing.user_id,
      isRedeem ? `${existing.game_name} redeem complete` : `${existing.game_name} load complete`,
      isRedeem
        ? `$${Number(existing.amount).toFixed(2)} was redeemed to your wallet.`
        : `$${Number(existing.amount).toFixed(2)} was loaded to your ${existing.game_name} account.`,
      "success"
    );
  }

  if (status === "failed" || status === "cancelled") {
    await createNotification(
      existing.user_id,
      `${existing.game_name} load update`,
      `Your load request could not be completed. Contact support for help.`,
      "warning"
    );
  }

  revalidatePath("/admin/game-loads");
  return { success: true };
}
