"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { GAMES, UPCOMING_GAME_MESSAGE } from "@/lib/games";
import { notifyAdminOfGameRequest } from "@/lib/telegram/notify-admin-game-request";
import { createNotification } from "@/lib/actions/notifications";
import type { RequestStatus } from "@/types/database";

export async function createGameRequestBySlug(slug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const game = GAMES.find((g) => g.slug === slug);
  if (!game) return { error: "Game not found" };
  if (game.upcoming) return { error: UPCOMING_GAME_MESSAGE };

  const { data: existing } = await supabase
    .from("game_requests")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("game_name", game.name)
    .in("status", ["pending", "processing"])
    .maybeSingle();

  if (existing) {
    return {
      error: `You already have a ${existing.status} request for ${game.name}`,
    };
  }

  const { error } = await supabase.from("game_requests").insert({
    user_id: user.id,
    game_name: game.name,
    game_provider: game.provider,
    notes: null,
  });

  if (error) return { error: error.message };

  void notifyAdminOfGameRequest({
    userId: user.id,
    gameName: game.name,
    gameProvider: game.provider,
  });

  revalidatePath("/dashboard/requests");
  return { success: true, gameName: game.name };
}

export async function createGameRequest(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const gameName = formData.get("game_name") as string;
  const gameProvider = formData.get("game_provider") as string;
  const notes = formData.get("notes") as string;

  const { error } = await supabase.from("game_requests").insert({
    user_id: user.id,
    game_name: gameName,
    game_provider: gameProvider,
    notes: notes || null,
  });

  if (error) return { error: error.message };

  void notifyAdminOfGameRequest({
    userId: user.id,
    gameName,
    gameProvider,
    notes: notes || null,
  });

  revalidatePath("/dashboard/requests");
  return { success: true };
}

export async function updateRequestStatus(
  requestId: string,
  status: RequestStatus,
  adminNotes?: string,
  credentials?: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Unauthorized" };

  const { data: existingRequest } = await supabase
    .from("game_requests")
    .select("user_id, game_name, status")
    .eq("id", requestId)
    .single();

  const update: Record<string, string> = { status };
  if (adminNotes) update.admin_notes = adminNotes;
  if (credentials) update.credentials = credentials;

  const { error } = await supabase
    .from("game_requests")
    .update(update)
    .eq("id", requestId);

  if (error) return { error: error.message };

  if (existingRequest && status === "completed") {
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("vip_points")
      .eq("id", existingRequest.user_id)
      .single();

    if (userProfile) {
      await supabase
        .from("profiles")
        .update({ vip_points: userProfile.vip_points + 50 })
        .eq("id", existingRequest.user_id);
    }

    await createNotification(
      existingRequest.user_id,
      "Game Account Ready!",
      `Your ${existingRequest.game_name} account is ready. Open My Requests to view your login credentials.`,
      "success"
    );
  }

  if (existingRequest && status === "rejected") {
    await createNotification(
      existingRequest.user_id,
      "Game Request Update",
      `Your ${existingRequest.game_name} request could not be completed. Contact support if you have questions.`,
      "warning"
    );
  }

  if (existingRequest && status === "processing") {
    await createNotification(
      existingRequest.user_id,
      "Request In Progress",
      `We're creating your ${existingRequest.game_name} account. You'll be notified when it's ready.`,
      "info"
    );
  }

  revalidatePath("/admin/requests");
  revalidatePath("/dashboard/requests");
  return { success: true };
}
