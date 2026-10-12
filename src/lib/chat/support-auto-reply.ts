import { createAdminClient } from "@/lib/supabase/admin";
import {
  asksForPerson,
  CHAT_PERSON_REPLY,
  supportGreetingReply,
  supportTopicReply,
} from "@/lib/ai/escalate";

/** Topic and greeting answers stay available until a staff member has replied. */
export function scriptedSupportReply(content: string, queued: boolean): string | null {
  if (/marked this support resolved/i.test(content)) return null;
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

/** Live chat no longer adds an assistant reply after a player message. */
export async function repairPendingSupportReply(_userId: string) {
  return;
}
