"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type RefObject } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { ensureAdminConversation } from "@/lib/actions/admin";
import { sendMessageClient } from "@/lib/chat/send-message-client";
import { getAdminConversationUnreads, type AdminConversationUnread } from "@/lib/actions/messages";
import { uploadChatAttachment } from "@/lib/chat/attachments";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessageContent } from "@/components/chat/chat-message-content";
import { MobileChatShell, useMobileChatClose } from "@/components/chat/mobile-chat-shell";
import { AdminUserSearch } from "@/components/admin/admin-user-search";
import { UnreadBadge } from "@/components/ui/unread-badge";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { cn, formatRelativeTime } from "@/lib/utils";
import { CHAT_INBOX_CARD_CLASS, CHAT_SCROLL_CLASS } from "@/lib/chat/chat-layout";
import { useChatAutoScroll } from "@/lib/chat/use-chat-auto-scroll";
import { CHAT_INCOMING_EVENT, type ChatIncomingDetail } from "@/lib/chat/events";
import { playIncomingMessageSound } from "@/lib/chat/message-notification-sound";
import { subscribeToConversationInserts, subscribeToMessageInserts } from "@/lib/chat/subscribe-messages";
import { appendMessage, mergeMessagesById } from "@/lib/chat/merge-messages";
import { isUserOnline } from "@/lib/presence/utils";
import { toast } from "sonner";
import { ArrowLeft, MessageCircle } from "lucide-react";
import type { Message } from "@/types/database";

interface ConversationUser {
  full_name?: string | null;
  email?: string;
  is_online?: boolean;
  last_seen_at?: string | null;
}

export interface AdminConversation {
  id: string;
  user_id: string;
  updated_at: string;
  user: ConversationUser | null;
}

interface AdminChatInboxProps {
  conversations: AdminConversation[];
  initialUserId?: string;
  initialUnreads?: AdminConversationUnread[];
}

function unreadsToMap(list: AdminConversationUnread[]): Record<string, AdminConversationUnread> {
  const map: Record<string, AdminConversationUnread> = {};
  for (const item of list) {
    map[item.conversationId] = item;
  }
  return map;
}

function displayContact(user: ConversationUser | null | undefined) {
  const email = user?.email ?? "";
  if (!email || email.endsWith("@phone.spinora.local")) {
    return user?.full_name ? `${user.full_name} · Phone user` : "Phone user";
  }
  return email;
}

interface AdminChatPanelProps {
  showMobileBack?: boolean;
  onBack?: () => void;
  selected: AdminConversation | undefined;
  messages: Message[];
  adminId: string | null;
  selectedId: string;
  input: string;
  onInputChange: (value: string) => void;
  onSend: (file: File | null) => Promise<boolean>;
  loading: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScrollMessages?: () => void;
}

