"use server";

import { revalidatePath } from "next/cache";

import { adminListScope } from "@/lib/admin/list-scope";
import { playerInScope, readAgentScope } from "@/lib/agents/scope";
import { getStaffContext } from "@/lib/data/admin";
import { partialAuditResult, payoutOperatorMessage } from "@/lib/admin/audit-result";
import { realValueDenial } from "@/lib/compliance/real-value";
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

  const ctx = await getStaffContext();
  const scopeRead = await readAgentScope();
  const decision = adminListScope({
    isSuperAdmin: Boolean(ctx?.isSuperAdmin),
    hasStaffPermission: true,
    scopeStatus: scopeRead.status,
    scope: scopeRead.scope,
  });
  const stopped = realValueDenial("payouts");
  if (stopped) return { ok: false, error: stopped };
  if (decision.mode === "deny") return { ok: false, error: "You cannot pay this player." };
  if (decision.mode === "network") {
    if (!scopeRead.scope || !(await playerInScope(scopeRead.scope, userId))) {
      return { ok: false, error: "That player is outside your network." };
    }
  }

  const db = adminDb();
  const { data: newBalance, error } = await db.rpc("admin_payout_cashout", {
    p_user: userId,
    p_amount: amount,
    p_note: note || null,
  });

  if (error) return { ok: false, error: payoutOperatorMessage(error.message) };

  const audited = await writeAudit({
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

  const { safePaymentAlert } = await import("@/lib/telegram/control/safe-emit");
  const routed = await safePaymentAlert({
    category: "payout_requested",
    eventKey: `admin-cashout:${userId}:${amount}:${Date.now()}`,
    source: "admin",
    reference: userId,
    amount,
    detail: "Staff recorded a cash-out in the admin panel.",
    adminPath: "/admin/payouts",
  });
  if (routed !== "handled") {
    await tgNotify("finance", `💸 <b>Admin cash-out record</b>\n$${amount.toFixed(2)} to ${tgEsc(userId)}${note ? `\n${tgEsc(note)}` : ""}\nThis is not a provider confirmation.\n${adminLink("/admin/payouts", "👉 View Payouts")}`);
  }
  revalidatePath("/admin/payouts");
  return {
    ok: true,
    message: `Paid out $${amount.toFixed(2)}. Remaining cash-out: $${Number(newBalance).toFixed(2)}.`,
    ...partialAuditResult(audited),
  };
}
