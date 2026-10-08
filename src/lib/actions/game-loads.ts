"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/actions/notifications";
import { notifyAdminOfWalletActivity } from "@/lib/telegram/notify-admin-wallet-activity";
import { getJuwaAdminPanelUrl, getVegasAdminPanelUrl, getGameVaultAdminPanelUrl, getCashFrenzyAdminPanelUrl, getFireKirinAdminPanelUrl, isWalletLoadEnabledForGame, WALLET_LOAD_LIMITS } from "@/lib/game-automation/config";
import { validateCustomGameAccountCredentials } from "@/lib/game-automation/account-username";
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
import { autoFulfillFireKirinRequest } from "@/lib/game-automation/firekirin-service";
import { isFireKirinApiConfigured } from "@/lib/game-automation/firekirin-api";
import { autoFulfillJuwaRequest } from "@/lib/game-automation/juwa-service";
import { isJuwaApiConfigured } from "@/lib/game-automation/juwa-api";
import { autoFulfillVegasRequest } from "@/lib/game-automation/vegas-service";
import { isVegasApiConfigured } from "@/lib/game-automation/vegas-api";
import { userFacingGameLoadError } from "@/lib/game-automation/user-facing-errors";
import { usernameForOwner } from "@/lib/games/owned-account";

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
    return await autoFulfillGameRequest(gameSlug, requestId, loadType, input);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Game request failed";
    console.error("[game-loads] fulfill threw", message);
    const admin = createAdminClient();
    if (admin) {
      const { data } = await admin
        .from("game_load_requests")
        .update({
          status: "failed",
          error_message: message.slice(0, 400),
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .in("status", ["pending", "processing"])
        .select("id");
      if (data?.length && (loadType === "load" || loadType === "reload")) {
        await admin.rpc("refund_game_load_wallet", { p_request_id: requestId });
      }
    }
    return { success: false as const, error: message };
  }
}

