import type { SupabaseClient } from "@supabase/supabase-js";

const TIMEOUT_MSG =
  "Timed out waiting for the game bot. Restart the bot on your PC, then try Replace again.";

/** Unblock the queue: fail very stale jobs, re-queue recently stuck processing jobs. */
export async function healStaleGameLoadsForSlug(
  supabase: SupabaseClient,
  gameSlug: string,
  options?: { staleMinutes?: number; requeueMinutes?: number }
): Promise<{ failed: number; requeued: number }> {
  const staleMinutes = options?.staleMinutes ?? 15;
  const requeueMinutes = options?.requeueMinutes ?? 2;

  const { data: rpcCount, error: rpcError } = await supabase.rpc("fail_stale_game_loads", {
    p_stale_minutes: staleMinutes,
    p_game_slug: gameSlug,
  });

  if (!rpcError) {
    return { failed: Number(rpcCount ?? 0), requeued: 0 };
  }

  const now = Date.now();
  const failBefore = new Date(now - staleMinutes * 60 * 1000).toISOString();
  const requeueBefore = new Date(now - requeueMinutes * 60 * 1000).toISOString();
  const createdFailBefore = new Date(now - 30 * 60 * 1000).toISOString();

  const { data: oldProcessing } = await supabase
    .from("game_load_requests")
    .update({
      status: "failed",
      error_message:
        "This request got stuck (bot did not finish). Refresh the page, then click Replace Account again.",
      updated_at: new Date().toISOString(),
    })
    .eq("game_slug", gameSlug)
    .eq("status", "processing")
    .lt("created_at", createdFailBefore)
    .select("id");

  const { data: tooManyAttempts } = await supabase
    .from("game_load_requests")
    .update({
      status: "failed",
      error_message:
        "Bot could not complete after several tries. Restart the game bot, then try Replace again.",
      updated_at: new Date().toISOString(),
    })
    .eq("game_slug", gameSlug)
    .in("status", ["pending", "processing"])
    .gte("bot_attempts", 3)
    .select("id");

  const { data: failedRows } = await supabase
    .from("game_load_requests")
    .update({
      status: "failed",
      error_message: TIMEOUT_MSG,
      updated_at: new Date().toISOString(),
    })
    .eq("game_slug", gameSlug)
    .eq("status", "processing")
    .lt("updated_at", failBefore)
    .select("id");

  const { data: requeuedRows } = await supabase
    .from("game_load_requests")
    .update({
      status: "pending",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("game_slug", gameSlug)
    .eq("status", "processing")
    .lt("bot_attempts", 3)
    .lt("updated_at", requeueBefore)
    .select("id");

  return {
    failed:
      (failedRows?.length ?? 0) + (oldProcessing?.length ?? 0) + (tooManyAttempts?.length ?? 0),
    requeued: requeuedRows?.length ?? 0,
  };
}

export async function countActiveGameLoads(
  supabase: SupabaseClient,
  gameSlug: string
): Promise<{ pending: number; processing: number }> {
  const [pending, processing] = await Promise.all([
    supabase
      .from("game_load_requests")
      .select("id", { count: "exact", head: true })
      .eq("game_slug", gameSlug)
      .eq("status", "pending"),
    supabase
      .from("game_load_requests")
      .select("id", { count: "exact", head: true })
      .eq("game_slug", gameSlug)
      .eq("status", "processing"),
  ]);
  return {
    pending: pending.count ?? 0,
    processing: processing.count ?? 0,
  };
}
