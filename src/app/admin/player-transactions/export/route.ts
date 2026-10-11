import { NextResponse } from "next/server";

import { moneyLabel } from "@/lib/admin/player-transactions";
import { loadPlayerTransactions } from "@/lib/admin/player-transactions-data";
import { toCsv } from "@/lib/agents/csv";
import { getAgentScope } from "@/lib/agents/scope";

export async function GET(request: Request) {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const url = new URL(request.url);
  const loaded = await loadPlayerTransactions(scope, {
    tab: url.searchParams.get("tab") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    store: url.searchParams.get("store") ?? undefined,
  });
  const recharge = loaded.query.kind === "recharge";
  const csv = toCsv(
    recharge
      ? ["Player", "Email", "Game", "Date", "Status", "Collected", "Credit spent"]
      : ["Player", "Email", "Game", "Date", "Status", "Amount"],
    loaded.rows.map((row) =>
      recharge
        ? [row.playerName, row.email, row.game, row.createdAt, row.status, moneyLabel(row.collected), moneyLabel(row.creditSpent)]
        : [row.playerName, row.email, row.game, row.createdAt, row.status, moneyLabel(row.redeemAmount)]
    )
  );
  const filename = recharge ? "recharge-records.csv" : "redeem-records.csv";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
