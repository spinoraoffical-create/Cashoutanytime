import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalGameSlug } from "@/lib/games";

/** Close a game request through complete_game_load. Status is not written here. */
export async function finishGameLoad(input: {
  requestId: string;
  success: boolean;
  errorMessage?: string | null;
  redeemedAmount?: number | null;
  gameUsername?: string | null;
  gamePassword?: string | null;
}) {
  const admin = createAdminClient();
  if (!admin) return { ok: false as const, error: "Database admin client unavailable." };

  const { data } = await admin
    .from("game_load_requests")
    .select("load_type, amount, game_username, game_password, game_slug")
    .eq("id", input.requestId)
    .maybeSingle();
  const row = data as {
    load_type?: string;
    amount?: number | null;
    game_username?: string | null;
    game_password?: string | null;
    game_slug?: string | null;
  } | null;
  const loadType = row?.load_type;
  const creating = loadType === "create_account" || loadType === "new_account";

  if (input.success && creating) {
    const slug = row?.game_slug?.trim() || "";
    const key = canonicalGameSlug(slug);
    const { data: games } = slug ? await admin.from("games").select("id, slug") : { data: null };
    const game = (games as { id: string; slug: string }[] | null)?.find(
      (item) => canonicalGameSlug(item.slug) === key
    );
    if (!game?.id) {
      const message = slug ? `No games row for ${slug}.` : "No games row for this slug.";
      await admin
        .from("game_load_requests")
        .update({
          game_username: null,
          game_password: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.requestId);
      const { error } = await admin.rpc("complete_game_load", {
        p_request_id: input.requestId,
        p_success: false,
        p_game_username: null,
        p_game_password: null,
        p_error_message: message,
        p_redeemed_amount: null,
      });
      return { ok: false as const, error: error?.message || message };
    }
  }
  const movedMoney = loadType === "load" || loadType === "reload" || loadType === "redeem";

  if (input.success && movedMoney) {
    await admin.rpc("mark_game_api_debited", { p_request_id: input.requestId });
  }

  const fromRow = Number(row?.amount ?? 0);
  const redeemed =
    input.redeemedAmount != null
      ? input.redeemedAmount
      : loadType === "redeem" || loadType === "check_balance"
        ? fromRow
        : null;
  const passRedeemed =
    redeemed == null ? null : loadType === "check_balance" || redeemed > 0 ? redeemed : null;

  const keptUsername = input.gameUsername?.trim() || row?.game_username?.trim() || null;
  const { error } = await admin.rpc("complete_game_load", {
    p_request_id: input.requestId,
    p_success: input.success,
    p_game_username: keptUsername,
    p_game_password: input.gamePassword ?? row?.game_password ?? null,
    p_error_message: input.errorMessage ?? null,
    p_redeemed_amount: passRedeemed,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
