import type { SupabaseClient } from "@supabase/supabase-js";

const DEPOSIT_REDEEM_MIN_MULT = 3;
const DEPOSIT_REDEEM_MAX_MULT = 8;
const BONUS_REDEEM_MIN_MULT = 7;
const BONUS_REDEEM_MAX_MULT = 15;
const MIN_PARTIAL_REDEEM = 5;
const LOAD_TYPES = ["load", "reload"] as const;

export interface ActiveDepositRollover {
  activeDepositAmount: number;
  redeemedSinceActiveDeposit: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function rolloverBounds(
  rollover: ActiveDepositRollover,
  minMult: number,
  maxMult: number
) {
  const activeDepositAmount = roundMoney(rollover.activeDepositAmount);
  const redeemedSinceActiveDeposit = roundMoney(rollover.redeemedSinceActiveDeposit);
  return {
    activeDepositAmount,
    redeemedSinceActiveDeposit,
    minGameBalance: roundMoney(activeDepositAmount * minMult),
    maxRedeemRemaining: roundMoney(
      Math.max(0, activeDepositAmount * maxMult - redeemedSinceActiveDeposit)
    ),
  };
}

async function fetchActiveWalletRollover(
  supabase: SupabaseClient,
  userId: string,
  gameSlug: string,
  walletType: "current" | "bonus"
): Promise<ActiveDepositRollover> {
  const rpcName =
    walletType === "current" ? "get_deposit_rollover_totals" : "get_bonus_rollover_totals";

  const { data, error } = await supabase.rpc(rpcName, {
    p_user_id: userId,
    p_game_slug: gameSlug,
  });

  if (!error && data?.length) {
    const row = data[0] as {
      active_load_amount?: number;
      redeemed_since_active?: number;
    };
    return {
      activeDepositAmount: roundMoney(Number(row.active_load_amount ?? 0)),
      redeemedSinceActiveDeposit: roundMoney(Number(row.redeemed_since_active ?? 0)),
    };
  }

  const { data: latestLoad } = await supabase
    .from("game_load_requests")
    .select("amount, completed_at")
    .eq("user_id", userId)
    .eq("game_slug", gameSlug)
    .eq("wallet_type", walletType)
    .in("load_type", [...LOAD_TYPES])
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

  const redeemedSinceActiveDeposit = roundMoney(
    (redeems ?? []).reduce((acc, row) => acc + Number(row.amount ?? 0), 0)
  );

  return {
    activeDepositAmount: roundMoney(Number(latestLoad.amount ?? 0)),
    redeemedSinceActiveDeposit,
  };
}

/** Latest single deposit load + redeems since that load (not summed across all loads). */
export async function fetchActiveDepositRollover(
  supabase: SupabaseClient,
  userId: string,
  gameSlug: string
): Promise<ActiveDepositRollover> {
  return fetchActiveWalletRollover(supabase, userId, gameSlug, "current");
}

/** @deprecated Use fetchActiveDepositRollover */
export async function fetchDepositRolloverTotals(
  supabase: SupabaseClient,
  userId: string,
  gameSlug: string
): Promise<ActiveDepositRollover> {
  return fetchActiveDepositRollover(supabase, userId, gameSlug);
}

function resolveWalletRedeemAmount(input: {
  gameBalance: number;
  requestedAmount: number;
  redeemAll: boolean;
  rollover: ActiveDepositRollover;
  minMult: number;
  maxMult: number;
  loadLabel: string;
}): { amount: number } | { error: string } {
  const balance = roundMoney(input.gameBalance);
  const requested = roundMoney(input.requestedAmount);
  const bounds = rolloverBounds(input.rollover, input.minMult, input.maxMult);

  if (bounds.activeDepositAmount <= 0) {
    return {
      error: `No ${input.loadLabel} on this game account — redeem destination must match how you loaded.`,
    };
  }

  if (balance < bounds.minGameBalance) {
    return {
      error: `Need at least $${bounds.minGameBalance.toFixed(2)} in game (${input.minMult}x your $${bounds.activeDepositAmount.toFixed(2)} ${input.loadLabel}). Current balance: $${balance.toFixed(2)}.`,
    };
  }

  if (bounds.maxRedeemRemaining <= 0) {
    return {
      error: `You have reached the ${input.maxMult}x redeem limit for this ${input.loadLabel}.`,
    };
  }

  let amount: number;
  if (input.redeemAll) {
    amount = Math.min(balance, bounds.maxRedeemRemaining);
  } else {
    amount = requested;
    if (amount > bounds.maxRedeemRemaining) {
      return {
        error: `Maximum redeem is $${bounds.maxRedeemRemaining.toFixed(2)} (${input.maxMult}x this ${input.loadLabel} minus prior redeems).`,
      };
    }
    if (amount > balance) {
      return { error: `Insufficient game balance ($${balance.toFixed(2)}).` };
    }
    if (amount < MIN_PARTIAL_REDEEM) {
      return { error: `Minimum redeem amount is $${MIN_PARTIAL_REDEEM}` };
    }
  }

  if (amount <= 0) return { error: "No balance to redeem" };
  return { amount: roundMoney(amount) };
}

type RedeemJob = {
  user_id: string;
  game_slug: string;
  wallet_type: string;
  amount: number;
  redeem_all?: boolean;
};

/** Enforces rollover: deposit 3x/8x, bonus load 7x/15x per individual load. */
export async function resolveDepositRedeemForJob(
  supabase: SupabaseClient,
  job: RedeemJob,
  gameBalance: number
): Promise<number> {
  if (job.wallet_type === "bonus") {
    throw new Error("Bonus wallet redeems are no longer supported.");
  }

  if (job.wallet_type !== "current") {
    const balance = roundMoney(gameBalance);
    if (job.redeem_all) {
      if (balance <= 0) throw new Error("No balance to redeem");
      return balance;
    }
    const amount = roundMoney(Number(job.amount));
    if (amount <= 0) throw new Error("Amount must be positive");
    if (amount > balance) {
      throw new Error(`Insufficient game balance ($${balance.toFixed(2)})`);
    }
    return amount;
  }

  const rollover = await fetchActiveDepositRollover(supabase, job.user_id, job.game_slug);
  const resolved = resolveWalletRedeemAmount({
    gameBalance,
    requestedAmount: Number(job.amount),
    redeemAll: Boolean(job.redeem_all),
    rollover,
    minMult: DEPOSIT_REDEEM_MIN_MULT,
    maxMult: DEPOSIT_REDEEM_MAX_MULT,
    loadLabel: "deposit",
  });

  if ("error" in resolved) throw new Error(resolved.error);
  return resolved.amount;
}
