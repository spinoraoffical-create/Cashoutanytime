import { NextResponse } from "next/server";

import { coinLabel, moneyLabel } from "@/lib/admin/player-transactions";
import { loadDailyPlayerReport, loadPlayerTransactions } from "@/lib/admin/player-transactions-data";
import { toCsv } from "@/lib/agents/csv";
import { getAgentScope } from "@/lib/agents/scope";

export async function GET(request: Request) {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const url = new URL(request.url);
  if (url.searchParams.get("tab") === "report") {
    const report = await loadDailyPlayerReport(scope, {
      day: url.searchParams.get("day") ?? undefined,
      store: url.searchParams.get("store") ?? undefined,
    });
    const csv = toCsv(
      ["Player", "Game", "Time", "Money received", "Coins loaded", "Coins redeemed", "Cash paid out"],
      report.rows.map((row) => [
        row.playerName,
        row.game,
        row.createdAt,
        moneyLabel(row.moneyReceived),
        coinLabel(row.coinsLoaded),
        coinLabel(row.coinsRedeemed),
        moneyLabel(row.cashPaidOut),
      ])
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=daily-report.csv",
      },
    });
  }
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
