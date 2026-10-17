import { createAdminClient } from "../supabase/admin";
import { getSupabaseServiceRoleKey } from "../supabase/env";
import {
  redactProviderMeta,
  type ClaimInput,
  type ClaimResult,
  type TransferCounts,
  type TransferProvider,
  type TransferState,
} from "./transfer-ledger";

function ledgerFailure(error: unknown, action: string): Error {
  const message = error instanceof Error ? error.message : "";
  if (/does not exist|schema cache|Could not find the function|relation .* does not exist/i.test(message)) {
    return new Error("Transfer ledger is not installed. This transfer was not sent.");
  }
  if (/timed out|timeout|fetch failed|network|ECONN|ENOTFOUND/i.test(message)) {
    return new Error(`Provider outcome unknown. Transfer ledger did not answer during ${action}. This transfer was not sent again.`);
  }
  return new Error(`Transfer ledger refused the ${action}. This transfer was not sent.`);
}

function admin() {
  if (!getSupabaseServiceRoleKey()) return null;
  return createAdminClient();
}

export class SupabaseTransferStore {
  async claim(input: ClaimInput): Promise<ClaimResult> {
    const db = admin();
    if (!db) throw new Error("Transfer ledger is not installed. This transfer was not sent.");
    const { data, error } = await db.rpc("claim_provider_transfer", {
      p_operation_key: input.operationKey,
      p_provider: input.provider,
      p_action: input.action,
      p_amount: input.amount,
      p_request_id: input.requestId,
      p_player_account: input.playerAccount,
      p_provider_transaction_id: input.providerTransactionId || null,
      p_provider_idempotent: input.providerIdempotent,
      p_request_meta: redactProviderMeta({
        action: input.action,
        amount: input.amount,
        account: input.playerAccount,
        providerTransactionId: input.providerTransactionId || null,
      }),
    });
    if (error) throw ledgerFailure(error, "claim");
    const decision = String(data || "");
    if (decision === "proceed" || decision === "hold" || decision === "already_recorded" || decision === "paused") {
      return { decision, state: decision === "paused" ? "paused" : null };
    }
    throw new Error("Transfer ledger refused the claim. This transfer was not sent.");
  }

  async markSubmitted(operationKey: string): Promise<boolean> {
    const db = admin();
    if (!db) throw new Error("Transfer ledger is not installed. This transfer was not sent.");
    const { data, error } = await db.rpc("mark_provider_transfer_submitted", { p_operation_key: operationKey });
    if (error) throw ledgerFailure(error, "submit");
    return data === true;
  }

  async finish(
    operationKey: string,
    outcome: "failed" | "unknown" | "manual_review",
    meta: Record<string, unknown>
  ): Promise<void> {
    const db = admin();
    if (!db) throw new Error("Provider outcome unknown. Transfer ledger did not answer during finish. This transfer was not sent again.");
    const { error } = await db.rpc("finish_provider_transfer", {
      p_operation_key: operationKey,
      p_outcome: outcome,
      p_response_meta: redactProviderMeta(meta),
    });
    if (error) throw ledgerFailure(error, "finish");
  }

  async confirm(operationKey: string): Promise<boolean> {
    const db = admin();
    if (!db) return false;
    const { data, error } = await db.rpc("confirm_provider_transfer", { p_operation_key: operationKey });
    if (error) return false;
    return data === true;
  }

  async reconcile(operationKey: string, decision: "confirmed" | "failed", note: string): Promise<boolean> {
    const db = admin();
    if (!db) return false;
    const { data, error } = await db.rpc("reconcile_provider_transfer", {
      p_operation_key: operationKey,
      p_decision: decision,
      p_note: note,
    });
    if (error) throw ledgerFailure(error, "reconciliation");
    return data === true;
  }

  async setPaused(provider: TransferProvider, paused: boolean, reason: string): Promise<void> {
    const db = admin();
    if (!db) throw new Error("Transfer ledger is not installed. Pause was not saved.");
    const { error } = await db.rpc("set_provider_automation_paused", {
      p_provider: provider,
      p_paused: paused,
      p_reason: reason,
    });
    if (error) throw ledgerFailure(error, "pause");
  }

  async counts(): Promise<TransferCounts> {
    const empty: TransferCounts = { installed: false, pending: null, submitted: null, unknown: null, manualReview: null };
    const db = admin();
    if (!db) return empty;
    const { data, error } = await db.from("provider_transfer_operations").select("state");
    if (error) return empty;
    const counts = { installed: true, pending: 0, submitted: 0, unknown: 0, manualReview: 0 };
    for (const row of (data || []) as { state: TransferState }[]) {
      if (row.state === "pending") counts.pending += 1;
      if (row.state === "submitted") counts.submitted += 1;
      if (row.state === "unknown") counts.unknown += 1;
      if (row.state === "manual_review") counts.manualReview += 1;
    }
    return counts;
  }
}

export function getTransferStore(): SupabaseTransferStore {
  return new SupabaseTransferStore();
}
