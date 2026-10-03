"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type RefObject } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { uploadChatAttachment } from "@/lib/chat/attachments";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessageContent } from "@/components/chat/chat-message-content";
import { MobileChatShell, useMobileChatClose } from "@/components/chat/mobile-chat-shell";
import { UnreadBadge } from "@/components/ui/unread-badge";
import {
  ensureUserConversation,
  getUserConversations,
  initUserMessagesInbox,
  type ConversationPreview,
  type UserMessagesInboxInitialData,
} from "@/lib/actions/messages";
import {
  markConversationReadClient,
  sendMessageClient,
} from "@/lib/chat/send-message-client";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { cn, formatRelativeTime } from "@/lib/utils";
import { CHAT_INBOX_CARD_CLASS, CHAT_SCROLL_CLASS } from "@/lib/chat/chat-layout";
import { useChatAutoScroll } from "@/lib/chat/use-chat-auto-scroll";
import { CHAT_INCOMING_EVENT, type ChatIncomingDetail } from "@/lib/chat/events";
import { playIncomingMessageSound } from "@/lib/chat/message-notification-sound";
import { useDashboardProfile } from "@/lib/dashboard/dashboard-profile-context";
import { appendMessage, mergeMessagesById } from "@/lib/chat/merge-messages";
import { subscribeToConversationInserts, subscribeToMessageInserts } from "@/lib/chat/subscribe-messages";
import { toast } from "sonner";
import { ArrowLeft, Headphones, MessageCircle } from "lucide-react";
import type { Message } from "@/types/database";

interface UserChatPanelProps {
  showMobileBack?: boolean;
  onBack?: () => void;
  selectedConversation: ConversationPreview | undefined;
  messages: Message[];
  userId: string | null;
  selectedId: string | null;
  input: string;
  onInputChange: (value: string) => void;
  onSend: (file: File | null) => Promise<boolean>;
  loading: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScrollMessages?: () => void;
}

