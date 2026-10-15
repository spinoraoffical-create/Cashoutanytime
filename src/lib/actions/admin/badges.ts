"use server";

import { adminDb } from "@/lib/actions/admin/core";
import { GAME_LOAD_OPEN_STATUSES } from "@/lib/admin/game-load-status";
import { can, getStaffContext } from "@/lib/data/admin";
import { platformTicketAccess } from "@/lib/support/ticket-access";
import { countOpenTickets } from "@/lib/support/ticket-store";

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
      const [pendingDeposits, pendingLoads, openPayouts] = await Promise.all([
        db.from("deposit_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]),
        db.from("game_load_requests").select("id", { count: "exact", head: true }).in("status", [...GAME_LOAD_OPEN_STATUSES]),
        db
          .from("paydora_payout_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["requested", "reserved", "submitted", "manual_review"]),
      ]);
      if (!pendingDeposits.error && pendingDeposits.count) badges["/admin/deposits"] = pendingDeposits.count;
      if (!pendingLoads.error && pendingLoads.count) badges["/admin/game-loads"] = pendingLoads.count;
      if (!openPayouts.error && openPayouts.count) badges["/admin/payout-operations"] = openPayouts.count;
    }

    const ticketAccess = await platformTicketAccess();
    if (ticketAccess.tickets) {
      const openTickets = await countOpenTickets();
      if (openTickets) badges["/admin/support"] = openTickets;
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
