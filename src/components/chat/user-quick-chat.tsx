"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Headphones, Minimize2, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ChatComposer } from "@/components/chat/chat-composer";
import { SupportThread, supportReferenceCode, threadRequestedHuman } from "@/components/chat/support-thread";
import { uploadChatAttachment } from "@/lib/chat/attachments";
import { getSupportBotSenderId, getUserConversations } from "@/lib/actions/messages";
import { MobileChatShell, useMobileChatClose } from "@/components/chat/mobile-chat-shell";
import { appendMessage, mergeMessagesById } from "@/lib/chat/merge-messages";
import { subscribeToConversationInserts } from "@/lib/chat/subscribe-messages";
import { markConversationReadClient, sendMessageClient } from "@/lib/chat/send-message-client";
import { useChatAutoScroll } from "@/lib/chat/use-chat-auto-scroll";
import { CHAT_SCROLL_CLASS } from "@/lib/chat/chat-layout";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/database";
import { toast } from "sonner";

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
  const [botSenderId, setBotSenderId] = useState<string | null>(null);
  const [humanRequestedAt, setHumanRequestedAt] = useState<string | null>(null);
  const [supportReference, setSupportReference] = useState<string | null>(null);
  const [supportRating, setSupportRating] = useState<number | null>(null);
  const [supportResolved, setSupportResolved] = useState<boolean | null>(null);
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
    void getSupportBotSenderId().then(setBotSenderId);
    void getUserConversations().then((list) => {
      const match = list.find((item) => item.id === conversationId);
      if (!match) return;
      setHumanRequestedAt(match.humanRequestedAt);
      setSupportReference(match.supportReference);
      setSupportRating(match.supportRating);
      setSupportResolved(match.supportResolved);
    });
  }, [loadMessages, conversationId]);

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

    let attachment: { url: string; type: "image" | "file"; name: string } | undefined;
    if (file) {
      const uploadResult = await uploadChatAttachment(supabase, conversationId, file);
      if ("error" in uploadResult) {
        toast.error(uploadResult.error);
        setInput(content);
        setLoading(false);
        return false;
      }
      attachment = uploadResult.data;
    }

    const result = await sendMessageClient(supabase, {
      conversationId,
      senderId: userId,
      content,
      attachment,
      kind: "user",
    });

    if (result.error) {
      toast.error(result.error);
      if (!result.message) {
        setInput(content);
        setLoading(false);
        return false;
      }
    }

    if (result.message) {
      setMessages((prev) => appendMessage(prev, result.message!));
    }

    setLoading(false);
    void loadMessages();
    return true;
  }

  async function handleFollowUp(text: string) {
    if (!conversationId || !userId || !supabase || loading) return;
    setLoading(true);
    const result = await sendMessageClient(supabase, {
      conversationId,
      senderId: userId,
      content: text,
      kind: "user",
    });
    if (result.error) toast.error(result.error);
    if (result.message) setMessages((prev) => appendMessage(prev, result.message!));
    setLoading(false);
    void loadMessages();
  }

  const humanRequested = threadRequestedHuman(messages, userId, humanRequestedAt);
  const reference = supportReferenceCode(conversationId, supportReference);

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
          <p className="text-sm font-semibold text-white truncate">
            {humanRequested ? "Human support" : "Sweepstakes Hub Support"}
          </p>
          <p className="text-[10px] text-emerald-300">
            {humanRequested ? "Human support requested · updates stay here" : "Automated assistant answers first"}
          </p>
        </div>
        {!humanRequested && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleFollowUp("I need to speak with a person.")}
            className="shrink-0 rounded-full border border-white/15 px-2 py-1 text-[10px] font-semibold text-white"
          >
            Request person
          </button>
        )}
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

      <SupportThread
        conversationId={conversationId}
        messages={messages}
        userId={userId}
        botSenderId={botSenderId}
        humanRequested={humanRequested}
        reference={reference}
        initialRating={supportRating}
        initialResolved={supportResolved}
        scrollRef={scrollRef}
        onScroll={onScrollMessages}
        className={cn(CHAT_SCROLL_CLASS, "flex-1 min-h-0 p-3 bg-[#0f0f0f]")}
        onStillNeedHelp={() =>
          void handleFollowUp("I still need help. I need to speak with a person.")
        }
      />

      <ChatComposer
        value={input}
        onChange={setInput}
        onSend={handleSend}
        loading={loading}
        placeholder={humanRequested ? "Message human support…" : "Message support…"}
        attachLabel="Attach image"
        showSendLabel
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
