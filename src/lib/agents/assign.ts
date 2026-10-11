import "server-only";

import { adminDb } from "@/lib/actions/admin/core";

/** Set parent_agent_id once, to the creator who owns this promo code. A sub-creator code stays on that sub-creator. */
export async function assignPlayerToAgentByCode(playerId: string, rawCode: string | null | undefined) {
  const code = rawCode?.trim();
  if (!code || !playerId) return;
  try {
    const db = adminDb();
    const { data: agent, error } = await db
      .from("agent_accounts")
      .select("user_id, active, promo_code")
      .ilike("promo_code", code)
      .maybeSingle();
    if (error || !agent || agent.active === false || agent.user_id === playerId) return;

    await db
      .from("profiles")
      .update({ parent_agent_id: agent.user_id })
      .eq("id", playerId)
      .is("parent_agent_id", null);
  } catch {
    // The network table is optional until the migration is applied.
  }
}
