import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

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
): Promise<{ ok: true } | { ok: false }> {
  const withdrawalId = input.withdrawalId?.trim() || "";
  if (!withdrawalId) return { ok: true };

  const { data, error } = await admin
    .from("paydora_payout_requests")
    .select("user_id, idempotency_key, status")
    .eq("provider_withdrawal_id", withdrawalId)
    .maybeSingle();
  if (error) return { ok: false };
  const row = data as { user_id?: string; idempotency_key?: string; status?: string } | null;
  if (!row?.user_id || !row.idempotency_key) return { ok: true };

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
    const { error: saveError } = await admin.rpc("record_paydora_payout_submitted", {
      p_user_id: row.user_id,
      p_idempotency_key: row.idempotency_key,
      p_withdrawal_id: withdrawalId,
      p_reference_id: input.referenceId ?? null,
      p_provider_status: "paid",
    });
    return saveError ? { ok: false } : { ok: true };
  }

  if (!failed) return { ok: true };

  const { error: failError } = await admin.rpc("fail_paydora_payout", {
    p_user_id: row.user_id,
    p_idempotency_key: row.idempotency_key,
  });
  return failError ? { ok: false } : { ok: true };
}
