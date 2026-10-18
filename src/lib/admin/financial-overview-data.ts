import "server-only";

import { adminDb } from "@/lib/actions/admin/core";
import {
  rejectedLoadMissingRefund,
  stuckOpenLoad,
  uncertainProviderMessage,
  type LoadAlertRow,
} from "@/lib/admin/reconciliation-rules";

export type OverviewMetric = {
  label: string;
  definition: string;
  value: string | null;
  error: string | null;
};

const WINDOW = "Last 7 days, UTC.";

function money(count: number, sum: number) {
  return `${count} · $${sum.toFixed(2)}`;
}

function sumAmount(rows: { amount?: number | string | null }[] | null) {
  return (rows ?? []).reduce((total, row) => total + Number(row.amount ?? 0), 0);
}

export async function loadFinancialOverview(): Promise<OverviewMetric[]> {
  const db = adminDb();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const metrics: OverviewMetric[] = [];

  async function read(
    label: string,
    definition: string,
    query: PromiseLike<{ data: { amount?: number | string | null }[] | null; error: { message: string } | null }>
  ) {
    const result = await query;
    if (result.error) {
      metrics.push({ label, definition, value: null, error: "Could not calculate this figure." });
      return;
    }
    const rows = result.data ?? [];
    metrics.push({ label, definition, value: money(rows.length, sumAmount(rows)), error: null });
  }

  await read("Verified deposit credits", `${WINDOW} Payment-ledger credits. This is not the text "Paid online".`, db.from("paydora_processed_events").select("amount").eq("direction", "credit").gte("created_at", since).limit(500));
  await read("Deposit wallet credits", `${WINDOW} Wallet rows with source deposit and type credit.`, db.from("wallet_transactions").select("amount").eq("source", "deposit").eq("transaction_type", "credit").gte("created_at", since).limit(500));
  await read("Completed game loads", `${WINDOW} Load and reload requests marked completed.`, db.from("game_load_requests").select("amount").in("load_type", ["load", "reload"]).eq("status", "completed").gte("created_at", since).limit(500));
  await read("Completed redeems", `${WINDOW} Redeem requests marked completed.`, db.from("game_load_requests").select("amount").eq("load_type", "redeem").eq("status", "completed").gte("created_at", since).limit(500));
  await read("Confirmed payouts", `${WINDOW} Payout rows whose stored status is paid.`, db.from("paydora_payout_requests").select("amount").eq("status", "paid").gte("created_at", since).limit(500));
  await read("Open payouts", `${WINDOW} Requested, reserved, submitted, or manual review. These are not paid.`, db.from("paydora_payout_requests").select("amount").in("status", ["requested", "reserved", "submitted", "manual_review"]).gte("created_at", since).limit(500));

  const holds = await db.from("cashout_holds").select("amount").eq("status", "held").limit(500);
  metrics.push(holds.error
    ? { label: "Held cash outs", definition: "Current rows marked held. Not limited to 7 days.", value: null, error: "Could not calculate this figure." }
    : { label: "Held cash outs", definition: "Current rows marked held. Not limited to 7 days.", value: money((holds.data ?? []).length, sumAmount(holds.data)), error: null });

  const failures = await db.from("game_load_requests").select("amount").eq("status", "failed").gte("created_at", since).limit(500);
  metrics.push(failures.error
    ? { label: "Provider failures", definition: `${WINDOW} Game requests stored as failed.`, value: null, error: "Could not calculate this figure." }
    : { label: "Provider failures", definition: `${WINDOW} Game requests stored as failed.`, value: money((failures.data ?? []).length, sumAmount(failures.data)), error: null });

  const openLoads = await db
    .from("game_load_requests")
    .select("id, amount, load_type, status, wallet_refunded, game_api_debited, error_message, created_at, game_username")
    .gte("created_at", since)
    .limit(500);
  if (openLoads.error) {
    metrics.push({ label: "Pending refunds", definition: `${WINDOW} Confirmed provider rejections with no saved refund flag.`, value: null, error: "Could not calculate this figure." });
    metrics.push({ label: "Unresolved discrepancies", definition: `${WINDOW} Pending refunds, unknown provider results, and requests open longer than 30 minutes.`, value: null, error: "Could not calculate this figure." });
  } else {
    const rows = (openLoads.data ?? []) as LoadAlertRow[];
    const pendingRefunds = rows.filter((row) => rejectedLoadMissingRefund(row));
    const unresolved = rows.filter((row) => rejectedLoadMissingRefund(row) || uncertainProviderMessage(row.error_message) || stuckOpenLoad(row));
    metrics.push({ label: "Pending refunds", definition: `${WINDOW} Confirmed provider rejections with no saved refund flag. This is a count of rows, not a refund.`, value: money(pendingRefunds.length, sumAmount(pendingRefunds)), error: null });
    metrics.push({ label: "Unresolved discrepancies", definition: `${WINDOW} Pending refunds, unknown provider results, and requests open longer than 30 minutes. Capped at 500 rows.`, value: money(unresolved.length, sumAmount(unresolved)), error: null });
  }

  return metrics;
}
