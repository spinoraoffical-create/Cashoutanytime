"use server";

import { revalidatePath } from "next/cache";

import { adminDb, authorize } from "@/lib/actions/admin/core";
import { BOTH_CLAIM_SWITCHES_ERROR, claimSwitchSave } from "@/lib/rewards/loyalty-coins";

async function requireRewards() {
  const auth = await authorize("rewards.manage");
  if ("error" in auth) return { ok: false as const, error: auth.error };
  return { ok: true as const };
}

export async function updateLoyaltyTaskAction(input: { key: string; coins: number; enabled: boolean }) {
  const auth = await requireRewards();
  if (!auth.ok) return auth;
  if (!/^[a-z_]+$/.test(input.key)) return { ok: false as const, error: "Unknown reward." };
  if (!Number.isInteger(input.coins) || input.coins < 0 || input.coins > 10000) {
    return { ok: false as const, error: "Coin amounts must be from 0 to 10,000." };
  }
  const db = adminDb();
  const { error } = await db.from("loyalty_tasks" as "reward_rules").update({
    coins: input.coins,
    enabled: input.enabled,
  } as never).eq("key" as "id", input.key as never);
  if (error) return { ok: false as const, error: "The Coins ledger is not installed yet." };
  revalidatePath("/admin/rewards");
  revalidatePath("/dashboard/rewards");
  return { ok: true as const, message: "Saved. This amount applies to future grants only." };
}

export async function updateLoyaltySettingAction(key: string, value: boolean | number) {
  const auth = await requireRewards();
  if (!auth.ok) return auth;
  const allowed = new Set([
    "coins_earning_enabled",
    "legacy_freeplay_claims_enabled",
    "coins_checkin_enabled",
    "deposit_coins_enabled",
    "deposit_coins_per_dollar",
    "deposit_coins_min_dollars",
    "deposit_coins_max_per_tx",
    "deposit_coins_max_per_player_month",
    "coins_player_month_cap",
    "coins_global_budget",
  ]);
  if (!allowed.has(key)) return { ok: false as const, error: "That setting cannot be changed here." };
  if (key === "coins_checkin_enabled" && value === true) {
    const current = await adminDb().from("site_settings").select("value").eq("key", "legacy_freeplay_claims_enabled").maybeSingle();
    const legacyOn = ((current.data as { value?: unknown } | null)?.value ?? true) === true;
    if (legacyOn) {
      return { ok: false as const, error: "Turn off the $1 freeplay check-in before turning on Coin check-in." };
    }
  }
  if (key === "legacy_freeplay_claims_enabled" && value === true) {
    const current = await adminDb().from("site_settings").select("value").eq("key", "coins_checkin_enabled").maybeSingle();
    if ((current.data as { value?: unknown } | null)?.value === true) {
      return { ok: false as const, error: "Turn off Coin check-in before turning the $1 freeplay check-in back on." };
    }
  }
  const db = adminDb();
  const { error } = await db.from("site_settings").upsert(
    { key, value, description: "Coins reward setting" },
    { onConflict: "key" },
  );
  if (error) return { ok: false as const, error: "Could not save that Coin setting." };
  revalidatePath("/admin/rewards");
  revalidatePath("/dashboard/rewards");
  return { ok: true as const };
}

function wholeNumber(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

/** Saves Coin controls. Both claim switches together are refused and nothing is written. */
export async function saveLoyaltyControlsAction(input: {
  earning: boolean;
  deposit: boolean;
  legacy: boolean;
  checkin: boolean;
  rate: number;
  minDollars: number;
  maxPerTx: number;
  maxPerPlayerMonth: number;
  playerMonthCap: number;
  globalBudget: number;
}) {
  const auth = await requireRewards();
  if (!auth.ok) return auth;
  const switches = claimSwitchSave({ legacy: input.legacy, coinCheckin: input.checkin });
  if (!switches.ok) return { ok: false as const, error: BOTH_CLAIM_SWITCHES_ERROR };
  const numbers: Array<[string, number, number, number]> = [
    ["Coins per deposit dollar", input.rate, 0, 100],
    ["Minimum deposit dollars", input.minDollars, 0, 10000],
    ["Maximum Coins per deposit", input.maxPerTx, 0, 100000],
    ["Deposit Coins per player each month", input.maxPerPlayerMonth, 0, 100000],
    ["Player monthly Coin cap", input.playerMonthCap, 0, 30000],
    ["Global Coin budget", input.globalBudget, 0, 30000],
  ];
  for (const [label, value, min, max] of numbers) {
    if (!wholeNumber(value, min, max)) {
      return { ok: false as const, error: `${label} must be a whole number from ${min} to ${max}.` };
    }
  }
  const steps: Array<[string, boolean | number]> = input.checkin
    ? [["legacy_freeplay_claims_enabled", false], ["coins_checkin_enabled", true]]
    : input.legacy
      ? [["coins_checkin_enabled", false], ["legacy_freeplay_claims_enabled", true]]
      : [["coins_checkin_enabled", false], ["legacy_freeplay_claims_enabled", false]];
  steps.push(
    ["coins_earning_enabled", input.earning],
    ["deposit_coins_enabled", input.deposit],
    ["deposit_coins_per_dollar", input.rate],
    ["deposit_coins_min_dollars", input.minDollars],
    ["deposit_coins_max_per_tx", input.maxPerTx],
    ["deposit_coins_max_per_player_month", input.maxPerPlayerMonth],
    ["coins_player_month_cap", input.playerMonthCap],
    ["coins_global_budget", input.globalBudget],
  );
  for (const [key, value] of steps) {
    const saved = await updateLoyaltySettingAction(key, value);
    if (!saved.ok) return saved;
  }
  return { ok: true as const, message: "Coin settings saved." };
}

/** Stops new Coins. It does not turn the $1 freeplay check-in on or off. */
export async function pauseLoyaltyEarningAction() {
  const auth = await requireRewards();
  if (!auth.ok) return auth;
  return updateLoyaltySettingAction("coins_earning_enabled", false);
}
