import { GAME_BONUS_RULES } from "@/lib/games";
import { WALLET_LOAD_LIMITS } from "@/lib/game-automation/config";

export const DEPOSIT_REDEEM_MIN_MULT = GAME_BONUS_RULES.redeemMin;
export const DEPOSIT_REDEEM_MAX_MULT = GAME_BONUS_RULES.redeemMax;

/** Completed game_load_requests rows that count toward deposit rollover. */
export const DEPOSIT_LOAD_TYPES = ["load", "reload"] as const;

/** Rollover for the most recent single deposit load (not summed across loads). */
export interface ActiveDepositRollover {
  activeDepositAmount: number;
  redeemedSinceActiveDeposit: number;
}

export interface DepositRolloverBounds extends ActiveDepositRollover {
  minGameBalance: number;
  maxRedeemRemaining: number;
}

export function depositRolloverBounds(rollover: ActiveDepositRollover): DepositRolloverBounds {
  const activeDepositAmount = roundMoney(rollover.activeDepositAmount);
  const redeemedSinceActiveDeposit = roundMoney(rollover.redeemedSinceActiveDeposit);
  return {
    activeDepositAmount,
    redeemedSinceActiveDeposit,
    minGameBalance: roundMoney(activeDepositAmount * DEPOSIT_REDEEM_MIN_MULT),
    maxRedeemRemaining: roundMoney(
      Math.max(
        0,
        activeDepositAmount * DEPOSIT_REDEEM_MAX_MULT - redeemedSinceActiveDeposit
      )
    ),
  };
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type DepositRedeemResolution =
  | { ok: true; amount: number }
  | { ok: false; error: string };

/** Resolve redeem amount for deposit-wallet redeems (3x min balance, 8x max cap per deposit). */
export function resolveDepositRedeemAmount(input: {
  gameBalance: number;
  requestedAmount: number;
  redeemAll: boolean;
  rollover: ActiveDepositRollover;
}): DepositRedeemResolution {
  const balance = roundMoney(input.gameBalance);
  const requested = roundMoney(input.requestedAmount);
  const bounds = depositRolloverBounds(input.rollover);

  if (bounds.activeDepositAmount <= 0) {
    return {
      ok: false,
      error:
        "No deposit load on this game account. Load from Total Deposit first.",
    };
  }

  if (balance < bounds.minGameBalance) {
    return {
      ok: false,
      error: `Need at least $${bounds.minGameBalance.toFixed(2)} in game (${DEPOSIT_REDEEM_MIN_MULT}x your $${bounds.activeDepositAmount.toFixed(2)} deposit). Current balance: $${balance.toFixed(2)}.`,
    };
  }

  if (bounds.maxRedeemRemaining <= 0) {
    return {
      ok: false,
      error: `You have reached the ${DEPOSIT_REDEEM_MAX_MULT}x redeem limit for this deposit.`,
    };
  }

  let amount: number;
  if (input.redeemAll) {
    amount = Math.min(balance, bounds.maxRedeemRemaining);
  } else {
    amount = requested;
    if (amount > bounds.maxRedeemRemaining) {
      return {
        ok: false,
        error: `Maximum redeem is $${bounds.maxRedeemRemaining.toFixed(2)} (${DEPOSIT_REDEEM_MAX_MULT}x this deposit minus prior redeems).`,
      };
    }
    if (amount > balance) {
      return {
        ok: false,
        error: `Insufficient game balance ($${balance.toFixed(2)}).`,
      };
    }
    if (amount < WALLET_LOAD_LIMITS.min) {
      return { ok: false, error: `Minimum redeem amount is $${WALLET_LOAD_LIMITS.min}` };
    }
  }

  if (amount <= 0) return { ok: false, error: "No balance to redeem" };

  return { ok: true, amount: roundMoney(amount) };
}
