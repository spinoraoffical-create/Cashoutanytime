import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function latestIpsFor(admin: SupabaseClient, userIds: string[]) {
  const signup = new Map<string, string>();
  const seen = new Map<string, string>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return { signup, seen };

  const { data, error } = await admin
    .from("ip_logs")
    .select("user_id, ip_address, action, created_at")
    .in("user_id", ids)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error || !data) return { signup, seen };

  for (const row of data as { user_id: string | null; ip_address: string | null; action: string }[]) {
    if (!row.user_id) continue;
    const ip = String(row.ip_address ?? "").trim();
    if (!ip) continue;
    if (!seen.has(row.user_id)) seen.set(row.user_id, ip);
    if (row.action === "signup" && !signup.has(row.user_id)) signup.set(row.user_id, ip);
  }

  return { signup, seen };
}
