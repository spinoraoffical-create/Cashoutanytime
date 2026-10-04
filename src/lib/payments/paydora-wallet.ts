import { createAdminClient } from "@/lib/supabase/admin";

/** No non-atomic wallet writes. Credits/debits go through Paydora RPCs only. */

const ALLOWED_METHODS = new Set(["paypal", "chime", "cashapp", "bitcoin", "usdt", "venmo"]);

export function paydoraProofPath(depositId: string) {
  return `paydora/${depositId}`;
}

export function isPaydoraProofPath(path: string | null | undefined) {
  return Boolean(path?.startsWith("paydora/"));
}

export function mapPaydoraMethod(value?: string | null) {
  const v = (value || "").trim().toLowerCase();
  if (ALLOWED_METHODS.has(v)) return v;
  if (v.includes("chime")) return "chime";
  if (v.includes("cash")) return "cashapp";
  if (v.includes("venmo")) return "venmo";
  if (v.includes("paypal")) return "paypal";
  if (v.includes("bitcoin") || v.includes("btc")) return "bitcoin";
  if (v.includes("usdt") || v.includes("tether")) return "usdt";
  return "cashapp";
}

function asRpcResult(data: unknown) {
  if (data && typeof data === "object") return data as Record<string, unknown>;
  return {};
}

export async function creditPaydoraDeposit(input: {
  userId: string;
  amount: number;
  depositId: string;
  referenceId?: string | null;
  methodValue?: string | null;
  methodName?: string | null;
  gameName?: string | null;
  gameSlug?: string | null;
}) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client unavailable");
  if (!input.userId || input.amount <= 0 || !input.depositId) {
    throw new Error("Invalid Paydora credit payload");
  }

  const amount = Math.round(input.amount * 100) / 100;
  const methodName = input.methodName?.trim() || "Paydora";
  const description = `Deposit confirmed — $${amount.toFixed(2)} via ${methodName} (${input.referenceId || "order"} ${input.depositId})`;

  const { data, error } = await admin.rpc("credit_paydora_deposit", {
    p_user_id: input.userId,
    p_amount: amount,
    p_payment_id: input.depositId,
    p_order_id: input.referenceId ?? null,
    p_description: description,
  });

  if (error) throw new Error(error.message);

  const result = asRpcResult(data);
  if (result.duplicate === true) {
    return { credited: false, duplicate: true as const };
  }
  if (result.credited !== true) {
    throw new Error("Wallet credit failed");
  }

  await admin.from("notifications").insert({
    user_id: input.userId,
    title: "Deposit confirmed",
    message: `$${amount.toFixed(2)} has been added to your wallet via ${methodName}.`,
    type: "success",
    is_read: false,
  });

  return { credited: true as const, newBalance: Number(result.new_balance || 0) };
}

export async function reversePaydoraDeposit(input: {
  userId: string;
  amount: number;
  depositId: string;
}) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client unavailable");
  if (!input.userId || input.amount <= 0 || !input.depositId) {
    throw new Error("Invalid Paydora refund payload");
  }

  const amount = Math.round(input.amount * 100) / 100;
  const { data, error } = await admin.rpc("reverse_paydora_deposit", {
    p_user_id: input.userId,
    p_amount: amount,
    p_payment_id: input.depositId,
  });

  if (error) throw new Error(error.message);

  const result = asRpcResult(data);
  if (result.duplicate === true) {
    return { reversed: false, duplicate: true as const };
  }
  if (result.reversed !== true) {
    throw new Error("Wallet refund failed");
  }

  return { reversed: true as const, newBalance: Number(result.new_balance || 0) };
}

export async function debitPaydoraPayout(input: {
  userId: string;
  amount: number;
  payoutKey: string;
}) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client unavailable");

  const amount = Math.round(input.amount * 100) / 100;
  const { data, error } = await admin.rpc("debit_paydora_payout", {
    p_user_id: input.userId,
    p_amount: amount,
    p_payout_key: input.payoutKey,
  });

  if (error) throw new Error(error.message);

  const result = asRpcResult(data);
  if (result.duplicate === true) {
    return { debited: false, duplicate: true as const };
  }
  if (result.debited !== true) {
    throw new Error("Wallet debit failed");
  }

  return { debited: true as const, newBalance: Number(result.new_balance || 0) };
}

export async function refundFailedPaydoraPayout(input: {
  userId: string;
  amount: number;
  payoutKey: string;
}) {
  return creditPaydoraDeposit({
    userId: input.userId,
    amount: input.amount,
    depositId: `payout-refund:${input.payoutKey}`,
    referenceId: input.payoutKey,
    methodName: "Paydora payout reversal",
  });
}

export async function hasPaydoraPaymentBeenCredited(depositId: string, userId: string) {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data } = await admin
    .from("paydora_processed_events")
    .select("payment_id, user_id, direction")
    .eq("payment_id", depositId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.direction === "credit";
}
