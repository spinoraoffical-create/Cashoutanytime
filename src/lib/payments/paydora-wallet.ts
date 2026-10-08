import { writeAudit } from "@/lib/actions/admin/core";
import { createAdminClient } from "@/lib/supabase/admin";
import { PaymentIdentityError, quotePaidDeposit, settleDepositSideEffects } from "@/lib/payments/auto-settle";

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

async function alreadyApplied(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  marker: string
) {
  const { data: tx } = await admin
    .from("wallet_transactions")
    .select("id")
    .eq("user_id", userId)
    .ilike("description", `%${marker}%`)
    .limit(1)
    .maybeSingle();
  if (tx?.id) return true;

  const { data: dep } = await admin
    .from("deposit_requests")
    .select("id, wallet_credited, status")
    .eq("proof_url", paydoraProofPath(marker))
    .maybeSingle();

  return Boolean(dep && (dep.wallet_credited || dep.status === "completed"));
}

async function ensureDepositRequest(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  input: {
    userId: string;
    amount: number;
    depositId: string;
    referenceId?: string | null;
    methodValue?: string | null;
    methodName?: string | null;
    gameName?: string | null;
    gameSlug?: string | null;
  }
) {
  const proof = paydoraProofPath(input.depositId);
  const methodName = input.methodName?.trim() || "Paydora";
  const row = {
    user_id: input.userId,
    game_slug: input.gameSlug?.trim() || null,
    game_name: input.gameName?.trim() || `Instant deposit · ${methodName}`,
    payment_method: mapPaydoraMethod(input.methodValue || input.methodName),
    amount: input.amount,
    proof_url: proof,
    status: "completed",
    wallet_credited: true,
    admin_notes: input.referenceId ? `Paid online · ${input.referenceId}` : "Paid online",
  };

  const { data: existing } = await admin
    .from("deposit_requests")
    .select("id")
    .eq("proof_url", proof)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from("deposit_requests")
      .update({
        status: "completed",
        wallet_credited: true,
        amount: input.amount,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await admin.from("deposit_requests").insert(row);
  if (error) throw new Error(error.message);
}

type CreditResult = {
  credited: boolean;
  duplicate?: boolean;
  newBalance?: number;
  finalCredit?: number;
  paid?: number;
};

export async function creditPaydoraDeposit(input: {
  userId: string;
  amount: number;
  depositId: string;
  referenceId?: string | null;
  methodValue?: string | null;
  methodName?: string | null;
  gameName?: string | null;
  gameSlug?: string | null;
  provider?: string;
  /** Failed payout refund. Credits the reserved amount and does not apply a game bonus. */
  payoutVoid?: boolean;
}): Promise<CreditResult> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client unavailable");
  if (!input.userId || input.amount <= 0 || !input.depositId) return { credited: false };

  const amount = Math.round(input.amount * 100) / 100;
  const marker = input.depositId;
  const provider = input.provider || "paydora";

  if (input.payoutVoid) {
    return creditMarkedAmount(admin, {
      ...input,
      amount,
      marker,
      creditAmount: amount,
      description: `Payout refund $${amount.toFixed(2)} (${marker})`,
    });
  }

  if (await alreadyApplied(admin, input.userId, marker)) {
    await ensureDepositRequest(admin, { ...input, amount });
    const { data: ledger, error: ledgerError } = await admin
      .from("deposit_bonus_ledger")
      .select("base_amount, bonus_percent, bonus_amount, final_credit, deposit_kind, game_slug")
      .eq("deposit_key", marker)
      .maybeSingle();
    if (ledgerError && !/schema cache|does not exist/i.test(ledgerError.message)) {
      throw new PaymentIdentityError(ledgerError.message);
    }
    const saved = ledger as {
      base_amount: number;
      bonus_percent: number;
      bonus_amount: number;
      final_credit: number;
      deposit_kind: "first" | "reload";
      game_slug: string | null;
    } | null;
    if (saved?.game_slug && saved.final_credit != null) {
      await settleDepositSideEffects(admin, {
        userId: input.userId,
        depositId: marker,
        walletCredited: true,
        quote: {
          gameSlug: saved.game_slug,
          gameName: input.gameName ?? null,
          promoCode: null,
          baseAmount: Number(saved.base_amount),
          bonusPercent: Number(saved.bonus_percent),
          bonusAmount: Number(saved.bonus_amount),
          finalCredit: Number(saved.final_credit),
          kind: saved.deposit_kind === "first" ? "first" : "reload",
        },
      });
      return { credited: false, duplicate: true, finalCredit: Number(saved.final_credit), paid: amount };
    }
    try {
      const quote = await quotePaidDeposit(admin, {
        provider,
        userId: input.userId,
        depositId: marker,
        baseAmount: amount,
      });
      await settleDepositSideEffects(admin, {
        userId: input.userId,
        depositId: marker,
        walletCredited: true,
        quote,
      });
      return { credited: false, duplicate: true, finalCredit: quote.finalCredit, paid: amount };
    } catch (err) {
      if (err instanceof PaymentIdentityError && /missing/i.test(err.message)) {
        return { credited: false, duplicate: true, paid: amount };
      }
      throw err;
    }
  }

  const quote = await quotePaidDeposit(admin, {
    provider,
    userId: input.userId,
    depositId: marker,
    baseAmount: amount,
    promoCode: null,
  });
  if (!quote.gameSlug || !(quote.finalCredit > 0)) {
    throw new PaymentIdentityError("Payment intent or game is missing");
  }

  const methodName = input.methodName?.trim() || "Paydora";
  const description = quote.bonusAmount > 0
    ? `Deposit $${amount.toFixed(2)} + ${quote.bonusPercent}% bonus via ${methodName} (${marker})`
    : `Deposit confirmed — $${amount.toFixed(2)} via ${methodName} (${input.referenceId || "order"} ${marker})`;

  const credited = await creditMarkedAmount(admin, {
    ...input,
    amount,
    marker,
    creditAmount: quote.finalCredit,
    description,
  });
  await settleDepositSideEffects(admin, {
    userId: input.userId,
    depositId: marker,
    quote,
    walletCredited: true,
  });
  await writeAudit({
    actorId: input.userId,
    action: "deposit.credit",
    entityType: "deposit_request",
    entityId: marker,
    after: {
      paid: amount,
      bonusPercent: quote.bonusPercent,
      bonus: quote.bonusAmount,
      finalCredit: quote.finalCredit,
      game: quote.gameSlug,
    },
  });
  return { ...credited, finalCredit: quote.finalCredit, paid: amount };
}

async function creditMarkedAmount(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  input: {
    userId: string;
    amount: number;
    depositId: string;
    referenceId?: string | null;
    methodValue?: string | null;
    methodName?: string | null;
    gameName?: string | null;
    gameSlug?: string | null;
    marker: string;
    creditAmount: number;
    description: string;
  }
) {
  const { data: rpcData, error: rpcError } = await admin.rpc("credit_paydora_deposit", {
    p_user_id: input.userId,
    p_amount: input.creditAmount,
    p_payment_id: input.marker,
    p_order_id: input.referenceId ?? null,
    p_description: input.description,
  });

  if (rpcError) {
    const missingRpc =
      rpcError.code === "42883" ||
      rpcError.message.includes("Could not find the function") ||
      rpcError.message.includes("credit_paydora_deposit");
    if (missingRpc) {
      throw new PaymentIdentityError("credit_paydora_deposit is missing. Apply the Paydora wallet SQL before crediting.");
    }
    throw new Error(rpcError.message);
  }

  const row = (rpcData ?? {}) as { credited?: boolean; duplicate?: boolean; new_balance?: number };
  await ensureDepositRequest(admin, { ...input, amount: input.amount });
  return {
    credited: Boolean(row.credited),
    duplicate: Boolean(row.duplicate),
    newBalance: Number(row.new_balance ?? 0),
  };
}

export async function reversePaydoraDeposit(input: {
  userId: string;
  amount: number;
  depositId: string;
}) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client unavailable");
  const { data: ledger, error: ledgerError } = await admin
    .from("deposit_bonus_ledger")
    .select("final_credit")
    .eq("deposit_key", input.depositId)
    .maybeSingle();
  if (ledgerError) {
    throw new PaymentIdentityError(
      /schema cache|does not exist/i.test(ledgerError.message)
        ? "Apply supabase/migrations/20261008000130_auto_ops.sql before reversing deposits."
        : ledgerError.message
    );
  }
  const finalCredit = Number((ledger as { final_credit?: number } | null)?.final_credit);
  if (!Number.isFinite(finalCredit) || finalCredit <= 0) {
    throw new PaymentIdentityError("Bonus ledger final credit is missing");
  }
  const amount = Math.round(finalCredit * 100) / 100;
  const { data: rpcData, error: rpcError } = await admin.rpc("reverse_paydora_deposit", {
    p_user_id: input.userId,
    p_amount: amount,
    p_payment_id: input.depositId,
  });
  const missingRpc =
    rpcError?.code === "42883" ||
    Boolean(rpcError?.message?.includes("Could not find the function")) ||
    Boolean(rpcError?.message?.includes("reverse_paydora_deposit"));
  if (!rpcError) {
    const row = (rpcData ?? {}) as { reversed?: boolean; duplicate?: boolean; new_balance?: number };
    if (row.reversed) {
      await writeAudit({
        actorId: input.userId,
        action: "deposit.refund",
        entityType: "deposit_request",
        entityId: input.depositId,
        after: { finalCredit: amount },
      });
    }
    return {
      reversed: Boolean(row.reversed),
      duplicate: Boolean(row.duplicate),
      newBalance: Number(row.new_balance ?? 0),
      finalCredit: amount,
    };
  }
  throw new PaymentIdentityError(
    missingRpc
      ? "reverse_paydora_deposit is missing. Apply the Paydora wallet SQL before reversing deposits."
      : rpcError.message
  );
}
