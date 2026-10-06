import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const LEDGER_KINDS = new Set([
  "deposit",
  "game_load",
  "game_redeem",
  "refund",
  "adjustment",
  "payout",
]);

function ledgerKind(kind: string): string {
  return LEDGER_KINDS.has(kind) ? kind : "adjustment";
}

export async function creditCurrentWallet(
  userId: string,
  amount: number,
  kind: string,
  description?: string | null
): Promise<{ success?: boolean; error?: string }> {
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Invalid amount" };
  const admin = createAdminClient();
  if (!admin) return { error: "Could not update that wallet." };

  const { error } = await admin.rpc("credit_wallet", {
    p_user: userId,
    p_amount: amount,
    p_kind: ledgerKind(kind),
    p_desc: description ?? null,
  });
  if (error) {
    console.error("[wallet] credit:", error.message);
    return { error: "Could not update that wallet." };
  }
  return { success: true };
}

export async function debitCurrentWallet(
  userId: string,
  amount: number,
  kind: string,
  description?: string | null
): Promise<{ success?: boolean; error?: string }> {
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Invalid amount" };
  const admin = createAdminClient();
  if (!admin) return { error: "Could not update that wallet." };

  const { error } = await admin.rpc("debit_wallet", {
    p_user: userId,
    p_amount: amount,
    p_kind: ledgerKind(kind),
    p_desc: description ?? null,
  });
  if (error) {
    console.error("[wallet] debit:", error.message);
    const message = /insufficient/i.test(error.message)
      ? "Not enough balance in that wallet."
      : "Could not update that wallet.";
    return { error: message };
  }
  return { success: true };
}

export async function debitCashoutWallet(
  userId: string,
  amount: number,
  note?: string | null
): Promise<{ success?: boolean; error?: string }> {
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Invalid amount" };
  const admin = createAdminClient();
  if (!admin) return { error: "Could not update that wallet." };

  const { error } = await admin.rpc("admin_payout_cashout", {
    p_user: userId,
    p_amount: amount,
    p_note: note ?? null,
  });
  if (error) {
    console.error("[wallet] cashout debit:", error.message);
    const message = /insufficient/i.test(error.message)
      ? "Not enough balance in that wallet."
      : "Could not update that wallet.";
    return { error: message };
  }
  return { success: true };
}
