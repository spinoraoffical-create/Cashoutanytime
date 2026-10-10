"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffContext } from "@/lib/data/admin";
import { notifyAdminOfCustomerMessage } from "@/lib/telegram/notify-admin-message";
import { messagePreview } from "@/lib/chat/message-preview";
import { getBotSenderProfileId } from "@/lib/ai/chatbot";
import type { Message } from "@/types/database";

export interface ConversationPreview {
  id: string;
  title: string;
  subtitle: string;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
  supportReference: string | null;
  humanRequestedAt: string | null;
  supportRating: number | null;
  supportResolved: boolean | null;
}

type ConversationListRow = {
  id: string;
  admin_id: string | null;
  updated_at: string;
  support_reference?: string | null;
  human_requested_at?: string | null;
  support_rating?: number | null;
  support_resolved?: boolean | null;
};

export async function getUserConversations(): Promise<ConversationPreview[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const withSupport = await supabase
    .from("conversations")
    .select(
      "id, admin_id, updated_at, support_reference, human_requested_at, support_rating, support_resolved"
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  const conversations = (
    withSupport.error
      ? (
          await supabase
            .from("conversations")
            .select("id, admin_id, updated_at")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("updated_at", { ascending: false })
        ).data
      : withSupport.data
  ) as ConversationListRow[] | null;

  if (!conversations?.length) return [];

  const convIds = conversations.map((c) => c.id);
  const adminIds = [...new Set(conversations.map((c) => c.admin_id).filter(Boolean))] as string[];

  const [lastMessages, { data: unreadRows }, adminProfilesResult] = await Promise.all([
    Promise.all(
      convIds.map((convId) =>
        supabase
          .from("messages")
          .select("conversation_id, content, attachment_type, created_at")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data }) => data)
      )
    ),
    supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", convIds)
      .eq("is_read", false)
      .neq("sender_id", user.id),
    adminIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", adminIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);

  const lastByConv = new Map<
    string,
    Pick<Message, "content" | "attachment_type" | "created_at"> & { conversation_id: string }
  >();
  for (const msg of lastMessages ?? []) {
    if (msg) lastByConv.set(msg.conversation_id, msg);
  }

  const unreadByConv = new Map<string, number>();
  for (const row of unreadRows ?? []) {
    unreadByConv.set(row.conversation_id, (unreadByConv.get(row.conversation_id) ?? 0) + 1);
  }

  const adminNames = new Map<string, string>();
  for (const p of adminProfilesResult.data ?? []) {
    if (p.full_name) adminNames.set(p.id, p.full_name);
  }

  return conversations.map((conv) => {
    const last = lastByConv.get(conv.id);
    const adminName = (conv.admin_id && adminNames.get(conv.admin_id)) || "Support team";

    return {
      id: conv.id,
      title: conv.human_requested_at ? "Human support" : "Sweepstakes Hub Support",
      subtitle: conv.human_requested_at ? "Human support requested · updates stay here" : adminName,
      lastMessage: last ? messagePreview(last) : "Start a conversation with our team",
      lastMessageAt: last?.created_at ?? conv.updated_at,
      unreadCount: unreadByConv.get(conv.id) ?? 0,
      supportReference: conv.support_reference ?? null,
      humanRequestedAt: conv.human_requested_at ?? null,
      supportRating: conv.support_rating ?? null,
      supportResolved: conv.support_resolved ?? null,
    };
  });
}

export async function getUnreadMessageCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (!conversations?.length) return 0;

  const { count } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .in(
      "conversation_id",
      conversations.map((c) => c.id)
    )
    .eq("is_read", false)
    .neq("sender_id", user.id);

  return count ?? 0;
}

export async function markConversationRead(conversationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: conversation } = await supabase
    .from("conversations")
    .select("user_id")
    .eq("id", conversationId)
    .single();

  if (!conversation || conversation.user_id !== user.id) {
    return { error: "Unauthorized" };
  }

  await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .eq("is_read", false);

  return { success: true };
}