function AdminChatPanel({
  showMobileBack,
  onBack,
  selected,
  messages,
  adminId,
  selectedId,
  input,
  onInputChange,
  onSend,
  loading,
  scrollRef,
  onScrollMessages,
}: AdminChatPanelProps) {
  const closeViaBack = useMobileChatClose();

  function handleBack() {
    if (closeViaBack) {
      closeViaBack();
      return;
    }
    onBack?.();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-white/10 flex items-center gap-2 sm:gap-3 bg-[#121212] shrink-0">
        {showMobileBack && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={handleBack}
            aria-label="Back to customers"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate text-white">
            {selected?.user?.full_name || "Customer"}
          </h2>
          <p className="text-xs text-muted-foreground truncate">
            {displayContact(selected?.user)}
            {selected?.user && (
              <span
                className={cn(
                  "ml-2",
                  isUserOnline(selected.user.last_seen_at) ? "text-emerald-400" : "text-muted-foreground"
                )}
              >
                · {isUserOnline(selected.user.last_seen_at) ? "Online" : "Offline"}
              </span>
            )}
          </p>
        </div>
        <Badge
          className={cn(
            "shrink-0",
            isUserOnline(selected?.user?.last_seen_at)
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              : "bg-white/5 text-muted-foreground border-white/10"
          )}
        >
          {isUserOnline(selected?.user?.last_seen_at) ? "Online" : "Offline"}
        </Badge>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScrollMessages}
        className={`${CHAT_SCROLL_CLASS} p-3 sm:p-4 pb-4 space-y-3 bg-[#0f0f0f]`}
      >
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No messages yet. Send a reply to start the conversation.
          </p>
        ) : (
          messages.map((msg) => {
            const isAdminMsg = msg.sender_id === adminId;
            return (
              <div
                key={msg.id}
                className={cn("flex", isAdminMsg ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm break-words",
                    isAdminMsg
                      ? "gradient-bg text-white rounded-br-md"
                      : "bg-[#1e1e1e] text-foreground border border-white/5 rounded-bl-md"
                  )}
                >
                  {!isAdminMsg && (
                    <p className="text-[10px] font-semibold text-orange-400 mb-1">Customer</p>
                  )}
                  <ChatMessageContent message={msg} />
                  <p className="text-[10px] opacity-60 mt-1.5">
                    {formatRelativeTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ChatComposer
        value={input}
        onChange={onInputChange}
        onSend={onSend}
        loading={loading}
        disabled={!selectedId}
        placeholder="Type a message..."
        showSendLabel
        className="bg-[#121212] border-white/10 shrink-0"
      />
    </div>
  );
}

export function AdminChatInbox({
  conversations: initialConversations,
  initialUserId,
  initialUnreads,
}: AdminChatInboxProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [unreads, setUnreads] = useState<Record<string, AdminConversationUnread>>(() =>
    initialUnreads ? unreadsToMap(initialUnreads) : {}
  );
  const [selectedId, setSelectedId] = useState(initialConversations[0]?.id ?? "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialUserHandled = useRef(false);
  const selectedIdRef = useRef(selectedId);
  const unreadsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const { refresh: refreshGlobalUnread } = useUnreadMessages();

  selectedIdRef.current = selectedId;
  const conversationUserIdsRef = useRef<string[]>([]);
  conversationUserIdsRef.current = conversations.map((c) => c.user_id);

  const selectConversation = useCallback((id: string, options?: { openMobile?: boolean }) => {
    if (id !== selectedIdRef.current) {
      setMessages([]);
    }
    setSelectedId(id);
    if (options?.openMobile !== false) {
      setMobileChatOpen(true);
    }
  }, []);

  const refreshOnlineStatus = useCallback(async () => {
    if (!supabase) return;
    const userIds = conversationUserIdsRef.current.filter(Boolean);
    if (userIds.length === 0) return;

    const { data } = await supabase
      .from("profiles")
      .select("id, last_seen_at, is_online")
      .in("id", userIds);

    if (!data) return;

    const byId = new Map(data.map((row) => [row.id, row]));

    setConversations((prev) =>
      prev.map((conv) => {
        const profile = byId.get(conv.user_id);
        if (!profile) return conv;
        return {
          ...conv,
          user: {
            ...conv.user,
            full_name: conv.user?.full_name ?? null,
            email: conv.user?.email,
            last_seen_at: profile.last_seen_at,
            is_online: isUserOnline(profile.last_seen_at),
          },
        };
      })
    );
  }, [supabase]);

  const selected = conversations.find((c) => c.id === selectedId);

  const messageFingerprint = messages.length > 0 ? messages[messages.length - 1]?.id : "";
  const { onScroll: onScrollMessages } = useChatAutoScroll(
    scrollRef,
    messages.length,
    messageFingerprint,
    selectedId
  );

  const loadUnreads = useCallback(async () => {
    const list = await getAdminConversationUnreads();
    const map: Record<string, AdminConversationUnread> = {};
    for (const item of list) {
      map[item.conversationId] = item;
    }
    setUnreads(map);
  }, []);

  const scheduleLoadUnreads = useCallback(() => {
    if (unreadsDebounceRef.current) clearTimeout(unreadsDebounceRef.current);
    unreadsDebounceRef.current = setTimeout(() => {
      void loadUnreads();
    }, 150);
  }, [loadUnreads]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      if (!supabase) return;
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (selectedIdRef.current !== conversationId) return;

      setMessages(data ?? []);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (selectedIdRef.current !== conversationId) return;

      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .neq("sender_id", user?.id ?? "")
        .eq("is_read", false);

      await loadUnreads();
      await refreshGlobalUnread();
    },
    [supabase, loadUnreads, refreshGlobalUnread]
  );

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setAdminId(data.user?.id ?? null));
    if (!initialUnreads?.length) {
      void loadUnreads();
    }
  }, [supabase, loadUnreads, initialUnreads]);

  const handleIncomingMessage = useCallback(
    (msg: Message) => {
      if (!supabase || !adminId || msg.sender_id === adminId) return;

      playIncomingMessageSound(msg.sender_id, adminId);
      scheduleLoadUnreads();

      if (msg.conversation_id === selectedIdRef.current) {
        setMessages((prev) => appendMessage(prev, msg));
        setMobileChatOpen(true);
        void supabase
          .from("messages")
          .update({ is_read: true })
          .eq("id", msg.id)
          .then(() => refreshGlobalUnread());
        return;
      }

      selectConversation(msg.conversation_id);
    },
    [supabase, adminId, scheduleLoadUnreads, refreshGlobalUnread, selectConversation]
  );

  useEffect(() => {
    if (!supabase || !adminId) return;

    return subscribeToMessageInserts(supabase, `admin-inbox-${adminId}`, adminId, (msg) => {
      if (msg.conversation_id === selectedIdRef.current) return;
      handleIncomingMessage(msg);
    });
  }, [supabase, adminId, handleIncomingMessage]);

  useEffect(() => {
    if (!supabase || !selectedId || !adminId) return;

    return subscribeToConversationInserts(
      supabase,
      `admin-live-${selectedId}`,
      selectedId,
      (msg) => {
        if (msg.sender_id === adminId) return;
        handleIncomingMessage(msg);
      }
    );
  }, [supabase, selectedId, adminId, handleIncomingMessage]);

  useEffect(() => {
    if (!supabase || !selectedId) return;

    const poll = () => {
      if (document.visibilityState !== "visible") return;
      void supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true })
        .then(({ data }) => {
          if (selectedIdRef.current !== selectedId) return;
          if (data) setMessages((prev) => mergeMessagesById(prev, data));
        });
    };

    poll();
    const interval = setInterval(poll, 800);
    return () => clearInterval(interval);
  }, [supabase, selectedId]);

  useEffect(() => {
    function onChatIncoming(event: Event) {
      const detail = (event as CustomEvent<ChatIncomingDetail>).detail;
      if (!detail.conversationId) return;
      if (detail.message) {
        handleIncomingMessage(detail.message);
        return;
      }
      selectConversation(detail.conversationId);
      void loadMessages(detail.conversationId);
    }

    window.addEventListener(CHAT_INCOMING_EVENT, onChatIncoming);
    return () => window.removeEventListener(CHAT_INCOMING_EVENT, onChatIncoming);
  }, [selectConversation, loadMessages, handleIncomingMessage]);

  useEffect(() => {
    void refreshOnlineStatus();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshOnlineStatus();
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [refreshOnlineStatus]);

  useEffect(() => {
    if (!selectedId || !supabase) return;
    loadMessages(selectedId);
  }, [selectedId, supabase, loadMessages]);

  const startChatWithUser = useCallback(
    async (userId: string) => {
      const existing = conversations.find((c) => c.user_id === userId);
      if (existing) {
        selectConversation(existing.id);
        return;
      }

      try {
        const { conversationId, user, error } = await ensureAdminConversation(userId);
        if (error || !conversationId) {
          toast.error(error ?? "Could not start chat");
          return;
        }

        setConversations((prev) => {
          if (prev.some((c) => c.id === conversationId)) return prev;
          return [
            {
              id: conversationId,
              user_id: userId,
              updated_at: new Date().toISOString(),
              user: user ?? null,
            },
            ...prev,
          ];
        });

        selectConversation(conversationId);
      } catch {
        toast.error("Could not start chat. Try again.");
      }
    },
    [conversations, selectConversation]
  );

  useEffect(() => {
    if (!initialUserId || initialUserHandled.current) return;
    initialUserHandled.current = true;
    void startChatWithUser(initialUserId);
  }, [initialUserId, startChatWithUser]);

  async function handleSend(file: File | null): Promise<boolean> {
    if ((!input.trim() && !file) || !selectedId) return false;
    if (!supabase) {
      toast.error("Chat is unavailable. Check your connection.");
      return false;
    }

    setLoading(true);
    const content = input.trim();
    setInput("");

    let attachment:
      | { url: string; type: "image" | "file"; name: string }
      | undefined;

    if (file) {
      const uploadResult = await uploadChatAttachment(supabase, selectedId, file);
      if ("error" in uploadResult) {
        toast.error(uploadResult.error);
        setInput(content);
        setLoading(false);
        return false;
      }
      attachment = uploadResult.data;
    }

    const result = await sendMessageClient(supabase, {
      conversationId: selectedId,
      senderId: adminId!,
      content,
      attachment,
      kind: "admin",
    });
    if (result.error) {
      toast.error(result.error);
      setInput(content);
      setLoading(false);
      return false;
    }

    if (result.message) {
      setMessages((prev) =>
        prev.some((m) => m.id === result.message!.id) ? prev : [...prev, result.message!]
      );
    }

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId ? { ...c, updated_at: new Date().toISOString() } : c
      )
    );
    setLoading(false);
    return true;
  }

  const chatPanelProps = {
    selected,
    messages,
    adminId,
    selectedId,
    input,
    onInputChange: setInput,
    onSend: handleSend,
    loading,
    scrollRef,
    onScrollMessages,
  };

  const onlineCount = conversations.filter((c) => isUserOnline(c.user?.last_seen_at)).length;

  const customerList = (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-white/10 shrink-0 space-y-3">
        <div>
          <h2 className="font-semibold text-white">Customers</h2>
          <p className="text-xs text-muted-foreground">
            {conversations.length} active chat(s)
            {onlineCount > 0 && (
              <span className="text-emerald-400"> · {onlineCount} online now</span>
            )}
          </p>
        </div>
        <AdminUserSearch onStartChat={startChatWithUser} />
      </div>
      <div className={`${CHAT_SCROLL_CLASS} p-2 space-y-1`}>
        {conversations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 px-3">
            Search for a user above to start a conversation.
          </p>
        ) : (
          conversations.map((conv) => {
            const user = conv.user;
            const isActive = conv.id === selectedId;
            const meta = unreads[conv.id];
            const online = isUserOnline(user?.last_seen_at);
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => selectConversation(conv.id)}
                className={cn(
                  "w-full text-left p-3 rounded-xl transition-colors border",
                  isActive
                    ? "bg-white/10 border-orange-500/30"
                    : "border-transparent hover:bg-white/5"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      online ? "bg-green-400" : "bg-gray-500"
                    )}
                    title={online ? "Online" : "Offline"}
                  />
                  <span className="font-medium text-sm truncate text-white flex-1">
                    {user?.full_name || "Customer"}
                  </span>
                  {online && (
                    <span className="text-[10px] text-emerald-400 shrink-0 font-medium">Online</span>
                  )}
                  {meta?.lastMessageAt && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatRelativeTime(meta.lastMessageAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground truncate flex-1">
                    {meta?.lastMessage ?? displayContact(user)}
                  </p>
                  <UnreadBadge count={meta?.unreadCount ?? 0} />
                </div>
                <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                  {displayContact(user)}
                </p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      <Card className={CHAT_INBOX_CARD_CLASS}>
        <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-1 flex-1 min-h-0 h-full overflow-hidden">
          <div
            className={cn(
              "border-r border-white/10 flex flex-col min-h-0 h-full overflow-hidden bg-[#141414]",
              mobileChatOpen ? "hidden md:flex" : "flex"
            )}
          >
            {customerList}
          </div>

          {/* Desktop chat panel */}
          <div className="hidden md:flex md:col-span-2 flex-col min-h-0 h-full overflow-hidden">
            {selectedId ? (
              <AdminChatPanel {...chatPanelProps} />
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center">
                <div>
                  <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Search for a user or pick a chat to start messaging.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Mobile full-screen chat — portaled to body so composer is never clipped */}
      <MobileChatShell
        open={mobileChatOpen && !!selectedId}
        onClose={() => setMobileChatOpen(false)}
      >
        <AdminChatPanel
          {...chatPanelProps}
          showMobileBack
          onBack={() => setMobileChatOpen(false)}
        />
      </MobileChatShell>
    </>
  );
}
