"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { uploadChatAttachment } from "@/lib/chat/attachments";
import {
  markConversationReadClient,
  sendMessageClient,
} from "@/lib/chat/send-message-client";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessageContent } from "@/components/chat/chat-message-content";
import { FloatingSocialLinks } from "@/components/layout/social-links";
import { formatRelativeTime } from "@/lib/utils";
import { CHAT_SCROLL_CLASS } from "@/lib/chat/chat-layout";
import { useChatAutoScroll } from "@/lib/chat/use-chat-auto-scroll";
import { playIncomingMessageSound } from "@/lib/chat/message-notification-sound";
import { toast } from "sonner";
import type { Message } from "@/types/database";

/** Mini chat widget for guests only — logged-in users use MessageRealtimeProvider FAB */
export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);
  const messageFingerprint = messages.length > 0 ? messages[messages.length - 1]?.id : "";
  const { onScroll: onScrollMessages } = useChatAutoScroll(
    scrollRef,
    messages.length,
    messageFingerprint
  );

  useEffect(() => {
    if (!supabase) {
      setIsLoggedIn(false);
      return;
    }
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
      if (user) setUserId(user.id);
    });
  }, [supabase]);

  const initChat = useCallback(async () => {
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    let { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!conv) {
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({ user_id: user.id })
        .select("id")
        .single();
      conv = newConv;
    }

    if (conv) {
      setConversationId(conv.id);
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });
      if (msgs) setMessages(msgs);
    }
  }, [supabase]);

  useEffect(() => {
    if (open && supabase && !isLoggedIn) {
      void initChat();
    }
  }, [open, initChat, supabase, isLoggedIn]);

  useEffect(() => {
    if (open && conversationId && !isLoggedIn && supabase && userId) {
      void markConversationReadClient(supabase, conversationId, userId);
    }
  }, [open, conversationId, isLoggedIn, supabase, userId]);

  useEffect(() => {
    if (!conversationId || !supabase || isLoggedIn) return;

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => [...prev, msg]);
          if (userId && msg.sender_id !== userId) {
            playIncomingMessageSound(msg.sender_id, userId);
            setOpen(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, supabase, isLoggedIn, userId]);

  async function handleSend(file: File | null): Promise<boolean> {
    if ((!input.trim() && !file) || !conversationId || !userId) return false;
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
      setInput(content);
      setLoading(false);
      return false;
    }

    if (result.message) {
      setMessages((prev) =>
        prev.some((m) => m.id === result.message!.id) ? prev : [...prev, result.message!]
      );
    }

    setLoading(false);
    return true;
  }

  if (isLoggedIn !== false) return null;

  if (pathname?.startsWith("/dashboard/messages") || pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed z-50 glass rounded-2xl shadow-2xl overflow-hidden inset-x-3 bottom-3 max-h-[min(520px,calc(100dvh-1.5rem))] flex flex-col sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96 sm:max-h-[min(560px,calc(100dvh-3rem))]"
          >
            <div className="gradient-bg px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-sm">Live Chat Support</h3>
                <p className="text-xs text-white/70">We typically reply in minutes</p>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg">
                  <Minimize2 className="h-4 w-4 text-white" />
                </button>
                <button type="button" onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg">
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>

            <div
              ref={scrollRef}
              onScroll={onScrollMessages}
              className={`${CHAT_SCROLL_CLASS} p-4 space-y-3`}
            >
              {!supabase ? (
                <p className="text-sm text-muted-foreground text-center py-8">Chat unavailable</p>
              ) : !userId ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-3">Please log in to start chatting</p>
                  <Button size="sm" asChild>
                    <a href="/login">Login</a>
                  </Button>
                </div>
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Start a conversation with our support team!
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_id === userId ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                        msg.sender_id === userId
                          ? "gradient-bg text-white"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <ChatMessageContent message={msg} />
                      <p className="text-[10px] opacity-60 mt-1">{formatRelativeTime(msg.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {userId && supabase && (
              <ChatComposer
                value={input}
                onChange={setInput}
                onSend={handleSend}
                loading={loading}
                placeholder="Type a message..."
                className="shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-0"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <div className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-center gap-2 pointer-events-none">
          <FloatingSocialLinks />
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpen(true)}
            className="w-14 h-14 rounded-full gradient-bg flex items-center justify-center shadow-lg glow-purple pointer-events-auto relative"
            aria-label="Open chat"
          >
            <MessageCircle className="h-6 w-6 text-white" />
          </motion.button>
        </div>
      )}
    </>
  );
}
