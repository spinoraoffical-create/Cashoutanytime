"use server";

import { authorize, adminDb } from "@/lib/actions/admin/core";

/** Sidebar badge counts — loaded after admin shell paints (not blocking layout). */
export async function getAdminSidebarBadgesAction(): Promise<
  { ok: true; badges: Record<string, number> } | { ok: false }
> {
  const auth = await authorize("requests.manage");
  if ("error" in auth) return { ok: false };

  try {
    const db = adminDb();
    const [pendingReq, cashoutOwed, pendingDeposits, pendingLoads] = await Promise.all([
      db.from("requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("profiles").select("id", { count: "exact", head: true }).gt("cashout_wallet", 0),
      db
        .from("deposit_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "processing"]),
      db
        .from("game_load_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "processing"]),
    ]);

    const badges: Record<string, number> = {};
    if (pendingReq.count) badges["/admin/requests"] = pendingReq.count;
    if (cashoutOwed.count) badges["/admin/payouts"] = cashoutOwed.count;
    if (pendingDeposits.count) badges["/admin/deposits"] = pendingDeposits.count;
    if (pendingLoads.count) badges["/admin/game-loads"] = pendingLoads.count;

    return { ok: true, badges };
  } catch {
    return { ok: false };
  }
}
