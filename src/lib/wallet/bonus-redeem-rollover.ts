import { GAME_BONUS_REDEEM_RULES } from "@/lib/games";
import { WALLET_LOAD_LIMITS } from "@/lib/game-automation/config";
import { roundMoney, type DepositRolloverBounds } from "@/lib/wallet/deposit-redeem-rollover";

export const BONUS_REDEEM_MIN_MULT = GAME_BONUS_REDEEM_RULES.redeemMin;
export const BONUS_REDEEM_MAX_MULT = GAME_BONUS_REDEEM_RULES.redeemMax;

export const BONUS_LOAD_TYPES = ["load", "reload"] as const;

export interface ActiveBonusRollover {
  activeBonusLoadAmount: number;
  redeemedSinceActiveBonusLoad: number;
}

export type BonusRolloverBounds = DepositRolloverBounds;

export function bonusRolloverBounds(rollover: ActiveBonusRollover): BonusRolloverBounds {
  const activeDepositAmount = roundMoney(rollover.activeBonusLoadAmount);
  const redeemedSinceActiveDeposit = roundMoney(rollover.redeemedSinceActiveBonusLoad);
  return {
    activeDepositAmount,
    redeemedSinceActiveDeposit,
    minGameBalance: roundMoney(activeDepositAmount * BONUS_REDEEM_MIN_MULT),
    maxRedeemRemaining: roundMoney(
      Math.max(
        0,
        activeDepositAmount * BONUS_REDEEM_MAX_MULT - redeemedSinceActiveDeposit
      )
    ),
  };
}

export type BonusRedeemResolution =
  | { ok: true; amount: number }
  | { ok: false; error: string };

/** Resolve redeem for bonus-wallet loads (1x min balance, 5x max cap per bonus load). */
export function resolveBonusRedeemAmount(input: {
  gameBalance: number;
  requestedAmount: number;
  redeemAll: boolean;
  rollover: ActiveBonusRollover;
}): BonusRedeemResolution {
  const balance = roundMoney(input.gameBalance);
  const requested = roundMoney(input.requestedAmount);
  const bounds = bonusRolloverBounds(input.rollover);

  if (bounds.activeDepositAmount <= 0) {
    return {
      ok: false,
      error:
        "No bonus load on this game account. Redeem to Deposit Redeem if you loaded from Total Deposit.",
    };
  }

  if (balance < bounds.minGameBalance) {
    return {
      ok: false,
      error: `Need at least $${bounds.minGameBalance.toFixed(2)} in game (${BONUS_REDEEM_MIN_MULT}x your $${bounds.activeDepositAmount.toFixed(2)} bonus load). Current balance: $${balance.toFixed(2)}.`,
    };
  }

  if (bounds.maxRedeemRemaining <= 0) {
    return {
      ok: false,
      error: `You have reached the ${BONUS_REDEEM_MAX_MULT}x redeem limit for this bonus load.`,
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
        error: `Maximum redeem is $${bounds.maxRedeemRemaining.toFixed(2)} (${BONUS_REDEEM_MAX_MULT}x this bonus load minus prior redeems).`,
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
