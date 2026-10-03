"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyAdminOfCustomerMessage } from "@/lib/telegram/notify-admin-message";
import { messagePreview } from "@/lib/chat/message-preview";
import type { Message } from "@/types/database";

export interface ConversationPreview {
  id: string;
  title: string;
  subtitle: string;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
}

export async function getUserConversations(): Promise<ConversationPreview[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, admin_id, updated_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

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
      title: "Spinora Support",
      subtitle: adminName,
      lastMessage: last ? messagePreview(last) : "Start a conversation with our team",
      lastMessageAt: last?.created_at ?? conv.updated_at,
      unreadCount: unreadByConv.get(conv.id) ?? 0,
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
    const hint = error.message.includes("attachment_")
      ? " Run supabase/chat-attachments.sql in Supabase SQL Editor first."
      : "";
    return { error: `${error.message}${hint}` };
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

export async function ensureUserConversation() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  let { data: conversation } = await supabase
    .from("conversations")
    .select("id, updated_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!conversation) {
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id })
      .select("id, updated_at")
      .single();

    if (error) return { error: error.message };
    conversation = created;
  }

  return { conversationId: conversation.id, updatedAt: conversation.updated_at };
}

/** Single round-trip inbox load — conversation list + messages + mark read. */
export async function initUserMessagesInbox(): Promise<{
  error?: string;
  userId?: string;
  conversations?: ConversationPreview[];
  messages?: Message[];
  selectedConversationId?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  let { data: conversation } = await supabase
    .from("conversations")
    .select("id, updated_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!conversation) {
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id })
      .select("id, updated_at")
      .single();

    if (error) return { error: error.message };
    conversation = created;
  }

  const conversations = await getUserConversations();
  const selectedConversationId = conversations[0]?.id ?? conversation.id;

  const list =
    conversations.length > 0
      ? conversations
      : [
          {
            id: conversation.id,
            title: "Spinora Support",
            subtitle: "Support team",
            lastMessage: "Start a conversation with our team",
            lastMessageAt: conversation.updated_at,
            unreadCount: 0,
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
  };
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return 0;

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

export async function getAdminConversationUnreads(): Promise<AdminConversationUnread[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return [];

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
