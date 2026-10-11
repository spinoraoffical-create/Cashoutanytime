import "server-only";

import { adminDb } from "@/lib/actions/admin/core";
import { getAgentScope } from "@/lib/agents/scope";
import { can, getStaffContext } from "@/lib/data/admin";

/** Player tickets stay with Super Admin or staff who have support.manage. A store or sub-creator never lists them. */
export async function platformTicketAccess() {
  const ctx = await getStaffContext();
  const scope = await getAgentScope();
  let tier: string | null = null;
  if (ctx && !ctx.isSuperAdmin) {
    const { data } = await adminDb()
      .from("agent_accounts")
      .select("tier")
      .eq("user_id", ctx.userId)
      .eq("active", true)
      .maybeSingle();
    tier = (data as { tier?: string } | null)?.tier ?? null;
  }
  const isSub = Boolean(
    !ctx?.isSuperAdmin &&
      (scope?.level === "sub" || tier === "sub_creator" || ctx?.roles.includes("sub_creator"))
  );
  const isStore = Boolean(
    !ctx?.isSuperAdmin &&
      (scope?.level === "store" || tier === "store_creator" || ctx?.roles.includes("store_creator"))
  );
  const allowed = Boolean(ctx && (ctx.isSuperAdmin || can(ctx, "support.manage")) && !isSub && !isStore);
  return { allowed, isSub, isStore };
}