function UserChatPanel({
  showMobileBack,
  onBack,
  selectedConversation,
  messages,
  userId,
  selectedId,
  input,
  onInputChange,
  onSend,
  loading,
  scrollRef,
  onScrollMessages,
}: UserChatPanelProps) {
  const closeViaBack = useMobileChatClose();

  function handleBack() {
    if (closeViaBack) {
      closeViaBack();
      return;
    }
    onBack?.();
  }

  if (!selectedConversation) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Select a chat from the list to start messaging.</p>
        </div>
      </div>
    );
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
            aria-label="Back to chats"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center shrink-0">
          <Headphones className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-white truncate">{selectedConversation.title}</h2>
          <p className="text-xs text-muted-foreground truncate">{selectedConversation.subtitle}</p>
        </div>
        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shrink-0">
          Live
        </Badge>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScrollMessages}
        className={`${CHAT_SCROLL_CLASS} p-3 sm:p-4 pb-4 space-y-3 bg-[#0f0f0f]`}
      >
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Say hello — our team typically replies in minutes.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === userId;
            return (
              <div key={msg.id} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm break-words",
                    isOwn
                      ? "gradient-bg text-white rounded-br-md"
                      : "bg-[#1e1e1e] text-foreground border border-white/5 rounded-bl-md"
                  )}
                >
                  {!isOwn && (
                    <p className="text-[10px] font-semibold text-orange-400 mb-1">Support</p>
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

export function UserMessagesInbox({
  initialData,
}: {
  initialData?: UserMessagesInboxInitialData;
} = {}) {
  const dashboardProfile = useDashboardProfile();
  const searchParams = useSearchParams();
  const profileUserId = dashboardProfile?.userId ?? null;
  const hasServerData = Boolean(initialData?.userId && !initialData.error);
  const [conversations, setConversations] = useState<ConversationPreview[]>(
    () => initialData?.conversations ?? []
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    () => initialData?.selectedConversationId ?? null
  );
  const [messages, setMessages] = useState<Message[]>(() => initialData?.messages ?? []);
  const [userId, setUserId] = useState<string | null>(
    () => initialData?.userId ?? profileUserId
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(!hasServerData && !profileUserId);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);
  const { refresh: refreshUnread } = useUnreadMessages();
  const mobileChatOpenRef = useRef(mobileChatOpen);
  const selectedIdRef = useRef<string | null>(null);
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialConversationHandled = useRef(false);

  mobileChatOpenRef.current = mobileChatOpen;
  selectedIdRef.current = selectedId;

  const selectedConversation = conversations.find((c) => c.id === selectedId);

  const loadConversations = useCallback(async () => {
    await ensureUserConversation();
    const list = await getUserConversations();
    setConversations(list);
    return list;
  }, []);

  const scheduleInboxSync = useCallback(() => {
    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    syncDebounceRef.current = setTimeout(() => {
      void refreshUnread();
      void loadConversations();
    }, 150);
  }, [refreshUnread, loadConversations]);

  const loadMessages = useCallback(
    async (convId: string, options?: { syncSidebar?: boolean }) => {
      if (!supabase) return;

      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      setMessages((prev) => mergeMessagesById(prev, data ?? []));
      if (userId) void markConversationReadClient(supabase, convId, userId);
      if (options?.syncSidebar !== false) {
        void refreshUnread();
        void loadConversations();
      }
    },
    [supabase, userId, refreshUnread, loadConversations]
  );

  const init = useCallback(async () => {
    if (hasServerData) {
      void refreshUnread();
      return;
    }

    if (profileUserId && !userId) {
      setUserId(profileUserId);
    }

    if (!supabase) {
      setInitLoading(false);
      return;
    }

    const activeUserId = userId ?? profileUserId;
    if (!activeUserId) {
      setInitLoading(false);
      return;
    }

    setInitLoading(true);
    try {
      const result = await initUserMessagesInbox();

      if (result.error || !result.userId) {
        return;
      }

      setUserId(result.userId);
      setConversations(result.conversations ?? []);
      if (result.selectedConversationId) {
        setSelectedId(result.selectedConversationId);
        selectedIdRef.current = result.selectedConversationId;
      }
      setMessages(result.messages ?? []);
      void refreshUnread();
    } finally {
      setInitLoading(false);
    }
  }, [supabase, refreshUnread, hasServerData, profileUserId, userId]);

  useEffect(() => {
    if (profileUserId) {
      setUserId((current) => current ?? profileUserId);
    }
  }, [profileUserId]);

  useEffect(() => {
    init();
  }, [init]);

  const openConversation = useCallback(
    async (convId: string) => {
      if (convId === selectedIdRef.current) {
        setMobileChatOpen(true);
        return;
      }
      setSelectedId(convId);
      setMobileChatOpen(true);
      await loadMessages(convId);
    },
    [loadMessages]
  );

  useEffect(() => {
    const conversationParam = searchParams.get("conversation");
    if (!conversationParam || initialConversationHandled.current || initLoading) return;
    initialConversationHandled.current = true;
    void openConversation(conversationParam);
  }, [searchParams, initLoading, openConversation]);

  const handleIncomingMessage = useCallback(
    (msg: Message) => {
      if (!supabase || !userId || msg.sender_id === userId) return;

      playIncomingMessageSound(msg.sender_id, userId);

      if (msg.conversation_id === selectedIdRef.current) {
        setMessages((prev) => appendMessage(prev, msg));
        setMobileChatOpen(true);
        void markConversationReadClient(supabase!, msg.conversation_id, userId).then(() =>
          scheduleInboxSync()
        );
        return;
      }

      setSelectedId(msg.conversation_id);
      selectedIdRef.current = msg.conversation_id;
      setMobileChatOpen(true);
      setMessages((prev) => appendMessage(prev, msg));
      scheduleInboxSync();
      void loadMessages(msg.conversation_id, { syncSidebar: false });
    },
    [userId, supabase, scheduleInboxSync, loadMessages]
  );

  useEffect(() => {
    if (!supabase || !userId) return;

    return subscribeToMessageInserts(
      supabase,
      `user-inbox-${userId}`,
      userId,
      (msg) => {
        if (msg.conversation_id === selectedIdRef.current) return;
        handleIncomingMessage(msg);
      }
    );
  }, [supabase, userId, handleIncomingMessage]);

  useEffect(() => {
    if (!supabase || !selectedId) return;

    return subscribeToConversationInserts(
      supabase,
      `user-live-${selectedId}`,
      selectedId,
      (msg) => {
        if (msg.sender_id === userId) return;
        handleIncomingMessage(msg);
      }
    );
  }, [supabase, selectedId, userId, handleIncomingMessage]);

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
      void openConversation(detail.conversationId);
    }

    window.addEventListener(CHAT_INCOMING_EVENT, onChatIncoming);
    return () => window.removeEventListener(CHAT_INCOMING_EVENT, onChatIncoming);
  }, [openConversation, handleIncomingMessage]);

  const messageFingerprint = messages.length > 0 ? messages[messages.length - 1]?.id : "";
  const { onScroll: onScrollMessages } = useChatAutoScroll(
    scrollRef,
    messages.length,
    messageFingerprint
  );

  async function selectConversation(convId: string) {
    await openConversation(convId);
  }

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
      senderId: userId!,
      content,
      attachment,
      kind: "user",
    });
    if (result.error) {
      toast.error(result.error);
      setInput(content);
      setLoading(false);
      return false;
    }

    if (result.message) {
      setMessages((prev) => appendMessage(prev, result.message!));
    }

    setLoading(false);
    scheduleInboxSync();
    return true;
  }

  const chatPanelProps = {
    selectedConversation,
    messages,
    userId,
    selectedId,
    input,
    onInputChange: setInput,
    onSend: handleSend,
    loading,
    scrollRef,
    onScrollMessages,
  };

  if (initLoading) {
    return (
      <Card className={`${CHAT_INBOX_CARD_CLASS} items-center justify-center`}>
        <p className="text-sm text-muted-foreground">Loading messages...</p>
      </Card>
    );
  }

  if (!supabase || !userId) {
    return (
      <Card className="p-12 text-center">
        <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold mb-2">Please log in</h3>
        <p className="text-sm text-muted-foreground">Sign in to message our support team.</p>
      </Card>
    );
  }

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
            <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
              <div className="p-4 border-b border-white/10 shrink-0">
                <h2 className="font-semibold text-white">Chats</h2>
                <p className="text-xs text-muted-foreground">Your conversations</p>
              </div>

              <div className={`${CHAT_SCROLL_CLASS} p-2 space-y-1`}>
              {conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8 px-4">
                  No chats yet. Start one with our support team below.
                </p>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => selectConversation(conv.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl transition-colors border",
                      selectedId === conv.id
                        ? "bg-white/10 border-orange-500/30"
                        : "border-transparent hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center shrink-0">
                        <Headphones className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="font-semibold text-sm text-white truncate">{conv.title}</span>
                          {conv.lastMessageAt && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {formatRelativeTime(conv.lastMessageAt)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground truncate flex-1">{conv.lastMessage}</p>
                          <UnreadBadge count={conv.unreadCount} />
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
              </div>
            </div>
          </div>

          {/* Desktop chat panel */}
          <div className="hidden md:flex md:col-span-2 flex-col min-h-0 h-full overflow-hidden">
            <UserChatPanel {...chatPanelProps} />
          </div>
        </div>
      </Card>

      {/* Mobile full-screen chat — portaled to body so composer is never clipped */}
      <MobileChatShell
        open={mobileChatOpen && !!selectedConversation}
        onClose={() => setMobileChatOpen(false)}
      >
        <UserChatPanel
          {...chatPanelProps}
          showMobileBack
          onBack={() => setMobileChatOpen(false)}
        />
      </MobileChatShell>
    </>
  );
}
