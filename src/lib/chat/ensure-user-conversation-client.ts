"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Ensure the logged-in user has an active support conversation (client-side). */
export async function ensureUserConversationClient(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (error || !created?.id) return null;
  return created.id;
}
