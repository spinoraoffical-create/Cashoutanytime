export type LoadAlertRow = {
  id: string;
  amount: number | null;
  load_type: string;
  status: string;
  wallet_refunded: boolean | null;
  game_api_debited: boolean | null;
  error_message: string | null;
  created_at: string;
  game_username: string | null;
  user_id?: string;
};

const UNKNOWN_OUTCOME = /timed out|timeout|needs review|outcome unknown|socket hang up/i;
const CONFIRMED_AGENT_REJECT = /code 6|insufficient agent balance/i;

/** A confirmed agent-balance rejection with no saved refund flag. */
export function rejectedLoadMissingRefund(row: LoadAlertRow, now = Date.now()): boolean {
  void now;
  if (row.load_type !== "load" && row.load_type !== "reload") return false;
  if (row.wallet_refunded === true || row.game_api_debited === true) return false;
  if (!(Number(row.amount) > 0)) return false;
  const message = row.error_message ?? "";
  if (!CONFIRMED_AGENT_REJECT.test(message)) return false;
  if (UNKNOWN_OUTCOME.test(message) && !CONFIRMED_AGENT_REJECT.test(message)) return false;
  return true;
}

export function stuckOpenLoad(row: LoadAlertRow, now = Date.now()): boolean {
  if (row.status !== "pending" && row.status !== "processing") return false;
  const created = Date.parse(row.created_at);
  if (!Number.isFinite(created)) return false;
  return now - created > 30 * 60 * 1000;
}

export function depositMissingCredit(input: {
  webhookStatus: string | null;
  eventName: string | null;
  ledgerCredit: boolean;
}): boolean {
  return input.eventName === "deposit.paid" && input.webhookStatus === "processed" && !input.ledgerCredit;
}

export function uncertainProviderMessage(message: string | null | undefined): boolean {
  const text = message?.trim() ?? "";
  if (!text) return false;
  return UNKNOWN_OUTCOME.test(text) && !CONFIRMED_AGENT_REJECT.test(text);
}

export type OwnerLoadState =
  | "Requested"
  | "Processing"
  | "Provider confirmed"
  | "Provider rejected"
  | "Outcome unknown"
  | "Refunded"
  | "Completed"
  | "Reconciliation required";

/** Display label only. Stored status values stay unchanged. */
export function ownerLoadState(row: LoadAlertRow): OwnerLoadState {
  if (row.wallet_refunded === true) return "Refunded";
  if (rejectedLoadMissingRefund(row)) return "Reconciliation required";
  if (
    uncertainProviderMessage(row.error_message) &&
    (row.status === "pending" || row.status === "processing")
  ) {
    return "Outcome unknown";
  }
  if (row.status === "completed" && row.game_api_debited === true) return "Provider confirmed";
  if (row.status === "completed") return "Completed";
  if (row.status === "failed" || row.status === "cancelled") return "Provider rejected";
  if (row.status === "processing") return "Processing";
  return "Requested";
}

export function duplicateDescriptions(
  rows: Array<{ userId: string; amount: number; description: string }>
): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const description = row.description.trim();
    if (!description) continue;
    const key = `${row.userId}|${row.amount.toFixed(2)}|${description}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
}

export function duplicatePayoutPairs(
  rows: Array<{ id: string; userId: string; amount: number; createdAt: string; status: string }>
): string[] {
  const open = rows
    .filter((row) => row.status !== "failed" && row.status !== "paid")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ids: string[] = [];
  for (let i = 1; i < open.length; i += 1) {
    const prev = open[i - 1];
    const row = open[i];
    if (prev.userId !== row.userId || prev.amount !== row.amount) continue;
    const gap = Date.parse(row.createdAt) - Date.parse(prev.createdAt);
    if (gap >= 0 && gap <= 60_000) ids.push(row.id);
  }
  return ids;
}

export function debitMissingLoad(matchingLoads: number): boolean {
  return matchingLoads === 0;
}

export function refundFlagWithoutLedger(input: { walletRefunded: boolean; ledgerRows: number }): boolean {
  return input.walletRefunded && input.ledgerRows === 0;
}
