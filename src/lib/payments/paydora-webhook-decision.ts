import { collectedDepositAmount, isPaidDepositStatus } from "@/lib/payments/paydora";

export type PaydoraWebhookAction = "credit" | "reverse" | "hold" | "ignore";

export type PaydoraWebhookDecision = {
  action: PaydoraWebhookAction;
  reason: string;
  amount: number;
};

const USD = new Set(["usd", "us dollar", "us dollars"]);

export function amountsMatch(saved: number | null | undefined, collected: number) {
  const left = Number(saved);
  const right = Number(collected);
  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) return false;
  return Math.round(left * 100) === Math.round(right * 100);
}

export function currencyAccepted(currency: string | null | undefined) {
  const value = (currency || "").trim().toLowerCase();
  if (!value) return "missing" as const;
  return USD.has(value) ? ("usd" as const) : ("rejected" as const);
}

/**
 * Pure callback decision. A held payment is never credited from a later retry.
 * Currency is rejected when the provider sends a non-USD value. A missing
 * currency field is not treated as proof of USD.
 */
export function decidePaydoraWebhook(input: {
  depositsOn: boolean;
  previouslyHeld: boolean;
  event: string;
  status?: string | null;
  currency?: string | null;
  savedAmount?: number | null;
  collectedAmount: number;
  hasIntent: boolean;
  ageBlocked: boolean;
}): PaydoraWebhookDecision {
  const event = input.event || "unknown";
  const collected = input.collectedAmount;

  if (!input.depositsOn) {
    return { action: "hold", reason: "held: deposits off", amount: 0 };
  }
  if (input.previouslyHeld) {
    return { action: "hold", reason: "held: awaiting reconciliation", amount: 0 };
  }
  if (event === "deposit.refunded") {
    return { action: "reverse", reason: "refund", amount: collected };
  }
  if (event !== "deposit.paid") {
    return { action: "ignore", reason: "unknown event", amount: 0 };
  }
  if (input.ageBlocked) {
    return { action: "ignore", reason: "held: age", amount: 0 };
  }
  if (!isPaidDepositStatus(input.status || "")) {
    return { action: "ignore", reason: "unpaid status", amount: 0 };
  }
  if (currencyAccepted(input.currency) === "rejected") {
    return { action: "ignore", reason: "currency rejected", amount: 0 };
  }
  if (currencyAccepted(input.currency) === "missing") {
    return { action: "hold", reason: "held: currency missing", amount: 0 };
  }
  if (!input.hasIntent || !amountsMatch(input.savedAmount, collected)) {
    return { action: "hold", reason: "held: amount mismatch", amount: 0 };
  }
  return { action: "credit", reason: "paid", amount: collected };
}

export function collectedFromWebhook(data: {
  status?: string | null;
  amount?: number | null;
  paidAmount?: number | null;
}) {
  return collectedDepositAmount(data);
}
