"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type RefObject } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SUPPORT_TOPIC_PROMPTS, type SupportTopicId } from "@/lib/ai/escalate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { uploadChatAttachment } from "@/lib/chat/attachments";
import { ChatComposer } from "@/components/chat/chat-composer";
import { SupportThread, threadRequestedHuman, supportReferenceCode } from "@/components/chat/support-thread";
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
import { appendMessage } from "@/lib/chat/merge-messages";
import { subscribeToConversationInserts, subscribeToMessageInserts } from "@/lib/chat/subscribe-messages";
import { toast } from "sonner";
import { ArrowLeft, Headphones, MessageCircle } from "lucide-react";
import { SupportAiStarter } from "@/components/chat/support-ai-starter";
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
  onFollowUp: (text: string) => Promise<boolean>;
  loading: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScrollMessages?: () => void;
  botSenderId: string | null;
  supportLayout?: boolean;
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
  onFollowUp,
  loading,
  scrollRef,
  onScrollMessages,
  botSenderId,
  supportLayout = false,
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

  const humanRequested = threadRequestedHuman(
    messages,
    userId,
    selectedConversation.humanRequestedAt
  );
  const reference = supportReferenceCode(
    selectedConversation.id,
    selectedConversation.supportReference
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
      <div className="flex items-center gap-3 border-b border-white/10 bg-[#070b1f] px-3 py-3 shrink-0">
        {showMobileBack ? (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full bg-white/10"
            onClick={handleBack}
            aria-label="Back to chats"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : supportLayout ? (
          <Link
            href="/support"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white"
            aria-label="Back to support"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        ) : null}
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
          <Headphones className="h-5 w-5" />
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-[#070b1f]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold text-white">
            {humanRequested || supportLayout ? "Human support" : selectedConversation.title}
          </h2>
          <p className={cn("truncate text-xs", humanRequested ? "text-amber-300" : "text-[#b9b3c6]")}>
            {humanRequested
              ? "Human support requested · updates stay here"
              : "An automated assistant answers first"}
          </p>
        </div>
        <Link href="/help" className="shrink-0 text-xs font-bold text-white">
          FAQ
        </Link>
        {humanRequested ? null : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={loading || !selectedId}
            onClick={() => void onFollowUp("I need to speak with a person.")}
          >
            Request person
          </Button>
        )}
      </div>

      <SupportThread
        conversationId={selectedConversation.id}
        messages={messages}
        userId={userId}
        botSenderId={botSenderId}
        humanRequested={humanRequested}
        reference={reference}
        initialRating={selectedConversation.supportRating}
        initialResolved={selectedConversation.supportResolved}
        scrollRef={scrollRef}
        onScroll={onScrollMessages}
        className={`${CHAT_SCROLL_CLASS} bg-[#070b1f] p-3 pb-4 sm:p-4`}
        onStillNeedHelp={() => void onFollowUp("I still need help. I need to speak with a person.")}
        onMarkResolved={(score) =>
          void onFollowUp(`I marked this support resolved. Rating: ${score} of 5.`)
        }
      />

      <ChatComposer
        value={input}
        onChange={onInputChange}
        onSend={onSend}
        loading={loading}
        disabled={!selectedId}
        placeholder={humanRequested || supportLayout ? "Message human support..." : "Message support…"}
        attachLabel="Attach image"
        tone={supportLayout || humanRequested ? "support" : "default"}
        className="shrink-0 border-white/10 bg-[#070b1f]"
      />
    </div>
  );
}