export async function fulfillTrackedRequest(requestId: string) {
  const admin = createAdminClient();
  if (!admin) return { success: false as const, error: "SUPABASE_SERVICE_ROLE_KEY is not configured." };
  const { data } = await admin
    .from("game_load_requests")
    .select("id, user_id, game_slug, game_name, amount, load_type, game_username, status")
    .eq("id", requestId)
    .maybeSingle();
  const row = data as {
    id: string;
    user_id: string;
    game_slug: string;
    amount: number | null;
    load_type: "create_account" | "new_account" | "load" | "reload";
    game_username: string | null;
    status: string;
  } | null;
  if (!row) return { success: false as const, error: "Load request not found." };
  if (row.status === "completed") return { success: true as const };
  const result = await fulfillOrFail(row.game_slug, row.id, row.load_type, {
    userId: row.user_id,
    gameUsername: row.game_username,
    amount: row.amount,
    requestedUsername: row.game_username,
  });
  if (!result) {
    await admin
      .from("game_load_requests")
      .update({
        status: "failed",
        error_message: "Game API credentials are not configured.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .in("status", ["pending", "processing"]);
    if (row.load_type === "reload" || row.load_type === "load") {
      await admin.rpc("refund_game_load_wallet", { p_request_id: row.id });
    }
    return { success: false as const, error: "Game API credentials are not configured." };
  }
  return result.success
    ? { success: true as const }
    : { success: false as const, error: result.error || "Game load failed." };
}

const API_CONFIGURED_GAMES = ["cash-machine", "cash-frenzy", "gameroom", "game-vault", "mafia", "juwa", "vegas-sweeps", "mr-all-in-one", "orion-stars", "milky-way", "fire-kirin"];

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
): Promise<{ success: boolean; error?: string } | null> {
  if (gameSlug === "juwa" && isJuwaApiConfigured()) {
    const targetAccount = input.gameUsername || input.requestedUsername || `juwa_${input.userId.slice(0, 8)}`;
    const mapType = loadType === "new_account" ? "create_account" : loadType === "reload" ? "load" : loadType;
    const res = await autoFulfillJuwaRequest({
      requestId,
      gameSlug,
      loadType: mapType as any,
      accountName: targetAccount,
      password: input.requestedPassword || undefined,
      amount: input.amount || 0,
    });
    return { success: res.success, error: res.success ? undefined : res.message };
  }
  if (gameSlug === "vegas-sweeps" && isVegasApiConfigured()) {
    const targetAccount = input.gameUsername || input.requestedUsername || `vegas_${input.userId.slice(0, 8)}`;
    const mapType = loadType === "new_account" ? "create_account" : loadType === "reload" ? "load" : loadType;
    const res = await autoFulfillVegasRequest({
      requestId,
      gameSlug,
      loadType: mapType as any,
      accountName: targetAccount,
      password: input.requestedPassword || undefined,
      amount: input.amount || 0,
    });
    return { success: res.success, error: res.success ? undefined : res.message };
  }
  if (gameSlug === "cash-machine" && isCashMachineApiConfigured()) {
    return autoFulfillCashMachineRequest(requestId, loadType, input);
  }
  if (gameSlug === "cash-frenzy" && isCashFrenzyApiConfigured()) {
    return autoFulfillCashFrenzyRequest(requestId, loadType, input);
  }
  if (gameSlug === "gameroom" && isGameroomApiConfigured()) {
    return autoFulfillGameroomRequest(requestId, loadType, input);
  }
  if (gameSlug === "mr-all-in-one" && isMrAllInOneApiConfigured()) {
    return autoFulfillMrAllInOneRequest(requestId, loadType, input);
  }
  if (gameSlug === "game-vault" && isGameVaultApiConfigured()) {
    return autoFulfillGameVaultRequest(requestId, loadType, input);
  }
  if (gameSlug === "mafia" && isMafiaApiConfigured()) {
    return autoFulfillMafiaRequest(requestId, loadType, input);
  }
  if (gameSlug === "orion-stars" && isOrionStarsApiConfigured()) {
    const targetAccount = input.gameUsername || input.requestedUsername || `os_${input.userId.slice(0, 8)}`;
    const mapType = loadType === "new_account" ? "create_account" : loadType === "reload" ? "load" : loadType;
    const res = await autoFulfillOrionStarsRequest({
      requestId,
      gameSlug,
      loadType: mapType as any,
      accountName: targetAccount,
      password: input.requestedPassword || undefined,
      amount: input.amount || 0,
    });
    return { success: res.success, error: res.success ? undefined : res.message };
  }
  if (gameSlug === "milky-way" && isMilkyWayApiConfigured()) {
    const targetAccount = input.gameUsername || input.requestedUsername || `mw_${input.userId.slice(0, 8)}`;
    const mapType = loadType === "new_account" ? "create_account" : loadType === "reload" ? "load" : loadType;
    const res = await autoFulfillMilkyWayRequest({
      requestId,
      gameSlug,
      loadType: mapType as any,
      accountName: targetAccount,
      password: input.requestedPassword || undefined,
      amount: input.amount || 0,
    });
    return { success: res.success, error: res.success ? undefined : res.message };
  }
  if (gameSlug === "fire-kirin" && isFireKirinApiConfigured()) {
    const targetAccount = input.gameUsername || input.requestedUsername || `fk_${input.userId.slice(0, 8)}`;
    const mapType = loadType === "new_account" ? "create_account" : loadType === "reload" ? "load" : loadType;
    const res = await autoFulfillFireKirinRequest({
      requestId,
      gameSlug,
      loadType: mapType as any,
      accountName: targetAccount,
      password: input.requestedPassword || undefined,
      amount: input.amount || 0,
    });
    return { success: res.success, error: res.success ? undefined : res.message };
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
  }

  const { data: pending } = await supabase
    .from("game_load_requests")
    .select("id, load_type")
    .eq("user_id", user.id)
    .eq("game_slug", input.gameSlug)
    .in("status", ["pending", "processing"])
    .maybeSingle();

  if (pending) {
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

  if (API_CONFIGURED_GAMES.includes(input.gameSlug)) {
    const admin = createAdminClient();
    if (admin) {
      await admin
        .from("game_load_requests")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("game_slug", input.gameSlug)
        .eq("load_type", "check_balance")
        .in("status", ["pending", "processing"]);
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

  const gameUsername = await ownedGameUsername(user.id, input.gameSlug);
  if (!gameUsername) return { error: "Account not found" };

  if (input.walletType !== "current") {
    return { error: "Loads must use Total Deposit wallet." };
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
    .update({
      status: "failed",
      error_message: "This request timed out before it finished. Try again.",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("game_slug", gameSlug)
    .eq("status", "processing")
    .lt("created_at", oldProcessingCutoff)
    .select("id");

  const { data: rows } = await admin
    .from("game_load_requests")
    .update({
      status: "failed",
      error_message: "This request timed out. Try again in a few minutes.",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("game_slug", gameSlug)
    .in("status", ["pending", "processing"])
    .lt("updated_at", cutoff)
    .select("id");

  return { healed: (rows?.length ?? 0) + (oldRows?.length ?? 0) };
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

  const { data: rows, error: updErr } = await admin
    .from("game_load_requests")
    .update({
      status: "cancelled",
      error_message: "Cancelled — you can start a new request.",
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("user_id", user.id)
    .in("status", ["pending", "processing"])
    .select("id");

  if (updErr || !rows?.length) {
    return { error: playerGameError(updErr?.message ?? "Request not found or already finished", "load") };
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

  const { error } = await supabase
    .from("game_load_requests")
    .update({
      status,
      admin_notes: notes ?? existing.admin_notes,
      completed_at: status === "completed" ? new Date().toISOString() : existing.completed_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) return { error: "Could not update that request." };

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
