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
  });
  const csv = toCsv(
    ["Name", "Email", "Parent", "Wallet", "Joined"],
    loaded.rows.map((row) => [row.name, row.email, row.parentName, row.wallet.toFixed(2), row.createdAt])
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=players.csv",
    },
  });
}
