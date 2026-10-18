import "server-only";

import { adminDb } from "@/lib/actions/admin/core";
import { parseExplorerQuery, sortTrace, type TraceEvent } from "@/lib/admin/transaction-explorer";

type Row = Record<string, unknown>;

function text(value: unknown) {
  return value == null ? "" : String(value);
}

export async function loadTransactionTrace(rawQuery: string | null | undefined) {
  const query = parseExplorerQuery(rawQuery);
  if (query.kind === "empty") return { query, events: [] as TraceEvent[], players: [] as string[] };
  const db = adminDb();
  const events: TraceEvent[] = [];
  const players = new Set<string>();

  if (query.kind === "text") {
    const { data: byLogin } = await db
      .from("game_load_requests")
      .select("user_id")
      .ilike("game_username", query.text)
      .limit(8);
    for (const row of (byLogin ?? []) as Row[]) players.add(text(row.user_id));
    const { data } = await db
      .from("profiles")
      .select("id, full_name, email")
      .or(`email.ilike.%${query.text}%,full_name.ilike.%${query.text}%`)
      .limit(8);
    for (const row of (data ?? []) as Row[]) {
      players.add(text(row.id));
      events.push({
        at: new Date(0).toISOString(),
        group: "request",
        title: text(row.full_name) || "Player",
        detail: text(row.email),
        evidence: "profiles",
        verified: true,
      });
    }
  }

  const userIds = [...players];
  const uuid = query.kind === "uuid" ? query.id : null;

  const walletQuery = db
    .from("wallet_transactions")
    .select("id, user_id, amount, wallet_type, transaction_type, source, description, created_at")
    .order("created_at", { ascending: false })
    .limit(40);
  const loadsQuery = db
    .from("game_load_requests")
    .select("id, user_id, amount, load_type, status, game_slug, game_username, error_message, wallet_refunded, game_api_debited, created_at")
    .order("created_at", { ascending: false })
    .limit(40);
  const depositsQuery = db
    .from("deposit_requests")
    .select("id, user_id, amount, status, payment_method, proof_url, wallet_credited, admin_notes, created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  const [wallet, loads, deposits, payouts, intents] = await Promise.all([
    uuid
      ? walletQuery.or(`id.eq.${uuid},user_id.eq.${uuid}`)
      : userIds.length
        ? walletQuery.in("user_id", userIds)
        : Promise.resolve({ data: [] }),
    uuid
      ? loadsQuery.or(`id.eq.${uuid},user_id.eq.${uuid}`)
      : userIds.length
        ? loadsQuery.in("user_id", userIds)
        : Promise.resolve({ data: [] }),
    uuid
      ? depositsQuery.or(`id.eq.${uuid},user_id.eq.${uuid}`)
      : userIds.length
        ? depositsQuery.in("user_id", userIds)
        : Promise.resolve({ data: [] }),
    uuid
      ? db.from("paydora_payout_requests").select("id, user_id, amount, status, created_at").or(`id.eq.${uuid},user_id.eq.${uuid}`).limit(20)
      : userIds.length
        ? db.from("paydora_payout_requests").select("id, user_id, amount, status, created_at").in("user_id", userIds).limit(20)
        : Promise.resolve({ data: [] }),
    uuid
      ? db.from("payment_intents").select("id, user_id, external_id, base_amount, status, created_at").or(`id.eq.${uuid},user_id.eq.${uuid},external_id.eq.${uuid}`).limit(20)
      : query.kind === "text"
        ? db.from("payment_intents").select("id, user_id, external_id, base_amount, status, created_at").ilike("external_id", `%${query.text}%`).limit(20)
        : Promise.resolve({ data: [] }),
  ]);

  for (const row of (wallet.data ?? []) as Row[]) {
    events.push({
      at: text(row.created_at),
      group: "wallet",
      title: `${text(row.transaction_type)} $${Number(row.amount).toFixed(2)}`,
      detail: `${text(row.source)} · ${text(row.wallet_type)} · ${text(row.description)}`,
      evidence: `wallet_transactions ${text(row.id)}`,
      verified: true,
    });
  }
  for (const row of (loads.data ?? []) as Row[]) {
    const refunded = row.wallet_refunded === true;
    events.push({
      at: text(row.created_at),
      group: "request",
      title: `${text(row.load_type)} $${Number(row.amount ?? 0).toFixed(2)} · ${text(row.status)}`,
      detail: `${text(row.game_slug)} · ${text(row.game_username)} · refund saved: ${refunded ? "yes" : "no"}`,
      evidence: `game_load_requests ${text(row.id)}`,
      verified: refunded || row.status === "completed",
    });
  }
  for (const row of (deposits.data ?? []) as Row[]) {
    events.push({
      at: text(row.created_at),
      group: "request",
      title: `Deposit $${Number(row.amount ?? 0).toFixed(2)} · ${text(row.status)}`,
      detail: `${text(row.payment_method)} · wallet credited: ${row.wallet_credited ? "yes" : "no"}`,
      evidence: `deposit_requests ${text(row.id)}`,
      verified: Boolean(row.wallet_credited),
    });
  }
  for (const row of (payouts.data ?? []) as Row[]) {
    const status = text(row.status);
    events.push({
      at: text(row.created_at),
      group: "payout",
      title: `Payout $${Number(row.amount ?? 0).toFixed(2)} · ${status || "no status"}`,
      detail: status.toLowerCase() === "paid" ? "Stored status is paid." : "Stored status is not treated as paid.",
      evidence: `paydora_payout_requests ${text(row.id)}`,
      verified: status.toLowerCase() === "paid",
    });
  }
  for (const row of (intents.data ?? []) as Row[]) {
    events.push({
      at: text(row.created_at),
      group: "provider",
      title: `Payment intent $${Number(row.base_amount ?? 0).toFixed(2)}`,
      detail: `Stored status: ${text(row.status) || "none"}`,
      evidence: `payment_intents ${text(row.id)}`,
      verified: false,
    });
  }

  const dated = events.filter((event) => event.at && !event.at.startsWith("1970"));
  const headers = events.filter((event) => event.at.startsWith("1970"));
  return { query, events: [...headers, ...sortTrace(dated)], players: [...players] };
}