export async function sendUserMessage(
  conversationId: string,
  content: string,
  attachment?: {
    url: string;
    type: "image" | "file";
    name: string;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!content.trim() && !attachment) {
    return { error: "Message cannot be empty" };
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("user_id")
    .eq("id", conversationId)
    .single();

  if (!conversation || conversation.user_id !== user.id) {
    return { error: "Unauthorized" };
  }

  const { error, data: inserted } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
      ...(attachment && {
        attachment_url: attachment.url,
        attachment_type: attachment.type,
        attachment_name: attachment.name,
      }),
    })
    .select("*")
    .single();

  if (error) {
    console.error("[messages] send:", error.message);
    return { error: "Could not send that message. Try again." };
  }

  void notifyAdminOfCustomerMessage({
    conversationId,
    senderId: user.id,
    content: content.trim(),
    attachmentType: attachment?.type ?? null,
  });

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  revalidatePath("/dashboard/messages");
  revalidatePath("/admin/chat");
  return { success: true, message: inserted };
}

async function newestActiveConversation(userId: string) {
  const supabase = await createClient();
  const admin = createAdminClient();

  async function newest(db: NonNullable<ReturnType<typeof createAdminClient>>) {
    const { data } = await db
      .from("conversations")
      .select("id, updated_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1);
    return (data as { id: string; updated_at: string }[] | null)?.[0] ?? null;
  }

  let conversation = await newest(supabase);
  if (!conversation && admin) conversation = await newest(admin);
  if (conversation) return conversation;

  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId, is_active: true })
    .select("id, updated_at")
    .limit(1);
  conversation = (data as { id: string; updated_at: string }[] | null)?.[0] ?? null;
  if (conversation) return conversation;

  if (admin) {
    const created = await admin
      .from("conversations")
      .insert({ user_id: userId, is_active: true })
      .select("id, updated_at")
      .limit(1);
    conversation = (created.data as { id: string; updated_at: string }[] | null)?.[0] ?? null;
    if (!conversation) {
      console.error("[messages] conversation:", error?.message, created.error?.message);
    }
  } else if (error) {
    console.error("[messages] conversation:", error.message);
  }

  return conversation;
}

export async function ensureUserConversation() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const conversation = await newestActiveConversation(user.id);
  if (!conversation) return { error: "Could not open chat. Try again." };

  return { conversationId: conversation.id, updatedAt: conversation.updated_at };
}

/** Single round-trip inbox load — conversation list + messages + mark read. */
export async function initUserMessagesInbox(): Promise<{
  error?: string;
  userId?: string;
  conversations?: ConversationPreview[];
  messages?: Message[];
  selectedConversationId?: string;
  botSenderId?: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const conversation = await newestActiveConversation(user.id);
  if (!conversation) return { error: "Could not open chat. Try again." };

  const conversations = await getUserConversations();
  const selectedConversationId = conversations[0]?.id ?? conversation.id;

  const list =
    conversations.length > 0
      ? conversations
      : [
          {
            id: conversation.id,
            title: "Sweepstakes Hub Support",
            subtitle: "Support team",
            lastMessage: "Start a conversation with our team",
            lastMessageAt: conversation.updated_at,
            unreadCount: 0,
            supportReference: null,
            humanRequestedAt: null,
            supportRating: null,
            supportResolved: null,
          } satisfies ConversationPreview,
        ];

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", selectedConversationId)
    .order("created_at", { ascending: true });

  await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", selectedConversationId)
    .neq("sender_id", user.id)
    .eq("is_read", false);

  return {
    userId: user.id,
    conversations: list,
    messages: messages ?? [],
    selectedConversationId,
    botSenderId: await getBotSenderProfileId(),
  };
}

export async function getSupportBotSenderId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getBotSenderProfileId(user.id);
}

/** Saves a 1–5 rating or resolved flag. Does not read or write wallet balances. */
export async function saveSupportFeedback(
  conversationId: string,
  input: { rating?: number; resolved?: boolean }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const patch: { support_rating?: number; support_resolved?: boolean } = {};
  if (input.rating != null) {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      return { error: "Choose a rating from 1 to 5." };
    }
    patch.support_rating = input.rating;
  }
  if (typeof input.resolved === "boolean") patch.support_resolved = input.resolved;
  if (!patch.support_rating && patch.support_resolved == null) return { error: "Nothing to save." };

  const { data: owned } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .limit(1);
  if (!owned?.length) return { error: "Unauthorized" };

  const { error } = await supabase.from("conversations").update(patch).eq("id", conversationId).eq("user_id", user.id);
  if (error) return { error: "Feedback could not be saved yet." };
  return { ok: true as const };
}

