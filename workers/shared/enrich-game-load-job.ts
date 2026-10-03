import type { SupabaseClient } from "@supabase/supabase-js";

/** Attach requester profile + last completed game login (for replace → next number). */
export async function enrichGameLoadJob<
  T extends { id: string; user_id: string; game_slug: string; admin_notes?: string | null },
>(
  supabase: SupabaseClient,
  job: T
): Promise<
  T & {
    requester_name: string | null;
    requester_email: string | null;
    prior_game_username: string | null;
  }
> {
  const [{ data: profile }, { data: priorRow }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", job.user_id).single(),
    supabase
      .from("game_load_requests")
      .select("game_username")
      .eq("user_id", job.user_id)
      .eq("game_slug", job.game_slug)
      .in("load_type", ["create_account", "new_account"])
      .eq("status", "completed")
      .not("game_username", "is", null)
      .neq("id", job.id)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    ...job,
    requester_name: profile?.full_name ?? null,
    requester_email: profile?.email ?? null,
    prior_game_username: priorRow?.game_username ?? null,
  };
}
