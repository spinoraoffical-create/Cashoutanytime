"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  requestGameAccountCreate,
  requestGameLoad,
  requestGameRedeem,
} from "@/lib/actions/game-loads";

type ActionResult = { ok: true } | { ok: false; error: string };

type ResolvedGame =
  | { error: string }
  | { game: { id: string; slug: string; name: string } };

async function resolveGame(gameId: string): Promise<ResolvedGame> {
  const admin = createAdminClient();
  if (!admin) return { error: "Server configuration error." };
  const { data: game } = await admin
    .from("games")
    .select("id, slug, name")
    .eq("id", gameId)
    .single();
  if (!game) return { error: "Game not found." };
  return { game };
}

export async function createGameAccount(gameId: string): Promise<ActionResult> {
  const resolved = await resolveGame(gameId);
  if ("error" in resolved) return { ok: false, error: resolved.error };

  const result = await requestGameAccountCreate({
    gameSlug: resolved.game.slug,
    gameName: resolved.game.name,
  });
  if (result.error) return { ok: false, error: result.error };
  return { ok: true };
}

export async function loadToGame(gameId: string, amount: number): Promise<ActionResult> {
  const resolved = await resolveGame(gameId);
  if ("error" in resolved) return { ok: false, error: resolved.error };

  const supabase = await createClient();
  const { data: account } = await supabase
    .from("game_accounts")
    .select("game_username")
    .eq("game_id", gameId)
    .maybeSingle();

  const username = account?.game_username?.trim();
  if (!username) {
    return { ok: false, error: "Create your game account first." };
  }

  const result = await requestGameLoad({
    gameSlug: resolved.game.slug,
    gameName: resolved.game.name,
    amount,
    walletType: "current",
    gameUsername: username,
  });
  if (result.error) return { ok: false, error: result.error };
  return { ok: true };
}

export async function redeemFromGame(
  gameId: string,
  amount: number,
  redeemAll: boolean
): Promise<ActionResult> {
  const resolved = await resolveGame(gameId);
  if ("error" in resolved) return { ok: false, error: resolved.error };

  const supabase = await createClient();
  const { data: account } = await supabase
    .from("game_accounts")
    .select("game_username, credits_balance")
    .eq("game_id", gameId)
    .maybeSingle();

  const username = account?.game_username?.trim();
  if (!username) {
    return { ok: false, error: "Create your game account first." };
  }

  const result = await requestGameRedeem({
    gameSlug: resolved.game.slug,
    gameName: resolved.game.name,
    amount: redeemAll ? undefined : amount,
    redeemAll,
    gameUsername: username,
  });
  if (result.error) return { ok: false, error: result.error };
  return { ok: true };
}
