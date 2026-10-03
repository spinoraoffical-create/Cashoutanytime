"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/actions/notifications";
import { notifyAdminOfWalletActivity } from "@/lib/telegram/notify-admin-wallet-activity";
import { getJuwaAdminPanelUrl, getVegasAdminPanelUrl, getGameVaultAdminPanelUrl, getCashFrenzyAdminPanelUrl, isWalletLoadEnabledForGame, WALLET_LOAD_LIMITS } from "@/lib/game-automation/config";
import { validateCustomGameAccountCredentials } from "@/lib/game-automation/account-username";
import type { GameLoadWalletType } from "@/lib/game-automation/types";
import {
  depositRolloverBounds,
  DEPOSIT_LOAD_TYPES,
  type DepositRolloverBounds,
} from "@/lib/wallet/deposit-redeem-rollover";

function isMissingRpcError(message: string): boolean {
  return /could not find the function|schema cache|function.*does not exist/i.test(message);
}

/** Queue a wallet load when Supabase RPC is missing/outdated (bot still picks up pending rows). */
async function queueGameLoadAdminFallback(
  userId: string,
  input: { gameSlug: string; gameName: string; amount: number; gameUsername: string }
): Promise<{ requestId: string } | { error: string }> {
  const admin = createAdminClient();
  if (!admin) return { error: "Server configuration error — contact support." };

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("wallet_balance")
    .eq("id", userId)
    .single();

  if (profileErr || !profile) {
    return { error: profileErr?.message ?? "Could not read wallet balance." };
  }

  const balance = Number(profile.wallet_balance ?? 0);
  if (balance < input.amount) {
    return { error: "Insufficient wallet balance" };
  }

  const newBalance = Math.round((balance - input.amount) * 100) / 100;
  const { error: updErr } = await admin
    .from("profiles")
    .update({ wallet_balance: newBalance })
    .eq("id", userId);

  if (updErr) return { error: updErr.message };

  const { error: txErr } = await admin.from("wallet_transactions").insert({
    user_id: userId,
    amount: input.amount,
    wallet_type: "current",
    transaction_type: "debit",
    source: "game_load",
    description: `Load $${input.amount.toFixed(2)} to ${input.gameName}`,
    created_by: userId,
  });
  if (txErr) {
    console.warn("[queueGameLoadAdminFallback] wallet_transactions insert skipped:", txErr.message);
  }

  const { data: row, error: insErr } = await admin
    .from("game_load_requests")
    .insert({
      user_id: userId,
      game_slug: input.gameSlug,
      game_name: input.gameName,
      amount: input.amount,
      wallet_type: "current",
      load_type: "load",
      game_username: input.gameUsername.trim(),
      status: "pending",
    })
    .select("id")
    .single();

  if (insErr || !row?.id) {
    await admin
      .from("profiles")
      .update({ wallet_balance: balance })
      .eq("id", userId);
    return { error: insErr?.message ?? "Could not queue load for bot." };
  }

  return { requestId: row.id as string };
}

