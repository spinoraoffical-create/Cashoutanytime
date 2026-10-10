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

type ReplyDb = NonNullable<ReturnType<typeof createAdminClient>>;

type ThreadMessage = {
  id?: string;
  sender_id: string;
  content: string | null;
  from_staff?: boolean;
};

async function threadMessages(db: ReplyDb, conversationId: string): Promise<ThreadMessage[]> {
  const withStaff = await db
    .from("messages")
    .select("id, sender_id, content, from_staff")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(80);
  const rows = withStaff.error
    ? (
        await db
          .from("messages")
          .select("id, sender_id, content")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(80)
      ).data
    : withStaff.data;
  return (rows ?? []) as ThreadMessage[];
}

/** Drop repeated assistant lines that were saved for the same player message. */
export async function collapseDuplicateBotReplies(
  db: ReplyDb,
  conversationId: string,
  userId: string
) {
  const messages = await threadMessages(db, conversationId);
  const drop: string[] = [];
  let previous: ThreadMessage | null = null;
  for (const message of messages) {
    if (
      previous &&
      message.id &&
      message.sender_id === previous.sender_id &&
      message.sender_id !== userId &&
      (message.content ?? "") === (previous.content ?? "")
    ) {
      drop.push(message.id);
      continue;
    }
    previous = message;
  }
  if (drop.length === 0) return;
  await db.from("messages").delete().in("id", drop);
}

/** Save one assistant line, and only when the player's message is still the last line. */
export async function insertSupportReplyOnce(
  db: ReplyDb,
  input: {
    conversationId: string;
    userId: string;
    botSenderId: string;
    userContent: string;
    reply: string;
  }
) {
  const latest = await threadMessages(db, input.conversationId);
  const last = latest[latest.length - 1];
  if (!last || last.sender_id !== input.userId) return false;
  if ((last.content ?? "").trim() !== input.userContent.trim()) return false;

  const { error } = await db.from("messages").insert({
    conversation_id: input.conversationId,
    sender_id: input.botSenderId,
    content: input.reply,
    is_read: false,
  });
  if (error) {
    console.error("[support] reply:", error.message);
    return false;
  }
  await collapseDuplicateBotReplies(db, input.conversationId, input.userId);
  return true;
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

  await collapseDuplicateBotReplies(db, conversationId, userId);
  const messages = await threadMessages(db, conversationId);
  if (messages.some((message) => message.from_staff)) return;

  const latest = messages[messages.length - 1];
  if (!latest?.content?.trim() || latest.sender_id !== userId) return;

  const botSenderId = await getBotSenderProfileId(userId);
  if (!botSenderId || botSenderId === userId) return;

  const queued = messages.some((message) => message.content?.includes("will reply in this chat"));
  const reply = scriptedSupportReply(latest.content, queued);
  if (!reply) return;

  const saved = await insertSupportReplyOnce(db, {
    conversationId,
    userId,
    botSenderId,
    userContent: latest.content,
    reply,
  });
  if (saved && asksForPerson(latest.content)) {
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
