"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/actions/notifications";
import {
  DAILY_SPINS_BY_TIER,
  SPIN_COOLDOWN_MS,
} from "@/lib/spin/prizes";
import {
  resolveSpinPrize,
  startOfUtcDayIso,
  type GlobalSpinStats,
} from "@/lib/spin/prize-engine";
import { creditUserWallet } from "@/lib/actions/wallet";
import { assertFreeplayAllowed } from "@/lib/actions/security";
import { DAILY_SPIN_ENABLED } from "@/lib/constants";

export interface SpinResult {
  success?: boolean;
  error?: string;
  prize?: {
    label: string;
    type: string;
    value: number;
    emoji: string;
    index: number;
  };
  remainingSpins?: number;
  dailyLimit?: number;
  nextFreeSpinMs?: number | null;
}

export interface SpinStatus {
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  nextFreeSpinMs: number | null;
}

function msUntilNextSpin(recentSpinTimes: string[], dailyLimit: number): number | null {
  if (recentSpinTimes.length < dailyLimit) return null;

  const oldestInWindow = new Date(recentSpinTimes[0]).getTime();
  const unlockAt = oldestInWindow + SPIN_COOLDOWN_MS;
  return Math.max(0, unlockAt - Date.now());
}

async function getRecentSpins(userId: string) {
  const supabase = await createClient();
  const windowStart = new Date(Date.now() - SPIN_COOLDOWN_MS).toISOString();

  const { data } = await supabase
    .from("wheel_spins")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: true });

  return data ?? [];
}

async function getGlobalSpinStats(): Promise<GlobalSpinStats> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_wheel_daily_stats").maybeSingle();

  if (error || !data) {
    const dayStart = startOfUtcDayIso();
    const [spinsRes, tenRes, twentyRes, smallRes] = await Promise.all([
      supabase
        .from("wheel_spins")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dayStart),
      supabase
        .from("wheel_spins")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dayStart)
        .eq("prize_value", 10),
      supabase
        .from("wheel_spins")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dayStart)
        .eq("prize_value", 7),
      supabase
        .from("wheel_spins")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dayStart)
        .eq("prize_type", "cash")
        .gte("prize_value", 1)
        .lte("prize_value", 4),
    ]);

    return {
      spinsToday: spinsRes.count ?? 0,
      tenDollarWinners: tenRes.count ?? 0,
      twentyDollarWinners: twentyRes.count ?? 0,
      smallCashWinners: smallRes.count ?? 0,
    };
  }

  const row = data as {
    spins_today: number;
    ten_dollar_winners: number;
    twenty_dollar_winners: number;
    small_cash_winners: number;
  };

  return {
    spinsToday: Number(row.spins_today ?? 0),
    tenDollarWinners: Number(row.ten_dollar_winners ?? 0),
    twentyDollarWinners: Number(row.twenty_dollar_winners ?? 0),
    smallCashWinners: Number(row.small_cash_winners ?? 0),
  };
}

export async function getSpinStatus(): Promise<SpinStatus | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("vip_tier")
    .eq("id", user.id)
    .single();

  const dailyLimit = DAILY_SPINS_BY_TIER[profile?.vip_tier || "bronze"] || 1;
  const recentSpins = await getRecentSpins(user.id);
  const usedToday = recentSpins.length;
  const remaining = Math.max(0, dailyLimit - usedToday);
  const nextFreeSpinMs =
    remaining === 0
      ? msUntilNextSpin(
          recentSpins.map((s) => s.created_at),
          dailyLimit
        )
      : null;

  return { dailyLimit, usedToday, remaining, nextFreeSpinMs };
}

export async function spinWheel(): Promise<SpinResult> {
  if (!DAILY_SPIN_ENABLED) {
    return { error: "Daily Spin is coming soon. Check back later!" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in to spin" };

  const freeplay = await assertFreeplayAllowed();
  if (!freeplay.ok) return { error: freeplay.error };

  const status = await getSpinStatus();
  if ("error" in status) return { error: status.error };

  if (status.remaining <= 0) {
    const hoursLeft = status.nextFreeSpinMs
      ? Math.ceil(status.nextFreeSpinMs / (60 * 60 * 1000))
      : 24;
    return {
      error: `No spins left. Your next free spin unlocks in about ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}.`,
    };
  }

  const globalStats = await getGlobalSpinStats();
  const { prize, index } = resolveSpinPrize(globalStats);

  const { error } = await supabase.from("wheel_spins").insert({
    user_id: user.id,
    prize_label: prize.label,
    prize_type: prize.type,
    prize_value: prize.value,
  });

  if (error) {
    const msg = error.message ?? String(error);
    console.error("[spinWheel] wheel_spins insert failed:", msg, error.code, error.details);

    if (/relation .*wheel_spins.* does not exist/i.test(msg) || error.code === "42P01") {
      return {
        error:
          "Wheel table missing. In Supabase SQL Editor run the full file: supabase/wheel-spins-patch.sql (not spin_history migration).",
      };
    }
    if (/wheel_spins_prize_type_check|check constraint/i.test(msg)) {
      return {
        error:
          "Wheel schema outdated (missing points prize type). Run supabase/wheel-spins-patch.sql in Supabase SQL Editor.",
      };
    }
    if (/permission denied|42501|row-level security/i.test(msg)) {
      return {
        error:
          "Wheel permission denied. Run supabase/wheel-spins-patch.sql to fix RLS grants, then hard-refresh and spin again.",
      };
    }
    if (/foreign key|profiles/i.test(msg)) {
      return {
        error:
          "Your profile row is missing in Supabase. Log out and back in, or ask support to sync your profile.",
      };
    }
    if (msg.includes("wheel_spins")) {
      return { error: `Wheel error: ${msg}. Run supabase/wheel-spins-patch.sql if you have not yet.` };
    }
    return { error: msg };
  }

  if (prize.type === "cash" && prize.value > 0) {
    const pointsToAdd = prize.value * 10;
    const { data: profile } = await supabase
      .from("profiles")
      .select("vip_points")
      .eq("id", user.id)
      .single();

    if (profile) {
      await supabase
        .from("profiles")
        .update({ vip_points: profile.vip_points + pointsToAdd })
        .eq("id", user.id);
    }

    await creditUserWallet(
      user.id,
      prize.value,
      "current",
      "spin",
      `Wheel prize: ${prize.label}`
    );

    await createNotification(
      user.id,
      "Wheel Prize Won!",
      `You won ${prize.label}! $${prize.value} added to your Total Deposit and +${pointsToAdd} VIP points.`,
      "success"
    );
  } else if (prize.type === "points" && prize.value > 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("vip_points")
      .eq("id", user.id)
      .single();

    if (profile) {
      await supabase
        .from("profiles")
        .update({ vip_points: profile.vip_points + prize.value })
        .eq("id", user.id);
    }

    await createNotification(
      user.id,
      "VIP Points Won!",
      `You won ${prize.label}! +${prize.value} VIP points added to your account.`,
      "success"
    );
  }

  revalidatePath("/spin");
  revalidatePath("/dashboard");

  const newRemaining = status.remaining - 1;
  const nextFreeSpinMs = newRemaining <= 0 ? SPIN_COOLDOWN_MS : null;

  return {
    success: true,
    prize: {
      label: prize.label,
      type: prize.type,
      value: prize.value,
      emoji: prize.emoji,
      index,
    },
    remainingSpins: newRemaining,
    dailyLimit: status.dailyLimit,
    nextFreeSpinMs,
  };
}

export async function getSpinHistory() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("wheel_spins")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return data || [];
}
