import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBotSenderProfileId } from "@/lib/ai/settings";
import {
  asksForPerson,
  CHAT_FALLBACK_REPLY,
  CHAT_PERSON_REPLY,
  supportGreetingReply,
  supportTopicReply,
} from "@/lib/ai/escalate";
import { supportReferenceCode } from "@/lib/chat/support-thread";

/** Topic answers stay available after a person is requested. Greetings do not. */
export function scriptedSupportReply(content: string, queued: boolean): string | null {
  if (asksForPerson(content)) return queued ? null : CHAT_PERSON_REPLY;
  const topic = supportTopicReply(content);
  if (topic) return topic;
  if (queued) return null;
  return supportGreetingReply(content);
}

/** Fill a thread that saved the player text and never saved the assistant line. */
export async function repairPendingSupportReply(userId: string) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const db = admin ?? supabase;
  const { data: convRows } = await db
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1);
  const conversationId = (convRows as { id: string }[] | null)?.[0]?.id;
  if (!conversationId) return;

  const { data: rows } = await db
    .from("messages")
    .select("sender_id, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(30);
  const messages = (rows ?? []) as { sender_id: string; content: string | null }[];
  if (messages.some((message) => message.sender_id !== userId)) return;

  const latest = messages.find((message) => message.sender_id === userId && message.content?.trim());
  if (!latest?.content) return;

  const reply =
    (asksForPerson(latest.content) ? CHAT_PERSON_REPLY : null) ||
    supportTopicReply(latest.content) ||
    supportGreetingReply(latest.content) ||
    CHAT_FALLBACK_REPLY;

  const botSenderId = await getBotSenderProfileId(userId);
  if (!botSenderId || botSenderId === userId) return;

  if (asksForPerson(latest.content)) {
    await db
      .from("conversations")
      .update({
        human_requested_at: new Date().toISOString(),
        support_reference: supportReferenceCode(conversationId),
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);
  }

  await db.from("messages").insert({
    conversation_id: conversationId,
    sender_id: botSenderId,
    content: reply,
    is_read: false,
  });
}