export type UserMessagesInboxInitialData = Awaited<ReturnType<typeof initUserMessagesInbox>>;

export interface AdminConversationUnread {
  conversationId: string;
  unreadCount: number;
  lastMessage: string;
  lastMessageAt: string | null;
}

export async function getAdminUnreadMessageCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const staff = await getStaffContext();
  if (!staff) return 0;

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id")
    .eq("is_active", true);

  if (!conversations?.length) return 0;

  const { count } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .in(
      "conversation_id",
      conversations.map((c) => c.id)
    )
    .eq("is_read", false)
    .neq("sender_id", user.id);

  return count ?? 0;
}

export interface AdminChatConversationRow {
  id: string;
  user_id: string;
  updated_at: string;
  user: {
    full_name?: string | null;
    email?: string | null;
    last_seen_at?: string | null;
  } | null;
}

/** Staff inbox list. Loads the profile in a second query so a bad embed cannot hide every chat. */
export async function getAdminChatConversations(): Promise<AdminChatConversationRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const staff = await getStaffContext();
  if (!staff) return [];

  const admin = createAdminClient();

  async function load(db: NonNullable<ReturnType<typeof createAdminClient>>) {
    const active = await db
      .from("conversations")
      .select("id, user_id, updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(80);
    if (!active.error) return active.data;
    const plain = await db
      .from("conversations")
      .select("id, user_id, updated_at")
      .order("updated_at", { ascending: false })
      .limit(80);
    return plain.data;
  }

  let rows = (await load(supabase)) as AdminChatConversationRow[] | null;
  if ((!rows || rows.length === 0) && admin) {
    rows = (await load(admin)) as AdminChatConversationRow[] | null;
  }
  if (!rows?.length) return [];

  const ids = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  const profileDb = admin ?? supabase;
  const { data: profiles } = await profileDb
    .from("profiles")
    .select("id, full_name, email, last_seen_at")
    .in("id", ids);
  const byId = new Map(
    ((profiles ?? []) as {
      id: string;
      full_name?: string | null;
      email?: string | null;
      last_seen_at?: string | null;
    }[]).map((profile) => [profile.id, profile])
  );

  return rows.map((row) => {
    const profile = byId.get(row.user_id);
    return {
      id: row.id,
      user_id: row.user_id,
      updated_at: row.updated_at,
      user: profile
        ? {
            full_name: profile.full_name ?? null,
            email: profile.email ?? null,
            last_seen_at: profile.last_seen_at ?? null,
          }
        : null,
    };
  });
}

export async function getAdminConversationUnreads(): Promise<AdminConversationUnread[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const staff = await getStaffContext();
  if (!staff) return [];

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, updated_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (!conversations?.length) return [];

  const convIds = conversations.map((conv) => conv.id);

  const [{ data: unreadRows }, { data: recentMessages }] = await Promise.all([
    supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", convIds)
      .eq("is_read", false)
      .neq("sender_id", user.id),
    supabase
      .from("messages")
      .select("conversation_id, content, attachment_type, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false })
      .limit(Math.min(convIds.length * 4, 800)),
  ]);

  const unreadByConv = new Map<string, number>();
  for (const row of unreadRows ?? []) {
    unreadByConv.set(row.conversation_id, (unreadByConv.get(row.conversation_id) ?? 0) + 1);
  }

  const lastByConv = new Map<
    string,
    Pick<Message, "content" | "attachment_type" | "created_at">
  >();
  for (const msg of recentMessages ?? []) {
    if (!lastByConv.has(msg.conversation_id)) {
      lastByConv.set(msg.conversation_id, msg);
    }
  }

  return conversations.map((conv) => {
    const last = lastByConv.get(conv.id);
    return {
      conversationId: conv.id,
      unreadCount: unreadByConv.get(conv.id) ?? 0,
      lastMessage: last ? messagePreview(last) : "No messages yet",
      lastMessageAt: last?.created_at ?? conv.updated_at,
    };
  });
}
