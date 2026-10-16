import { createAdminClient } from "@/lib/supabase/admin";

/** Human-only chat. A player message never gets an automatic reply. */
export function scriptedSupportReply(_content: string, _queued: boolean): string | null {
  return null;
}

type ReplyDb = NonNullable<ReturnType<typeof createAdminClient>>;

/** Historical chat rows stay stored. Duplicate cleanup does not delete them. */
export async function collapseDuplicateBotReplies(
  _db: ReplyDb,
  _conversationId: string,
  _userId: string
) {
  return;
}

/** Do not insert an assistant message after a player message. */
export async function insertSupportReplyOnce(
  _db: ReplyDb,
  _input: {
    conversationId: string;
    userId: string;
    botSenderId: string;
    userContent: string;
    reply: string;
  }
) {
  return false;
}

/** Live chat no longer adds an assistant reply after a player message. */
export async function repairPendingSupportReply(_userId: string) {
  return;
}
