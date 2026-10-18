import "server-only";

import { adminDb } from "@/lib/actions/admin/core";
import {
  debitMissingLoad,
  depositMissingCredit,
  duplicateDescriptions,
  duplicatePayoutPairs,
  refundFlagWithoutLedger,
  rejectedLoadMissingRefund,
  stuckOpenLoad,
  uncertainProviderMessage,
  type LoadAlertRow,
} from "@/lib/admin/reconciliation-rules";

export type ReconciliationAlert = {
  id: string;
  severity: "high" | "review";
  title: string;
  detail: string;
  href: string;
};

export async function loadReconciliationAlerts(): Promise<{ alerts: ReconciliationAlert[]; errors: string[] }> {
  const db = adminDb();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const alerts: ReconciliationAlert[] = [];
  const errors: string[] = [];

  const { data: loads, error: loadError } = await db
    .from("game_load_requests")
    .select("id, user_id, amount, load_type, status, wallet_refunded, game_api_debited, error_message, created_at, game_username")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);
  if (loadError) errors.push("Game loads could not be checked.");

  for (const row of (loads ?? []) as LoadAlertRow[]) {
    if (rejectedLoadMissingRefund(row)) {
      alerts.push({
        id: `refund-${row.id}`,
        severity: "high",
        title: "Confirmed provider rejection with no saved refund",
        detail: `${row.game_username || "Player"} · $${Number(row.amount).toFixed(2)} · ${row.status}`,
        href: `/admin/transaction-explorer?q=${row.id}`,
      });
    } else if (stuckOpenLoad(row) || uncertainProviderMessage(row.error_message)) {
      alerts.push({
        id: `open-${row.id}`,
        severity: "review",
        title: uncertainProviderMessage(row.error_message) ? "Provider outcome not verified" : "Request still open",
        detail: `${row.game_username || "Player"} · $${Number(row.amount ?? 0).toFixed(2)} · ${row.status}`,
        href: `/admin/transaction-explorer?q=${row.id}`,
      });
    }
  }

  const refundedLoads = ((loads ?? []) as LoadAlertRow[]).filter((row) => row.wallet_refunded === true && row.user_id);
  if (refundedLoads.length) {
    const { data: refundTx, error: refundError } = await db
      .from("wallet_transactions")
      .select("user_id, amount, source")
      .eq("source", "game_load_refund")
      .in("user_id", [...new Set(refundedLoads.map((row) => row.user_id as string))])
      .limit(200);
    if (refundError) errors.push("Refund ledger rows could not be checked.");
    for (const row of refundedLoads) {
      const ledgerRows = ((refundTx ?? []) as { user_id: string; amount: number; source: string }[]).filter(
        (tx) => tx.user_id === row.user_id && Number(tx.amount) === Number(row.amount)
      ).length;
      if (refundFlagWithoutLedger({ walletRefunded: true, ledgerRows })) {
        alerts.push({
          id: `flag-${row.id}`,
          severity: "high",
          title: "Refund flag is set without a matching refund ledger row",
          detail: `${row.game_username || "Player"} · $${Number(row.amount ?? 0).toFixed(2)}`,
          href: `/admin/transaction-explorer?q=${row.id}`,
        });
      }
    }
  }

  const { data: paid, error: paidError } = await db
    .from("webhook_events")
    .select("event_key, event_name, status")
    .eq("event_name", "deposit.paid")
    .eq("status", "processed")
    .gte("created_at", since)
    .limit(50);
  if (paidError) errors.push("Paid deposit notices could not be checked.");
  const paidRows = (paid ?? []) as { event_key: string; event_name: string; status: string }[];
  const paidKeys = paidRows.map((row) => row.event_key).filter(Boolean);
  const { data: credits, error: creditError } = paidKeys.length
    ? await db.from("paydora_processed_events").select("payment_id").in("payment_id", paidKeys)
    : { data: [], error: null };
  if (creditError) errors.push("Deposit ledger rows could not be checked.");
  const credited = new Set(((credits ?? []) as { payment_id: string }[]).map((row) => row.payment_id));
  for (const row of paidRows) {
    if (depositMissingCredit({ webhookStatus: row.status, eventName: row.event_name, ledgerCredit: credited.has(row.event_key) })) {
      alerts.push({
        id: `deposit-${row.event_key}`,
        severity: "high",
        title: "Paid notice without a wallet credit record",
        detail: "The paid webhook is marked processed and the payment ledger has no matching credit.",
        href: `/admin/transaction-explorer?q=${encodeURIComponent(row.event_key)}`,
      });
    }
  }

  const { data: debits, error: debitError } = await db
    .from("wallet_transactions")
    .select("id, user_id, amount, created_at")
    .eq("source", "game_load")
    .eq("transaction_type", "debit")
    .gte("created_at", since)
    .limit(100);
  if (debitError) errors.push("Game-load debits could not be checked.");
  const debitRows = (debits ?? []) as { id: string; user_id: string; amount: number; created_at: string }[];
  const debitUserIds = [...new Set(debitRows.map((row) => row.user_id).filter(Boolean))];
  const { data: debitLoads, error: debitLoadError } = debitUserIds.length
    ? await db
        .from("game_load_requests")
        .select("user_id, amount, created_at")
        .in("user_id", debitUserIds)
        .gte("created_at", since)
        .limit(500)
    : { data: [], error: null };
  if (debitLoadError) errors.push("Loads linked to wallet debits could not be checked.");
  for (const debit of debitRows) {
    const match = ((debitLoads ?? []) as Array<{ user_id: string; amount: number; created_at: string }>).filter(
      (row) => row.user_id === debit.user_id && Number(row.amount) === Number(debit.amount) && row.created_at === debit.created_at
    ).length;
    if (debitMissingLoad(match)) {
      alerts.push({
        id: `debit-${debit.id}`,
        severity: "review",
        title: "Wallet debit without a game load saved at the same time",
        detail: `$${Number(debit.amount).toFixed(2)} left the deposit wallet with no load row at that timestamp.`,
        href: `/admin/transaction-explorer?q=${debit.id}`,
      });
    }
  }

  const { data: depositCredits, error: dupError } = await db
    .from("wallet_transactions")
    .select("user_id, amount, description")
    .eq("source", "deposit")
    .eq("transaction_type", "credit")
    .gte("created_at", since)
    .limit(200);
  if (dupError) errors.push("Deposit credits could not be checked for duplicates.");
  const duplicateKeys = duplicateDescriptions(
    ((depositCredits ?? []) as { user_id: string; amount: number; description: string | null }[]).map((row) => ({
      userId: row.user_id,
      amount: Number(row.amount),
      description: row.description ?? "",
    }))
  );
  for (const key of duplicateKeys) {
    alerts.push({
      id: `dup-${key}`,
      severity: "high",
      title: "Repeated deposit credit with the same description",
      detail: "Two wallet credits share a player, amount, and description in this window.",
      href: "/admin/reconciliation",
    });
  }

  const { data: payouts, error: payoutError } = await db
    .from("paydora_payout_requests")
    .select("id, user_id, amount, status, created_at")
    .gte("created_at", since)
    .limit(80);
  if (payoutError) errors.push("Payout rows could not be checked.");
  const payoutRows = (payouts ?? []) as { id: string; user_id: string; amount: number; status: string; created_at: string }[];
  for (const row of payoutRows.filter((item) => ["requested", "reserved", "submitted", "manual_review"].includes(item.status))) {
    alerts.push({
      id: `payout-${row.id}`,
      severity: "review",
      title: "Payout without a verified final outcome",
      detail: `$${Number(row.amount ?? 0).toFixed(2)} · stored status ${row.status}. Submitted is not paid.`,
      href: `/admin/payout-operations/${row.id}`,
    });
  }
  for (const id of duplicatePayoutPairs(payoutRows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    createdAt: row.created_at,
    status: row.status,
  })))) {
    alerts.push({
      id: `payout-dup-${id}`,
      severity: "high",
      title: "Two open payouts for the same player and amount within one minute",
      detail: "Review both rows before any payment is sent.",
      href: `/admin/payout-operations/${id}`,
    });
  }

  return { alerts: alerts.slice(0, 80), errors };
}
