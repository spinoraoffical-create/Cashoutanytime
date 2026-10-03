import type { WheelPrize } from "@/lib/spin/prizes";
import { WHEEL_PRIZES, pickWeightedPrize } from "@/lib/spin/prizes";

/** Platform-wide: at most 1 × $10 winner per this many spins (UTC day). */
export const SPINS_PER_TEN_DOLLAR_WIN = 20;

/** Platform-wide: at most 1 × $7 winner per this many spins (UTC day). */
export const SPINS_PER_TWENTY_DOLLAR_WIN = 100;

/** Max small cash wins ($1–$4) per this many spins (UTC day). */
export const SPINS_PER_SMALL_CASH_WIN = 12;

/** Extra random gate when a $10 slot is open (≈1 winner per 20 spins). */
export const TEN_DOLLAR_SLOT_CHANCE = 1 / SPINS_PER_TEN_DOLLAR_WIN;

/** Extra random gate when a $7 slot is open. */
export const TWENTY_DOLLAR_SLOT_CHANCE = 0.02;

/** Extra random gate when a small-cash slot is open. */
export const SMALL_CASH_SLOT_CHANCE = 0.1;

export interface GlobalSpinStats {
  /** Spins already recorded today (UTC), before the current spin. */
  spinsToday: number;
  tenDollarWinners: number;
  twentyDollarWinners: number;
  smallCashWinners: number;
}

export function startOfUtcDayIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function luckPrize(): { prize: WheelPrize; index: number } {
  const luck = WHEEL_PRIZES.filter((p) => p.type === "luck");
  const prize = luck[Math.floor(Math.random() * luck.length)] ?? WHEEL_PRIZES[1];
  const index = WHEEL_PRIZES.findIndex((p) => p.id === prize.id);
  return { prize, index: index >= 0 ? index : 1 };
}

function maxWinnersAllowed(spinsIncludingCurrent: number, everyNSpins: number): number {
  return Math.floor(spinsIncludingCurrent / everyNSpins);
}

/**
 * Apply platform win caps so big prizes stay rare (e.g. ~1 × $10 per 20 daily spins).
 * Wheel still shows all segments; server downgrades ineligible wins to "Better luck".
 */
export function resolveSpinPrize(
  stats: GlobalSpinStats,
  random = Math.random
): { prize: WheelPrize; index: number } {
  const { prize: picked, index: pickedIndex } = pickWeightedPrize();
  const spinsIncludingCurrent = stats.spinsToday + 1;

  if (picked.type === "luck" || picked.value <= 0) {
    return { prize: picked, index: pickedIndex };
  }

  if (picked.value === 10) {
    const slots = maxWinnersAllowed(spinsIncludingCurrent, SPINS_PER_TEN_DOLLAR_WIN);
    if (stats.tenDollarWinners >= slots || random() >= TEN_DOLLAR_SLOT_CHANCE) {
      return luckPrize();
    }
    return { prize: picked, index: pickedIndex };
  }

  if (picked.value === 7) {
    const slots = maxWinnersAllowed(spinsIncludingCurrent, SPINS_PER_TWENTY_DOLLAR_WIN);
    if (stats.twentyDollarWinners >= slots || random() >= TWENTY_DOLLAR_SLOT_CHANCE) {
      return luckPrize();
    }
    return { prize: picked, index: pickedIndex };
  }

  if (picked.value >= 1 && picked.value <= 4) {
    const slots = maxWinnersAllowed(spinsIncludingCurrent, SPINS_PER_SMALL_CASH_WIN);
    if (stats.smallCashWinners >= slots || random() >= SMALL_CASH_SLOT_CHANCE) {
      return luckPrize();
    }
    return { prize: picked, index: pickedIndex };
  }

  return { prize: picked, index: pickedIndex };
}
