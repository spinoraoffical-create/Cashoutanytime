"use server";

import { createClient } from "@/lib/supabase/server";

/** Heartbeat while a user is on the site — powers online indicators for admins. */
export async function pingSitePresence(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const now = new Date().toISOString();

  await supabase
    .from("profiles")
    .update({ last_seen_at: now, is_online: true })
    .eq("id", user.id);
}
