import "server-only";

import { adminDb } from "@/lib/actions/admin/core";
import { keptParent } from "@/lib/offers/audience";

/** Attach a new player to the sub-creator or store creator who owns this code. */
export async function assignPlayerToAgentByCode(playerId: string, rawCode: string | null | undefined) {
  const code = rawCode?.trim();
  if (!code) return;
  try {
    const db = adminDb();
    const { data: agent, error } = await db
      .from("agent_accounts")
      .select("user_id, active")
      .ilike("promo_code", code)
      .maybeSingle();
    if (error || !agent || agent.active === false || agent.user_id === playerId) return;

    const { data: profile } = await db
      .from("profiles")
      .select("parent_agent_id")
      .eq("id", playerId)
      .maybeSingle();
    if (keptParent(profile?.parent_agent_id, agent.user_id) !== agent.user_id) return;

    await db
      .from("profiles")
      .update({ parent_agent_id: agent.user_id })
      .eq("id", playerId)
      .is("parent_agent_id", null);
  } catch {
    // The network table is optional until the migration is applied.
  }
}
