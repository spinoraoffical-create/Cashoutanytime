import { createAdminClient } from "@/lib/supabase/admin";
import { quotePaidDeposit, settleDepositSideEffects } from "@/lib/payments/auto-settle";

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

async function applyWalletCredit(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  input: {
    userId: string;
    amount: number;
    source: string;
    description: string;
  }
) {
  const { error: rpcError } = await admin.rpc("credit_system_wallet", {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_source: input.source,
    p_description: input.description,
  });

  if (!rpcError) {
    const { data: profile } = await admin
      .from("profiles")
      .select("wallet_balance")
      .eq("id", input.userId)
      .maybeSingle();
    return Number(profile?.wallet_balance || 0);
  }

  const missingRpc =
    rpcError.code === "42883" ||
    rpcError.message.includes("Could not find the function") ||
    rpcError.message.includes("credit_system_wallet");

  if (!missingRpc) {
    throw new Error(rpcError.message);
  }

  // Fallback after protect_wallet_columns allows service_role
  const { data: profile } = await admin
    .from("profiles")
    .select("wallet_balance")
    .eq("id", input.userId)
    .maybeSingle();

  const currentBalance = Number(profile?.wallet_balance || 0);
  const newBalance = Math.round((currentBalance + input.amount) * 100) / 100;

  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update({ wallet_balance: newBalance })
    .eq("id", input.userId)
    .select("wallet_balance")
    .single();

  if (updateError) throw new Error(updateError.message);

  if (Math.abs(Number(updated?.wallet_balance) - newBalance) > 0.009) {
    throw new Error(
      "Wallet balance did not update. Run supabase/paydora-system-wallet-credit.sql in Supabase."
    );
  }

  const { error: txError } = await admin.from("wallet_transactions").insert({
    user_id: input.userId,
    amount: input.amount,
    wallet_type: "current",
    transaction_type: "credit",
    source: input.source,
    description: input.description,
    created_by: null,
  });

  if (txError) throw new Error(txError.message);
  return Number(updated.wallet_balance);
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
  if (!input.userId || input.amount <= 0 || !input.depositId) return { credited: false };

  const amount = Math.round(input.amount * 100) / 100;
  const marker = input.depositId;

  if (await alreadyApplied(admin, input.userId, marker)) {
    await ensureDepositRequest(admin, { ...input, amount });
    const { data: ledger } = await admin
      .from("deposit_bonus_ledger")
      .select("base_amount, bonus_percent, bonus_amount, final_credit, deposit_kind, game_slug")
      .eq("deposit_key", marker)
      .maybeSingle();
    const saved = ledger as {
      base_amount: number;
      bonus_percent: number;
      bonus_amount: number;
      final_credit: number;
      deposit_kind: "first" | "reload";
      game_slug: string | null;
    } | null;
    const { data: intent } = await admin
      .from("payment_intents")
      .select("final_credit")
      .eq("provider", "paydora")
      .eq("external_id", marker)
      .maybeSingle();
    const savedQuote = saved
      ? {
          gameSlug: saved.game_slug,
          gameName: input.gameName ?? null,
          promoCode: null,
          baseAmount: Number(saved.base_amount),
          bonusPercent: Number(saved.bonus_percent),
          bonusAmount: Number(saved.bonus_amount),
          finalCredit: Number(saved.final_credit),
          kind: saved.deposit_kind === "first" ? "first" as const : "reload" as const,
        }
      : (intent as { final_credit?: number | null } | null)?.final_credit != null
        ? await quotePaidDeposit(admin, {
            userId: input.userId,
            depositId: marker,
            baseAmount: amount,
            gameSlug: input.gameSlug,
            gameName: input.gameName,
          }).catch(() => null)
        : null;
    if (savedQuote) {
      await settleDepositSideEffects(admin, {
        userId: input.userId,
        depositId: marker,
        walletCredited: true,
        quote: savedQuote,
      });
    }
    return { credited: false, duplicate: true };
  }

  let quote = null;
  try {
    quote = await quotePaidDeposit(admin, {
      userId: input.userId,
      depositId: marker,
      baseAmount: amount,
      gameSlug: input.gameSlug,
      gameName: input.gameName,
    });
  } catch (err) {
    console.error("[auto-settle] quote failed, crediting the paid amount only", err);
  }
  const creditAmount = quote?.finalCredit ?? amount;

  const methodName = input.methodName?.trim() || "Paydora";
  const description = quote && quote.bonusAmount > 0
    ? `Deposit $${amount.toFixed(2)} + ${quote.bonusPercent}% bonus via ${methodName} (${marker})`
    : `Deposit confirmed — $${amount.toFixed(2)} via ${methodName} (${input.referenceId || "order"} ${marker})`;

  const { data: rpcData, error: rpcError } = await admin.rpc("credit_paydora_deposit", {
    p_user_id: input.userId,
    p_amount: creditAmount,
    p_payment_id: marker,
    p_order_id: input.referenceId ?? null,
    p_description: description,
  });

  const missingRpc =
    rpcError?.code === "42883" ||
    Boolean(rpcError?.message?.includes("Could not find the function")) ||
    Boolean(rpcError?.message?.includes("credit_paydora_deposit"));

  if (!rpcError) {
    const row = (rpcData ?? {}) as { credited?: boolean; duplicate?: boolean; new_balance?: number };
    await ensureDepositRequest(admin, { ...input, amount });
    if (quote && (row.credited || row.duplicate)) {
      await settleDepositSideEffects(admin, {
        userId: input.userId,
        depositId: marker,
        quote,
        walletCredited: true,
      });
    } else if (row.credited) {
      await admin.from("notifications").insert({
        user_id: input.userId,
        title: "Deposit confirmed",
        message: `$${amount.toFixed(2)} has been added to your wallet via ${methodName}.`,
        type: "success",
        is_read: false,
      });
    }
    return {
      credited: Boolean(row.credited),
      duplicate: Boolean(row.duplicate),
      newBalance: Number(row.new_balance ?? 0),
    };
  }

  if (!missingRpc) throw new Error(rpcError.message);

  const newBalance = await applyWalletCredit(admin, {
    userId: input.userId,
    amount: creditAmount,
    source: "deposit",
    description,
  });

  await ensureDepositRequest(admin, { ...input, amount });

  if (quote) {
    await settleDepositSideEffects(admin, {
      userId: input.userId,
      depositId: marker,
      quote,
      walletCredited: true,
    });
  } else {
    await admin.from("notifications").insert({
      user_id: input.userId,
      title: "Deposit confirmed",
      message: `$${amount.toFixed(2)} has been added to your wallet via ${methodName}.`,
      type: "success",
      is_read: false,
    });
  }

  return { credited: true, newBalance };
}

