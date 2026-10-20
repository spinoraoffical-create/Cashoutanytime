import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { payoutWebhookAlert } from "@/lib/telegram/control/rules";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export type PayoutReconcileResult =
  | { ok: false }
  | { ok: true; notify: null }
  | {
      ok: true;
      notify: "paid" | "failed";
      idempotencyKey: string;
      reference: string;
      amount: number | null;
    };

function payoutAmount(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

const FAILED = new Set(["failed", "rejected", "cancelled", "canceled", "expired", "refunded"]);
const PAID = new Set(["paid", "completed", "success", "succeeded"]);

export function isPaydoraWithdrawalEvent(event: string) {
  const name = event.trim().toLowerCase();
  return name.startsWith("withdrawal.") || name.startsWith("payout.");
}

/**
 * Records a later provider result for a cash-out that was already submitted.
 * A failure refunds once through fail_paydora_payout. An unknown status does not.
 */
export async function reconcilePaydoraWithdrawal(
  admin: Admin,
  input: { event: string; withdrawalId?: string | null; status?: string | null; referenceId?: string | null }
): Promise<PayoutReconcileResult> {
  const withdrawalId = input.withdrawalId?.trim() || "";
  if (!withdrawalId) return { ok: true, notify: null };

  const { data, error } = await admin
    .from("paydora_payout_requests")
    .select("user_id, idempotency_key, status, amount")
    .eq("provider_withdrawal_id", withdrawalId)
    .maybeSingle();
  if (error) return { ok: false };
  const row = data as { user_id?: string; idempotency_key?: string; status?: string; amount?: number | string | null } | null;
  if (!row?.user_id || !row.idempotency_key) return { ok: true, notify: null };

  const event = input.event.trim().toLowerCase();
  const status = (input.status || "").trim().toLowerCase();
  const paid = PAID.has(status) || event.endsWith(".paid") || event.endsWith(".completed");
  const failed =
    FAILED.has(status) ||
    event.endsWith(".failed") ||
    event.endsWith(".rejected") ||
    event.endsWith(".cancelled") ||
    event.endsWith(".canceled");

  if (paid) {
    const { data: saved, error: saveError } = await admin.rpc("record_paydora_payout_submitted", {
      p_user_id: row.user_id,
      p_idempotency_key: row.idempotency_key,
      p_withdrawal_id: withdrawalId,
      p_reference_id: input.referenceId ?? null,
      p_provider_status: "paid",
    });
    if (saveError) return { ok: false };
    const decision = payoutWebhookAlert({
      kind: "paid",
      rpc: (saved ?? null) as { updated?: boolean; status?: string } | null,
    });
    if (decision.notify !== "paid") return { ok: true, notify: null };
    return {
      ok: true,
      notify: "paid",
      idempotencyKey: row.idempotency_key,
      reference: withdrawalId,
      amount: payoutAmount(row.amount),
    };
  }

  if (!failed) return { ok: true, notify: null };

  const { data: failedResult, error: failError } = await admin.rpc("fail_paydora_payout", {
    p_user_id: row.user_id,
    p_idempotency_key: row.idempotency_key,
  });
  if (failError) return { ok: false };
  const decision = payoutWebhookAlert({
    kind: "failed",
    priorStatus: row.status,
    rpc: (failedResult ?? null) as { status?: string; duplicate?: boolean } | null,
  });
  if (decision.notify !== "failed") return { ok: true, notify: null };
  return {
    ok: true,
    notify: "failed",
    idempotencyKey: row.idempotency_key,
    reference: withdrawalId,
    amount: payoutAmount(row.amount),
  };
}
