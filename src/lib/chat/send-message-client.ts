import type { SupabaseClient } from "@supabase/supabase-js";
import type { Message } from "@/types/database";

export interface SendMessageAttachment {
  url: string;
  type: "image" | "file";
  name: string;
}

/** Insert directly via Supabase browser client — skips Vercel server round-trip. */
export async function sendMessageClient(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    senderId: string;
    content: string;
    attachment?: SendMessageAttachment;
    kind: "user" | "admin";
  }
): Promise<{ message?: Message; error?: string }> {
  const { conversationId, senderId, content, attachment, kind } = input;

  if (!content.trim() && !attachment) {
    return { error: "Message cannot be empty" };
  }

  const row = {
    conversation_id: conversationId,
    sender_id: senderId,
    content: content.trim(),
    ...(kind === "admin" ? { from_staff: true } : {}),
    ...(attachment && {
      attachment_url: attachment.url,
      attachment_type: attachment.type,
      attachment_name: attachment.name,
    }),
  };

  let { data, error } = await supabase.from("messages").insert(row).select("*").single();
  if (error && kind === "admin" && /from_staff/i.test(error.message)) {
    const withoutStaffFlag = { ...row };
    delete withoutStaffFlag.from_staff;
    const retry = await supabase.from("messages").insert(withoutStaffFlag).select("*").single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    const hint = error.message.includes("attachment_")
      ? " Run supabase/chat-attachments.sql in Supabase SQL Editor first."
      : "";
    return { error: `${error.message}${hint}` };
  }

  try {
    const res = await fetch("/api/chat/after-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        content: content.trim(),
        attachmentType: attachment?.type ?? null,
        kind,
      }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      return {
        message: data as Message,
        error: payload?.error || "The reply could not be saved.",
      };
    }
  } catch {
    return { message: data as Message, error: "The reply could not be saved." };
  }

  return { message: data as Message };
}

/** Mark read directly from the browser (RLS allows conversation participants). */
export async function markConversationReadClient(
  supabase: SupabaseClient,
  conversationId: string,
  readerId: string
) {
  await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", readerId)
    .eq("is_read", false);
}