/** Queue redeem when RPC missing (no wallet debit — bot pulls from game panel). */
async function queueGameRedeemAdminFallback(
  userId: string,
  input: {
    gameSlug: string;
    gameName: string;
    amount: number;
    gameUsername: string;
    redeemAll: boolean;
  }
): Promise<{ requestId: string } | { error: string }> {
  const admin = createAdminClient();
  if (!admin) return { error: "Server configuration error — contact support." };

  const { data: pending } = await admin
    .from("game_load_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("game_slug", input.gameSlug)
    .in("load_type", ["load", "reload", "redeem"])
    .in("status", ["pending", "processing"])
    .maybeSingle();

  if (pending) {
    return { error: "You already have a request in progress for this game." };
  }

  const { data: row, error: insErr } = await admin
    .from("game_load_requests")
    .insert({
      user_id: userId,
      game_slug: input.gameSlug,
      game_name: input.gameName,
      amount: input.redeemAll ? 0 : input.amount,
      wallet_type: "current",
      load_type: "redeem",
      game_username: input.gameUsername.trim(),
      redeem_all: input.redeemAll,
      status: "pending",
    })
    .select("id")
    .single();

  if (insErr || !row?.id) {
    if (/redeem_all|schema cache|does not exist/i.test(insErr?.message ?? "")) {
      return {
        error:
          "Redeem database not set up. Admin: run supabase/migrations/20260720000400_game_redeem_fix.sql in Supabase SQL Editor.",
      };
    }
    return { error: insErr?.message ?? "Could not queue redeem for bot." };
  }

  return { requestId: row.id as string };
}

export async function requestGameAccountCreate(input: {
  gameSlug: string;
  gameName: string;
  username?: string;
  password?: string;
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

  const existing = await getMyGameAccount(input.gameSlug);
  const hasAccount = Boolean(existing?.game_username);

  if (hasAccount && !input.replaceAccount) {
    return {
      error: "You already have a game account. Use Replace Account to get new login details.",
    };
  }

  if (!hasAccount && input.replaceAccount) {
    return { error: "No account to replace yet. Create your first account instead." };
  }

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

  // Fast non-blocking RPC call with instant fallback
  try {
    const { data: requestId, error } = await supabase.rpc("request_game_account_create", {
      p_game_slug: input.gameSlug,
      p_game_name: input.gameName,
      p_username: username ?? null,
      p_password: finalPassword ?? password ?? null,
      p_replace: input.replaceAccount ?? false,
    });

    if (!error && requestId) {
      revalidatePath(`/games/${input.gameSlug}`);
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/games");
      revalidatePath("/");
      revalidatePath("/admin/game-loads");
      return { success: true, requestId: requestId as string };
    }
    if (error) {
      return { error: error.message };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not queue account request";
    return { error: message };
  }

  // Queue for bot worker — do not fake completed credentials
  const admin = createAdminClient();
  if (admin) {
    const { data: directInsert, error: insertError } = await admin
      .from("game_load_requests")
      .insert({
        user_id: user.id,
        game_slug: input.gameSlug,
        game_name: input.gameName,
        game_username: username ?? null,
        game_password: finalPassword ?? password ?? null,
        load_type: "create_account",
        status: "pending",
        amount: 0,
      })
      .select("id")
      .single();

    if (insertError) {
      return { error: insertError.message };
    }

    revalidatePath(`/games/${input.gameSlug}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/games");
    revalidatePath("/admin/game-loads");

    return { success: true, requestId: directInsert?.id || "" };
  }

  return { error: "Could not queue account creation. Run request_game_account_create migration in Supabase." };
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

  if (!input.gameUsername?.trim()) {
    return { error: "Create your game account first." };
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
    p_game_username: input.gameUsername.trim(),
  });

  if (error) {
    if (error.message.includes("request_game_check_balance")) {
      return { error: "Run supabase/redeem-wallets-and-balance-check.sql in Supabase SQL Editor first." };
    }
    return { error: error.message };
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

  if (!isWalletLoadEnabledForGame(input.gameSlug)) {
    return { error: "Wallet load is not enabled for this game yet." };
  }

  const amount = Math.round(input.amount * 100) / 100;
  if (amount < WALLET_LOAD_LIMITS.min || amount > WALLET_LOAD_LIMITS.max) {
    return {
      error: `Amount must be between $${WALLET_LOAD_LIMITS.min} and $${WALLET_LOAD_LIMITS.max}`,
    };
  }

  if (!input.gameUsername?.trim()) {
    return { error: "Create your game account first." };
  }

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

  // Queue load for bot worker (status stays pending until bot completes)
  let requestId: string | null = null;

  const rpcArgs = {
    p_game_slug: input.gameSlug,
    p_game_name: input.gameName,
    p_amount: amount,
    p_wallet_type: "current" as const,
    p_load_type: "load" as const,
    p_game_username: input.gameUsername.trim(),
  };

  try {
    const { data: rpcId, error } = await supabase.rpc("request_game_load", rpcArgs);

    if (!error && rpcId) {
      requestId = rpcId as string;
    } else if (error) {
      const msg = error.message ?? "";

      if (msg.includes("Invalid load type") || isMissingRpcError(msg)) {
        const legacy = await supabase.rpc("request_game_load", {
          p_game_slug: input.gameSlug,
          p_game_name: input.gameName,
          p_amount: amount,
          p_load_type: "reload",
          p_game_username: input.gameUsername.trim(),
        });
        if (!legacy.error && legacy.data) {
          requestId = legacy.data as string;
        }
      }

      if (!requestId && isMissingRpcError(msg)) {
        const fallback = await queueGameLoadAdminFallback(user.id, {
          gameSlug: input.gameSlug,
          gameName: input.gameName,
          amount,
          gameUsername: input.gameUsername.trim(),
        });
        if ("requestId" in fallback) {
          requestId = fallback.requestId;
        } else {
          return { error: fallback.error };
        }
      } else if (!requestId) {
        return { error: msg };
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not queue load request";
    if (isMissingRpcError(message)) {
      const fallback = await queueGameLoadAdminFallback(user.id, {
        gameSlug: input.gameSlug,
        gameName: input.gameName,
        amount,
        gameUsername: input.gameUsername.trim(),
      });
      if ("requestId" in fallback) {
        requestId = fallback.requestId;
      } else {
        return { error: fallback.error };
      }
    } else {
      return { error: message };
    }
  }

  if (!requestId) {
    const fallback = await queueGameLoadAdminFallback(user.id, {
      gameSlug: input.gameSlug,
      gameName: input.gameName,
      amount,
      gameUsername: input.gameUsername.trim(),
    });
    if ("requestId" in fallback) {
      requestId = fallback.requestId;
    } else {
      return {
        error:
          fallback.error +
          " — also run supabase/migrations/20260720000200_game_load_rpc_fix.sql in Supabase SQL Editor.",
      };
    }
  }

  revalidatePath(`/games/${input.gameSlug}`);
  revalidatePath("/dashboard");
    revalidatePath("/dashboard/games");
  revalidatePath("/admin/game-loads");

  await notifyAdminOfWalletActivity({
    userId: user.id,
    gameName: input.gameName,
    gameSlug: input.gameSlug,
    kind: "load",
    amount,
    walletType: input.walletType,
    requestId,
  });

  return { success: true, requestId };
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("kyc_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.kyc_status !== "verified") {
    if (profile?.kyc_status === "pending") {
      return {
        error:
          "🛡️ KYC under review — admin must approve your ID before you can redeem. Usually 5–15 minutes.",
      };
    }
    return {
      error:
        "🛡️ KYC Verification Required! Upload your government ID at Dashboard → KYC before redeeming.",
    };
  }

  if (!isWalletLoadEnabledForGame(input.gameSlug)) {
    return { error: "Wallet load is not enabled for this game yet." };
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

  if (!input.gameUsername?.trim()) {
    return { error: "Create your game account first." };
  }

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
    .in("load_type", ["load", "reload", "redeem"])
    .in("status", ["pending", "processing"])
    .maybeSingle();

  if (pending) {
    return { error: "You already have a load or redeem in progress for this game." };
  }

  let requestId: string | null = null;

  const redeemAmount = redeemAll ? 0 : Math.round((input.amount ?? 0) * 100) / 100;

  // Prefer service-role insert — avoids RPC/schema drift breaking redeems
  const fallback = await queueGameRedeemAdminFallback(user.id, {
    gameSlug: input.gameSlug,
    gameName: input.gameName,
    amount: redeemAmount,
    gameUsername: input.gameUsername.trim(),
    redeemAll,
  });

  if ("error" in fallback) {
    const { data: rpcId, error: rpcError } = await supabase.rpc("request_game_redeem", {
      p_game_slug: input.gameSlug,
      p_game_name: input.gameName,
      p_amount: redeemAmount,
      p_game_username: input.gameUsername.trim(),
      p_redeem_all: redeemAll,
    });

    if (rpcError) {
      return { error: rpcError.message || fallback.error };
    }
    if (!rpcId) {
      return { error: fallback.error || "Could not queue redeem request." };
    }
    requestId = rpcId as string;
  } else {
    requestId = fallback.requestId;
  }

  revalidatePath(`/games/${input.gameSlug}`);
  revalidatePath("/dashboard");
    revalidatePath("/dashboard/games");
  revalidatePath("/admin/game-loads");
  revalidatePath("/admin/payouts");
  revalidatePath("/dashboard/wallet");

  await notifyAdminOfWalletActivity({
    userId: user.id,
    gameName: input.gameName,
    gameSlug: input.gameSlug,
    kind: "redeem",
    amount: redeemAll ? null : input.amount,
    walletType,
    redeemAll,
    requestId,
  });

  return { success: true, requestId };
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
    .limit(20);

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

  const { data: game } = await supabase
    .from("games")
    .select("id")
    .eq("slug", gameSlug)
    .maybeSingle();

  if (game) {
    const { data: account } = await supabase
      .from("game_accounts")
      .select("game_username, game_password, credits_balance, last_synced_at, updated_at")
      .eq("user_id", user.id)
      .eq("game_id", game.id)
      .maybeSingle();

    if (account?.game_username) {
      return {
        game_username: account.game_username,
        game_password: account.game_password ?? null,
        status: "completed" as const,
        completed_at: account.last_synced_at ?? account.updated_at,
        created_at: account.updated_at,
      };
    }
  }

  const { data } = await supabase
    .from("game_load_requests")
    .select("game_username, game_password, status, completed_at, created_at")
    .eq("user_id", user.id)
    .eq("game_slug", gameSlug)
    .eq("status", "completed")
    .not("game_username", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function healStaleGameLoads(gameSlug: string, staleMinutes = 15) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { healed: 0 };

  const { data, error } = await supabase.rpc("fail_stale_game_loads", {
    p_stale_minutes: staleMinutes,
    p_user_id: user.id,
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
      error_message:
        "This request got stuck (bot did not finish). Refresh, then click Replace Account again.",
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
      error_message:
        "Timed out waiting for the game bot. Restart the bot on your PC, then try Replace again.",
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
    return {
      error:
        error.message.includes("cancel_my_game_load")
          ? "Run supabase/stale-game-load-recovery.sql in Supabase, or ask admin to cancel the stuck job."
          : error.message,
    };
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
    return { error: updErr?.message ?? "Request not found or already finished" };
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

  if (error) return { error: error.message };

  if (status === "completed") {
    const isRedeem = existing.load_type === "redeem";
    await createNotification(
      existing.user_id,
      isRedeem ? `${existing.game_name} redeem complete` : `${existing.game_name} load complete`,
      isRedeem
        ? `$${Number(existing.amount).toFixed(2)} was redeemed to your Spinora wallet.`
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
