import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** Awards nothing when the migration is absent, earning is off, or the task is off. */
export async function tryGrantLoyaltyCoins(userId: string, taskKey: string, eventKey: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    if (!admin || !userId) return false;
    const { data, error } = await admin.rpc("grant_loyalty_coins", {
      p_user: userId,
      p_task: taskKey,
      p_event: eventKey,
    });
    if (error) return false;
    return Number(data) > 0;
  } catch {
    return false;
  }
}