export function UserMessagesInbox({
  initialData,
  variant = "inbox",
  signedInUserId = null,
}: {
  initialData?: UserMessagesInboxInitialData;
  variant?: "inbox" | "thread";
  signedInUserId?: string | null;
} = {}) {
  const dashboardProfile = useDashboardProfile();
  const searchParams = useSearchParams();
  const router = useRouter();
  const topicSent = useRef(false);
  const sendTopicRef = useRef<(text: string) => void>(() => {});
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
    () => initialData?.userId ?? profileUserId ?? signedInUserId
  );
  const [botSenderId, setBotSenderId] = useState<string | null>(
    () => initialData?.botSenderId ?? null
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

  useEffect(() => {
    function markAll() {
      if (!supabase || !userId) return;
      void Promise.all(conversations.map((conv) => markConversationReadClient(supabase, conv.id, userId))).then(() => {
        setConversations((prev) => prev.map((conv) => ({ ...conv, unreadCount: 0 })));
        void refreshUnread();
      });
    }
    window.addEventListener("hub-mark-all-read", markAll);
    return () => window.removeEventListener("hub-mark-all-read", markAll);
  }, [conversations, refreshUnread, supabase, userId]);

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

      setMessages(data ?? []);
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

    setInitLoading(true);
    try {
      const result = await initUserMessagesInbox();

      if (result.error || !result.userId) {
        return;
      }

      setUserId(result.userId);
      setBotSenderId(result.botSenderId ?? null);
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

  useEffect(() => {
    if (topicSent.current || initLoading || !selectedId || !userId) return;
    const topic = searchParams.get("topic");
    if (!topic || !(topic in SUPPORT_TOPIC_PROMPTS)) return;
    topicSent.current = true;
    sendTopicRef.current(SUPPORT_TOPIC_PROMPTS[topic as SupportTopicId]);
    router.replace("/support/chat", { scroll: false });
  }, [initLoading, selectedId, userId, searchParams, router]);

  const handleIncomingMessage = useCallback(
    (msg: Message) => {
      if (!supabase || !userId || (msg.sender_id === userId && msg.from_staff !== true)) return;

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
        if (msg.sender_id === userId && msg.from_staff !== true) return;
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
          if (data) setMessages(data);
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

  async function sendText(content: string, file: File | null, restoreInput: boolean): Promise<boolean> {
    if ((!content.trim() && !file) || !selectedId) return false;
    if (!supabase) {
      toast.error("Chat is unavailable. Check your connection.");
      return false;
    }

    setLoading(true);

    let attachment:
      | { url: string; type: "image" | "file"; name: string }
      | undefined;

    if (file) {
      const uploadResult = await uploadChatAttachment(supabase, selectedId, file);
      if ("error" in uploadResult) {
        toast.error(uploadResult.error);
        if (restoreInput) setInput(content);
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
      if (!result.message) {
        if (restoreInput) setInput(content);
        setLoading(false);
        return false;
      }
    }

    if (result.message) {
      setMessages((prev) => appendMessage(prev, result.message!));
    }

    setLoading(false);
    scheduleInboxSync();
    if (selectedId) void loadMessages(selectedId, { syncSidebar: false });
    return true;
  }

  async function handleSend(file: File | null): Promise<boolean> {
    const content = input.trim();
    if (!content && !file) return false;
    setInput("");
    return sendText(content, file, true);
  }

  function handleFollowUp(text: string) {
    return sendText(text, null, false);
  }

  sendTopicRef.current = (text: string) => {
    void sendText(text, null, false);
  };

  const chatPanelProps = {
    selectedConversation,
    messages,
    userId,
    selectedId,
    input,
    onInputChange: setInput,
    onSend: handleSend,
    onFollowUp: handleFollowUp,
    loading,
    scrollRef,
    onScrollMessages,
    botSenderId,
    supportLayout: variant === "thread",
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

  if (conversations.length === 0) {
    return (
      <Card className={`${CHAT_INBOX_CARD_CLASS} min-h-[28rem]`}>
        <SupportAiStarter userId={userId} onConversationStarted={() => void init()} />
      </Card>
    );
  }

  if (variant === "thread") {
    return (
      <Card className={CHAT_INBOX_CARD_CLASS}>
        <UserChatPanel {...chatPanelProps} />
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
              <div className={`${CHAT_SCROLL_CLASS} space-y-2 p-2`}>
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
                    className="w-full rounded-2xl border border-white/10 bg-[#1a1024] px-4 py-3 text-left"
                  >
                    <div className="flex items-start gap-2">
                      {conv.unreadCount > 0 ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#f3264f]" /> : <span className="mt-1.5 h-2 w-2 shrink-0" />}
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{conv.title || "New chat message"}</span>
                        <span className="mt-1 block truncate text-sm text-[#b9b3c6]">{conv.lastMessage}</span>
                        {conv.lastMessageAt ? (
                          <span className="mt-1 block text-xs text-[#b9b3c6]">{formatRelativeTime(conv.lastMessageAt)}</span>
                        ) : null}
                      </span>
                      <UnreadBadge count={conv.unreadCount} />
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
