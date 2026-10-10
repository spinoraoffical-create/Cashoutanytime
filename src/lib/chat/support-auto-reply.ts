import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBotSenderProfileId } from "@/lib/ai/settings";
import {
  asksForPerson,
  CHAT_PERSON_REPLY,
  supportGreetingReply,
  supportTopicReply,
} from "@/lib/ai/escalate";
import { supportReferenceCode } from "@/lib/chat/support-thread";

/** Topic and greeting answers stay available until a staff member has replied. */
export function scriptedSupportReply(content: string, queued: boolean): string | null {
  if (asksForPerson(content)) return queued ? null : CHAT_PERSON_REPLY;
  return supportTopicReply(content) || supportGreetingReply(content);
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

  const withStaff = await db
    .from("messages")
    .select("sender_id, content, from_staff")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(40);
  const rows = withStaff.error
    ? (
        await db
          .from("messages")
          .select("sender_id, content")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(40)
      ).data
    : withStaff.data;
  const messages = (rows ?? []) as {
    sender_id: string;
    content: string | null;
    from_staff?: boolean;
  }[];
  if (messages.some((message) => message.from_staff)) return;

  const botSenderId = await getBotSenderProfileId(userId);
  if (!botSenderId || botSenderId === userId) return;

  let queued = false;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.sender_id === botSenderId) {
      queued = queued || Boolean(message.content?.includes("will reply in this chat"));
      continue;
    }
    if (message.sender_id !== userId || !message.content?.trim()) continue;
    const botAlreadyReplied = messages
      .slice(index + 1)
      .some((later) => later.sender_id === botSenderId);
    if (botAlreadyReplied) continue;

    const reply = scriptedSupportReply(message.content, queued);
    if (!reply) continue;
    const { error } = await db.from("messages").insert({
      conversation_id: conversationId,
      sender_id: botSenderId,
      content: reply,
      is_read: false,
    });
    if (error) {
      console.error("[support] repair reply:", error.message);
      return;
    }
    queued = queued || reply.includes("will reply in this chat");
    if (asksForPerson(message.content)) {
      await db
        .from("conversations")
        .update({
          human_requested_at: new Date().toISOString(),
          support_reference: supportReferenceCode(conversationId),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
    }
  }
}
