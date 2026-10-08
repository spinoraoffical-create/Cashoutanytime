"use server";

import { revalidatePath } from "next/cache";

import { adminDb, authorize, writeAudit } from "@/lib/actions/admin/core";
import { fulfillTrackedRequest } from "@/lib/actions/game-loads";
import { getAgentScope, playerInScope } from "@/lib/agents/scope";

export async function retryFailedLoadAction(requestId: string) {
  const scope = await getAgentScope();
  const platform = await authorize("requests.manage");
  const allowed = !("error" in platform) || scope?.level === "store" || scope?.level === "platform";
  if (!allowed) return { ok: false as const, error: "error" in platform ? platform.error : "You can't retry loads." };
  if (scope?.level === "sub") return { ok: false as const, error: "A store creator retries failed loads." };

  const db = adminDb();
  const { data } = await db
    .from("game_load_requests")
    .select("id, user_id, status, source_key, game_slug, game_name, amount, game_username")
    .eq("id", requestId)
    .maybeSingle();
  const row = data as {
    id: string;
    user_id: string;
    source_key: string | null;
    game_slug: string;
    game_name: string;
    amount: number;
    game_username: string | null;
  } | null;
  if (!row) return { ok: false as const, error: "That load was not found." };
  if (!row.source_key?.startsWith("auto:")) {
    return { ok: false as const, error: "Only automatic deposit loads can be retried here. The wallet is not credited again." };
  }
  if (scope && scope.level !== "platform" && !(await playerInScope(scope, row.user_id))) {
    return { ok: false as const, error: "That player is outside your network." };
  }

  const { data: game } = await db.from("games").select("id").eq("slug", row.game_slug).maybeSingle();
  const gameId = (game as { id?: string } | null)?.id;
  let username = row.game_username?.trim() || "";
  if (!username && gameId) {
    const { data: account } = await db
      .from("game_accounts")
      .select("game_username")
      .eq("user_id", row.user_id)
      .eq("game_id", gameId)
      .maybeSingle();
    username = (account as { game_username?: string | null } | null)?.game_username?.trim() || "";
  }
  if (!username) return { ok: false as const, error: "Account not found" };

  const { error } = await db.rpc("request_auto_game_load", {
    p_user_id: row.user_id,
    p_game_slug: row.game_slug,
    p_game_name: row.game_name,
    p_amount: row.amount,
    p_game_username: username,
    p_source_key: row.source_key,
  });
  if (error) return { ok: false as const, error: "Could not reserve the retry. The deposit was not credited again." };

  await db.from("game_load_requests").update({ game_username: username }).eq("id", row.id);
  const result = await fulfillTrackedRequest(row.id);
  const depositKey = row.source_key.slice("auto:".length);
  await db
    .from("deposit_bonus_ledger")
    .update({
      game_load_status: result.success ? "loaded" : "failed",
      game_load_error: result.success ? null : result.error || "Game load failed.",
      game_load_request_id: row.id,
    })
    .eq("deposit_key", depositKey);
  revalidatePath("/admin/failed-loads");
  if (!result.success) return { ok: false as const, error: result.error || "Retry failed. The deposit was not credited again." };
  return { ok: true as const, message: "Load retried. The deposit was not credited again." };
}

export async function setCashoutLimitAction(amount: number) {
  const auth = await authorize("requests.manage");
  if ("error" in auth) return { ok: false as const, error: auth.error };
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000) {
    return { ok: false as const, error: "Enter a limit between 0 and 100000." };
  }
  const { error } = await adminDb().from("platform_ops").upsert({
    key: "cashout",
    cashout_auto_limit: Math.round(amount * 100) / 100,
    updated_by: auth.staff.userId,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false as const, error: "Apply 20261008000130_auto_ops.sql before setting the cash-out limit." };
  await writeAudit({
    actorId: auth.staff.userId,
    action: "ops.cashout_limit",
    entityType: "platform_ops",
    entityId: "cashout",
    after: { cashout_auto_limit: amount },
  });
  revalidatePath("/admin/cashout-holds");
  return { ok: true as const, message: "Automatic cash-out limit saved." };
}
