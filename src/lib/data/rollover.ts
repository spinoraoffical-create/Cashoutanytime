import "server-only";

import { BONUS_WAGER_RULES } from "@/lib/constants";
import { depositRolloverBounds } from "@/lib/wallet/deposit-redeem-rollover";
import { bonusRolloverBounds } from "@/lib/wallet/bonus-redeem-rollover";
import { requireUser } from "@/lib/data/dashboard";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type RolloverProgress = {
  gameSlug: string;
  gameName: string;
  bonusAmount: number;
  wageredAmount: number;
  requiredWager: number;
  percentComplete: number;
  maxCashoutRemaining: number;
  maxCashoutCap: number;
  cashoutUnlocked: boolean;
};

const BONUS_LOAD_TYPES = ["load", "reload"] as const;

/** Most recent active bonus load + wager progress toward cashout unlock. */
export async function getActiveRolloverProgress(): Promise<RolloverProgress | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { supabase, user } = await requireUser();

    const { data: latestBonusLoad } = await supabase
      .from("game_load_requests")
      .select("game_slug, amount, completed_at")
      .eq("user_id", user.id)
      .eq("wallet_type", "bonus")
      .in("load_type", [...BONUS_LOAD_TYPES])
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestBonusLoad?.game_slug) return null;

    const bonusAmount = Math.round(Number(latestBonusLoad.amount ?? 0) * 100) / 100;
    if (bonusAmount <= 0) return null;

    let redeemQuery = supabase
      .from("game_load_requests")
      .select("amount")
      .eq("user_id", user.id)
      .eq("game_slug", latestBonusLoad.game_slug)
      .eq("wallet_type", "bonus")
      .eq("load_type", "redeem")
      .eq("status", "completed");

    if (latestBonusLoad.completed_at) {
      redeemQuery = redeemQuery.gte("completed_at", latestBonusLoad.completed_at);
    }

    const [{ data: redeems }, { data: balanceRow }, { data: gameRow }] = await Promise.all([
      redeemQuery,
      supabase
        .from("game_load_requests")
        .select("amount")
        .eq("user_id", user.id)
        .eq("game_slug", latestBonusLoad.game_slug)
        .eq("load_type", "check_balance")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("games")
        .select("name")
        .eq("slug", latestBonusLoad.game_slug)
        .maybeSingle(),
    ]);

    const redeemedSince = Math.round(
      (redeems ?? []).reduce((acc, r) => acc + Number(r.amount ?? 0), 0) * 100
    ) / 100;

    const bounds = bonusRolloverBounds({
      activeBonusLoadAmount: bonusAmount,
      redeemedSinceActiveBonusLoad: redeemedSince,
    });

    const lastBalance = balanceRow ? Math.round(Number(balanceRow.amount ?? 0) * 100) / 100 : 0;
    const requiredWager = Math.round(bonusAmount * BONUS_WAGER_RULES.rolloverMultiplier * 100) / 100;
    const wageredAmount = Math.min(Math.max(lastBalance, 0), requiredWager);
    const percentComplete =
      requiredWager > 0 ? Math.min(100, Math.round((wageredAmount / requiredWager) * 100)) : 0;
    const maxCashoutCap = Math.round(bonusAmount * BONUS_WAGER_RULES.maxCashoutMultiplier * 100) / 100;

    return {
      gameSlug: latestBonusLoad.game_slug,
      gameName: gameRow?.name ?? latestBonusLoad.game_slug,
      bonusAmount,
      wageredAmount,
      requiredWager,
      percentComplete,
      maxCashoutRemaining: bounds.maxRedeemRemaining,
      maxCashoutCap,
      cashoutUnlocked: lastBalance >= bounds.minGameBalance,
    };
  } catch {
    return null;
  }
}

/** Deposit-wallet rollover summary (fallback when no bonus load). */
export async function getDepositRolloverProgress(): Promise<RolloverProgress | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { supabase, user } = await requireUser();

    const { data: latestLoad } = await supabase
      .from("game_load_requests")
      .select("game_slug, amount, completed_at")
      .eq("user_id", user.id)
      .eq("wallet_type", "current")
      .in("load_type", [...BONUS_LOAD_TYPES])
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestLoad?.game_slug) return null;

    const depositAmount = Math.round(Number(latestLoad.amount ?? 0) * 100) / 100;
    if (depositAmount <= 0) return null;

    let redeemQuery = supabase
      .from("game_load_requests")
      .select("amount")
      .eq("user_id", user.id)
      .eq("game_slug", latestLoad.game_slug)
      .eq("wallet_type", "current")
      .eq("load_type", "redeem")
      .eq("status", "completed");

    if (latestLoad.completed_at) {
      redeemQuery = redeemQuery.gte("completed_at", latestLoad.completed_at);
    }

    const [{ data: redeems }, { data: balanceRow }, { data: gameRow }] = await Promise.all([
      redeemQuery,
      supabase
        .from("game_load_requests")
        .select("amount")
        .eq("user_id", user.id)
        .eq("game_slug", latestLoad.game_slug)
        .eq("load_type", "check_balance")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("games")
        .select("name")
        .eq("slug", latestLoad.game_slug)
        .maybeSingle(),
    ]);

    const redeemedSince = Math.round(
      (redeems ?? []).reduce((acc, r) => acc + Number(r.amount ?? 0), 0) * 100
    ) / 100;

    const bounds = depositRolloverBounds({
      activeDepositAmount: depositAmount,
      redeemedSinceActiveDeposit: redeemedSince,
    });

    const lastBalance = balanceRow ? Math.round(Number(balanceRow.amount ?? 0) * 100) / 100 : 0;
    const requiredWager = bounds.minGameBalance;
    const wageredAmount = Math.min(Math.max(lastBalance, 0), requiredWager);
    const percentComplete =
      requiredWager > 0 ? Math.min(100, Math.round((wageredAmount / requiredWager) * 100)) : 0;

    return {
      gameSlug: latestLoad.game_slug,
      gameName: gameRow?.name ?? latestLoad.game_slug,
      bonusAmount: depositAmount,
      wageredAmount,
      requiredWager,
      percentComplete,
      maxCashoutRemaining: bounds.maxRedeemRemaining,
      maxCashoutCap: Math.round(depositAmount * BONUS_WAGER_RULES.maxCashoutMultiplier * 100) / 100,
      cashoutUnlocked: lastBalance >= bounds.minGameBalance,
    };
  } catch {
    return null;
  }
}

export async function getDashboardRollover(): Promise<RolloverProgress | null> {
  const bonus = await getActiveRolloverProgress();
  if (bonus) return bonus;
  return getDepositRolloverProgress();
}
