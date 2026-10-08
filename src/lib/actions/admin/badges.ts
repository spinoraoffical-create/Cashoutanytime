"use server";

import { adminDb } from "@/lib/actions/admin/core";
import { can, getStaffContext } from "@/lib/data/admin";

/** Sidebar badge counts — loaded after the admin shell paints. */
export async function getAdminSidebarBadgesAction(): Promise<
  { ok: true; badges: Record<string, number> } | { ok: false }
> {
  const ctx = await getStaffContext();
  if (!ctx) return { ok: false };

  try {
    const db = adminDb();
    const badges: Record<string, number> = {};

    if (can(ctx, "requests.manage")) {
      const [pendingDeposits, pendingLoads, cashoutOwed, manualRequests] = await Promise.all([
        db.from("deposit_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]),
        db.from("game_load_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]),
        db.from("profiles").select("id", { count: "exact", head: true }).gt("cashout_wallet", 0),
        db.from("requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      if (pendingDeposits.count) badges["/admin/deposits"] = pendingDeposits.count;
      if (pendingLoads.count) badges["/admin/game-loads"] = pendingLoads.count;
      if (cashoutOwed.count) badges["/admin/payouts"] = cashoutOwed.count;
      if (manualRequests.count) badges["/admin/requests"] = manualRequests.count;
      const money =
        (pendingDeposits.count ?? 0) + (pendingLoads.count ?? 0) + (cashoutOwed.count ?? 0);
      if (money) badges["/admin/money"] = money;
    }

    if (can(ctx, "support.manage")) {
      const openTickets = await db
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "pending", "in_progress"]);
      if (openTickets.count) badges["/admin/support"] = openTickets.count;
    }

    if (ctx.isSuperAdmin) {
      const fraud = await db
        .from("fraud_scores")
        .select("user_id", { count: "exact", head: true })
        .or("rewards_blocked.eq.true,blocked.eq.true,manual_review.eq.true,risk_score.gte.50");
      if (!fraud.error && fraud.count) badges["/admin/fraud"] = fraud.count;
    }

    return { ok: true, badges };
  } catch {
    return { ok: false };
  }
}
