import type { SupabaseClient } from "@supabase/supabase-js";
import type { Message } from "@/types/database";

function buildAllowedSet(
  conversationIds?: Set<string> | string[]
): Set<string> | null {
  if (!conversationIds) return null;
  if (conversationIds instanceof Set) {
    return conversationIds.size > 0 ? conversationIds : null;
  }
  return conversationIds.length > 0 ? new Set(conversationIds) : null;
}

/** Reliable realtime for the active conversation thread (uses server-side filter). */
export function subscribeToConversationInserts(
  supabase: SupabaseClient,
  channelName: string,
  conversationId: string,
  onMessage: (message: Message) => void
) {
  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onMessage(payload.new as Message)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** One realtime channel for message inserts (sidebar badges / popups). */
export function subscribeToMessageInserts(
  supabase: SupabaseClient,
  channelName: string,
  userId: string,
  onMessage: (message: Message) => void,
  options?: {
    /** When set, ignore messages outside these conversations (typical for customers). */
    conversationIds?: Set<string> | string[];
  }
) {
  const allowed = buildAllowedSet(options?.conversationIds);

  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === userId) return;
        if (allowed && !allowed.has(msg.conversation_id)) return;
        onMessage(msg);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
