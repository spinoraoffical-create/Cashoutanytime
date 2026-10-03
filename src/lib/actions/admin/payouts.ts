"use server";

import { revalidatePath } from "next/cache";

import { adminDb, authorize, writeAudit, type AdminActionResult } from "./core";
import { adminLink, tgEsc, tgNotify } from "@/lib/telegram";

/**
 * Record a cash-out payout: debit the player's cash-out wallet (atomic, in SQL)
 * and append a ledger row. The operator pays the player off-platform; this just
 * reconciles the on-site balance. Money safety lives in admin_payout_cashout
 * (raises on insufficient balance).
 */
export async function payoutCashout(formData: FormData): Promise<AdminActionResult> {
  const auth = await authorize("requests.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const userId = String(formData.get("user_id") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const note = String(formData.get("note") ?? "").trim();

  if (!userId) return { ok: false, error: "Missing player." };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter a payout amount greater than $0." };
  }

  const db = adminDb();
  const { data: newBalance, error } = await db.rpc("admin_payout_cashout", {
    p_user: userId,
    p_amount: amount,
    p_note: note || null,
  });

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actorId: auth.staff.userId,
    action: "cashout.payout",
    entityType: "profile",
    entityId: userId,
    after: { amount, balance_after: newBalance, note: note || null },
  });

  // Best-effort player notification.
  await db.from("notifications").insert({
    user_id: userId,
    type: "system",
    icon: "banknote",
    title: "Cash-out paid",
    body: `$${amount.toFixed(2)} from your cash-out balance has been paid out${note ? ` — ${note}` : "."}`,
  });

  await tgNotify("finance", `💸 <b>Cashout paid</b>\n$${amount.toFixed(2)} to ${tgEsc(userId)}${note ? `\n${tgEsc(note)}` : ""}\n${adminLink("/admin/payouts", "👉 View Payouts")}`);
  revalidatePath("/admin/payouts");
  return { ok: true, message: `Paid out $${amount.toFixed(2)}. Remaining cash-out: $${Number(newBalance).toFixed(2)}.` };
}
