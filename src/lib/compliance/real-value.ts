import { ageDenial } from "@/lib/compliance/age";
import { moneyRegionDenial } from "@/lib/compliance/restricted-state";

export type RealValueOperation = "deposits" | "game_loads" | "redemptions" | "payouts";

export const REAL_VALUE_OFF = "This money action is turned off.";

const ENV_NAME: Record<RealValueOperation, string> = {
  deposits: "REAL_VALUE_DEPOSITS",
  game_loads: "REAL_VALUE_GAME_LOADS",
  redemptions: "REAL_VALUE_REDEMPTIONS",
  payouts: "REAL_VALUE_PAYOUTS",
};

/** Fail closed. Only the exact value "on" enables an operation. */
export function realValueEnabled(operation: RealValueOperation, env: NodeJS.ProcessEnv = process.env): boolean {
  return env[ENV_NAME[operation]] === "on";
}

export function realValueDenial(operation: RealValueOperation, env: NodeJS.ProcessEnv = process.env): string | null {
  return realValueEnabled(operation, env) ? null : REAL_VALUE_OFF;
}

/** Staff and prize balance edits. Only the exact value "on" enables them. */
export function adjustmentDenial(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.REAL_VALUE_ADJUSTMENTS === "on" ? null : REAL_VALUE_OFF;
}

export function ledgerOperation(kind: string): RealValueOperation | null {
  if (kind === "deposit" || kind === "refund") return "deposits";
  if (kind === "game_load") return "game_loads";
  if (kind === "game_redeem") return "redemptions";
  if (kind === "payout") return "payouts";
  return null;
}

export function playerMoneyDenial(input: {
  operation: RealValueOperation;
  headers: { get(name: string): string | null };
  dateOfBirth: string | null | undefined;
  env?: NodeJS.ProcessEnv;
  today?: Date;
}): string | null {
  return (
    realValueDenial(input.operation, input.env) ||
    moneyRegionDenial(input.headers, input.env) ||
    ageDenial(input.dateOfBirth, input.today)
  );
}
