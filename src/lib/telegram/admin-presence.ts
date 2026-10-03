import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_ONLINE_WINDOW_MS } from "@/lib/presence/utils";

/** Admins active on the site within this window skip Telegram (in-app alerts are enough). */
export const ADMIN_ONLINE_WINDOW_MS = SITE_ONLINE_WINDOW_MS;
export async function isAnyAdminOnline(): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;

  const since = new Date(Date.now() - ADMIN_ONLINE_WINDOW_MS).toISOString();

  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .gte("last_seen_at", since)
    .limit(1);

  if (error) {
    if (error.message.includes("last_seen_at")) return false;
    return false;
  }

  return (data?.length ?? 0) > 0;
}
