import { NextResponse } from "next/server";

import { loadNetworkPlayers } from "@/lib/actions/agents";
import { toCsv } from "@/lib/agents/csv";
import { getAgentScope } from "@/lib/agents/scope";

export async function GET(request: Request) {
  const scope = await getAgentScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const url = new URL(request.url);
  const loaded = await loadNetworkPlayers({
    q: url.searchParams.get("q") ?? undefined,
    parentId: url.searchParams.get("parent") ?? undefined,
    exportAll: true,
  });
  const csv = toCsv(
    ["Name", "Phone", "Email", "Sub-creator", "Store", "Wallet", "Cash-out", "Coins", "Level", "Joined", "Status"],
    loaded.rows.map((row) => [
      row.name,
      row.phone,
      row.email,
      row.subCreator,
      row.store,
      row.wallet.toFixed(2),
      row.cashout.toFixed(2),
      String(row.coins),
      row.level == null ? "—" : String(row.level),
      row.createdAt,
      row.status,
    ])
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=players.csv",
    },
  });
}
