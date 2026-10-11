import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

/** Where a signed-in account belongs after login. Players stay on the lobby. */
export function pickLoginDestination(requested: string | null | undefined, adminHome: boolean): string {
  const raw = (requested ?? "").trim();
  const safe =
    raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("://") && !raw.includes("\\")
      ? raw
      : "/";

  if (adminHome) {
    if (safe.startsWith("/admin")) return safe;
    return "/admin";
  }

  if (safe === "/admin" || safe.startsWith("/admin/")) return "/";
  return safe;
}

/** Store creators, sub-creators, and Super Admin open /admin. Everyone else is a player. */
export async function signedInUsesAdminHome(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const db = createAdminClient() ?? supabase;
  const { data: roleRows, error: roleError } = await db
    .from("user_roles")
    .select("roles(key)")
    .eq("user_id", userId);

  if (!roleError) {
    const keys = (roleRows ?? [])
      .map((row) => {
        const role = row.roles as { key?: string } | { key?: string }[] | null;
        if (Array.isArray(role)) return role[0]?.key ?? "";
        return role?.key ?? "";
      })
      .filter(Boolean);
    if (keys.includes("super_admin")) return true;
  }

  const { data: agent, error: agentError } = await db
    .from("agent_accounts")
    .select("tier, active")
    .eq("user_id", userId)
    .maybeSingle();

  if (agentError || !agent || agent.active === false) return false;
  return agent.tier === "store_creator" || agent.tier === "sub_creator";
}
