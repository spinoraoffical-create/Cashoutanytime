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
    .order("updated_at", { ascending: false })
    .limit(1);

  const existingId = (existing as { id: string }[] | null)?.[0]?.id;
  if (existingId) return existingId;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId, is_active: true })
    .select("id")
    .limit(1);

  const createdId = (created as { id: string }[] | null)?.[0]?.id;
  if (error || !createdId) return null;
  return createdId;
}
