import "server-only";

import { createClient } from "@/lib/supabase/server";
import { WELCOME_COIN_TASKS } from "@/lib/rewards/loyalty-coins";

type Row = { task_key?: string; key?: string; coins?: number; enabled?: boolean; created_at?: string; kind?: string; period_key?: string };

async function readTable(table: string, userId?: string): Promise<{ rows: Row[]; missing: boolean }> {
  const supabase = await createClient();
  const query = supabase.from(table as "reward_claims").select("*");
  const result = userId ? await query.eq("user_id", userId) : await query;
  if (result.error) return { rows: [], missing: /schema cache|does not exist|relation/i.test(result.error.message) };
  return { rows: (result.data ?? []) as unknown as Row[], missing: false };
}

export async function loadLoyaltyPlayerView(userId: string) {
  const [tasks, grants, checkins] = await Promise.all([
    readTable("loyalty_tasks"),
    readTable("loyalty_grants", userId),
    readTable("loyalty_checkins", userId),
  ]);
  const installed = !tasks.missing && !grants.missing;
  const supabase = await createClient();
  const flagsResult = await supabase.rpc("loyalty_player_flags" as never);
  const flags = (flagsResult.data ?? null) as { earning?: boolean; budget_open?: boolean; checkin?: boolean; legacy_freeplay?: boolean; redemption?: boolean } | null;
  const flagsMissing = Boolean(flagsResult.error && /schema cache|does not exist|Could not find/i.test(flagsResult.error.message));
  const taskRows = tasks.rows.length
    ? tasks.rows
    : WELCOME_COIN_TASKS.map((task) => ({ key: task.key, coins: task.coins, enabled: false }));
  const done = new Set(grants.rows.map((row) => row.task_key));
  return {
    installed,
    earning: flags?.earning === true,
    budgetOpen: flags?.budget_open === true,
    checkin: flags?.checkin === true,
    legacyFreeplay: flagsMissing || flags?.legacy_freeplay !== false,
    tasks: taskRows
      .filter((row) => row.key)
      .map((row) => ({
        key: String(row.key),
        coins: Number(row.coins ?? 0),
        enabled: Boolean(row.enabled),
        done: done.has(String(row.key)),
      })),
    history: [
      ...grants.rows.map((row) => ({ label: String(row.task_key), coins: Number(row.coins ?? 0), at: row.created_at ?? "" })),
      ...checkins.rows.map((row) => ({ label: `${row.kind} check-in`, coins: Number(row.coins ?? 0), at: row.created_at ?? "" })),
    ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8),
  };
}