export async function reversePaydoraDeposit(input: {
  userId: string;
  amount: number;
  depositId: string;
}) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client unavailable");
  const amount = Math.round(input.amount * 100) / 100;
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
    return {
      reversed: Boolean(row.reversed),
      duplicate: Boolean(row.duplicate),
      newBalance: Number(row.new_balance ?? 0),
    };
  }
  if (!missingRpc) throw new Error(rpcError.message);

  const marker = `refund:${input.depositId}`;
  if (await alreadyApplied(admin, input.userId, marker)) return { reversed: false, duplicate: true };

  const { data: profile } = await admin
    .from("profiles")
    .select("wallet_balance")
    .eq("id", input.userId)
    .maybeSingle();

  const currentBalance = Number(profile?.wallet_balance || 0);
  const newBalance = Math.max(0, Math.round((currentBalance - amount) * 100) / 100);

  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update({ wallet_balance: newBalance })
    .eq("id", input.userId)
    .select("wallet_balance")
    .single();

  if (updateError) throw new Error(updateError.message);

  if (Math.abs(Number(updated?.wallet_balance) - newBalance) > 0.009) {
    throw new Error(
      "Wallet balance did not update. Run supabase/paydora-system-wallet-credit.sql in Supabase."
    );
  }

  const { error: txError } = await admin.from("wallet_transactions").insert({
    user_id: input.userId,
    amount,
    wallet_type: "current",
    transaction_type: "debit",
    source: "deposit",
    description: `Paydora refund $${amount.toFixed(2)} (${marker})`,
    created_by: null,
  });

  if (txError) throw new Error(txError.message);

  await admin
    .from("deposit_requests")
    .update({ status: "rejected", admin_notes: "Paydora refunded this deposit" })
    .eq("proof_url", paydoraProofPath(input.depositId));

  return { reversed: true, newBalance: Number(updated.wallet_balance) };
}
