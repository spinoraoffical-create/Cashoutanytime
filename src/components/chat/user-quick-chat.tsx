"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Headphones, MessageCircle, Minimize2, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessageContent } from "@/components/chat/chat-message-content";
import { MobileChatShell, useMobileChatClose } from "@/components/chat/mobile-chat-shell";
import { appendMessage, mergeMessagesById } from "@/lib/chat/merge-messages";
import { subscribeToConversationInserts } from "@/lib/chat/subscribe-messages";
import { markConversationReadClient, sendMessageClient } from "@/lib/chat/send-message-client";
import { useChatAutoScroll } from "@/lib/chat/use-chat-auto-scroll";
import { CHAT_SCROLL_CLASS } from "@/lib/chat/chat-layout";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/database";

interface UserQuickChatProps {
  open: boolean;
  conversationId: string;
  userId: string;
  onClose: () => void;
}

function QuickChatPanel({
  conversationId,
  userId,
  onClose,
  isMobile,
}: {
  conversationId: string;
  userId: string;
  onClose: () => void;
  isMobile: boolean;
}) {
  const closeViaBack = useMobileChatClose();
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    if (!supabase || !conversationId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages((prev) => mergeMessagesById(prev, data ?? []));
    void markConversationReadClient(supabase, conversationId, userId);
  }, [supabase, conversationId, userId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!supabase || !conversationId || !userId) return;

    return subscribeToConversationInserts(
      supabase,
      `quick-chat-${conversationId}`,
      conversationId,
      (msg) => {
        setMessages((prev) => appendMessage(prev, msg));
        if (msg.sender_id !== userId) {
          void markConversationReadClient(supabase, conversationId, userId);
        }
      }
    );
  }, [supabase, conversationId, userId]);

  useEffect(() => {
    if (!supabase || !conversationId) return;

    const poll = () => {
      if (document.visibilityState !== "visible") return;
      void loadMessages();
    };

    poll();
    const interval = setInterval(poll, 800);
    return () => clearInterval(interval);
  }, [supabase, conversationId, loadMessages]);

  const fingerprint = messages.length > 0 ? messages[messages.length - 1]?.id : "";
  const { onScroll: onScrollMessages } = useChatAutoScroll(scrollRef, messages.length, fingerprint);

  async function handleSend(file: File | null): Promise<boolean> {
    if ((!input.trim() && !file) || !conversationId || !userId || !supabase) return false;

    setLoading(true);
    const content = input.trim();
    setInput("");

    const result = await sendMessageClient(supabase, {
      conversationId,
      senderId: userId,
      content,
      kind: "user",
    });

    if (result.error) {
      setInput(content);
      setLoading(false);
      return false;
    }

    if (result.message) {
      setMessages((prev) => appendMessage(prev, result.message!));
    }

    setLoading(false);
    return true;
  }

  function handleClose() {
    if (closeViaBack) {
      closeViaBack();
      return;
    }
    onClose();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden bg-[#121212]">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-white/10 bg-[#141414] shrink-0 safe-area-top">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={handleClose}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center shrink-0">
          <Headphones className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">Spinora Support</p>
          <p className="text-[10px] text-emerald-300">Live chat</p>
        </div>
        <Link
          href={`/dashboard/messages?conversation=${conversationId}`}
          className="text-[10px] font-medium text-orange-400 hover:text-orange-300 px-2 shrink-0"
        >
          Full view
        </Link>
        <button
          type="button"
          onClick={handleClose}
          className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground shrink-0"
          aria-label={isMobile ? "Close chat" : "Minimize chat"}
        >
          {isMobile ? <X className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScrollMessages}
        className={cn(CHAT_SCROLL_CLASS, "flex-1 min-h-0 p-3 space-y-2 bg-[#0f0f0f]")}
      >
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Say hello — we reply fast.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === userId;
            return (
              <div key={msg.id} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-xs break-words",
                    isOwn
                      ? "gradient-bg text-white rounded-br-md"
                      : "bg-[#1e1e1e] border border-white/5 rounded-bl-md"
                  )}
                >
                  <ChatMessageContent message={msg} />
                  <p className="text-[9px] opacity-60 mt-1">{formatRelativeTime(msg.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ChatComposer
        value={input}
        onChange={setInput}
        onSend={handleSend}
        loading={loading}
        placeholder="Reply..."
        className="bg-[#121212] border-white/10 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      />
    </div>
  );
}

export function UserQuickChat({ open, conversationId, userId, onClose }: UserQuickChatProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  if (!open) return null;

  const panel = (
    <QuickChatPanel
      conversationId={conversationId}
      userId={userId}
      onClose={onClose}
      isMobile={isMobile}
    />
  );

  if (isMobile) {
    return (
      <MobileChatShell open={open} onClose={onClose}>
        {panel}
      </MobileChatShell>
    );
  }

  return (
    <div className="fixed bottom-[5.5rem] right-6 z-[140] w-[min(100vw-2rem,22rem)] h-[min(70vh,28rem)] rounded-2xl border border-white/10 bg-[#121212] shadow-2xl flex flex-col overflow-hidden">
      {panel}
    </div>
  );
}
