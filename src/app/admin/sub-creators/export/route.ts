import { NextResponse } from "next/server";

import { loadAgentRows } from "@/lib/actions/agents";
import { toCsv } from "@/lib/agents/csv";
import { getAgentScope } from "@/lib/agents/scope";

export async function GET(request: Request) {
  const scope = await getAgentScope();
  if (!scope || scope.level === "sub") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const url = new URL(request.url);
  const loaded = await loadAgentRows({
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
  });
  const csv = toCsv(
    ["Name", "Email", "Phone", "Role", "Wallet", "Registered", "Manager", "Status", "Code", "Players"],
    loaded.rows.map((row) => [
      row.name,
      row.email,
      row.phone,
      row.roleLabel,
      row.wallet.toFixed(2),
      row.createdAt,
      row.managerName,
      row.active ? "active" : "inactive",
      row.promoCode,
      String(row.playerCount),
    ])
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=sub-creators.csv",
    },
  });
}
