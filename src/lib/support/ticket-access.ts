import "server-only";

import { adminDb } from "@/lib/actions/admin/core";
import { getAgentScope } from "@/lib/agents/scope";
import { can, getStaffContext } from "@/lib/data/admin";

/** Tickets stay with Super Admin. A store or sub-creator row never opens that page. */
export async function platformTicketAccess() {
  const ctx = await getStaffContext();
  const scope = await getAgentScope();
  let tier: string | null = null;
  if (ctx) {
    const { data } = await adminDb()
      .from("agent_accounts")
      .select("tier")
      .eq("user_id", ctx.userId)
      .eq("active", true)
      .maybeSingle();
    tier = (data as { tier?: string } | null)?.tier ?? null;
  }
  const isSub = tier === "sub_creator" || scope?.level === "sub";
  const isStore = tier === "store_creator" || scope?.level === "store";
  const tickets = Boolean(ctx?.isSuperAdmin && !isSub && !isStore);
  const allowed = Boolean(ctx && (ctx.isSuperAdmin || can(ctx, "support.manage")) && !isSub && !isStore);
  return { allowed, tickets, isSub, isStore };
}
