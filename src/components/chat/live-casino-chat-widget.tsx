"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Bot, User, Paperclip, Image as ImageIcon, Video, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  time: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    sender: "bot",
    text: "👋 Welcome to Spinora Royale VIP! I'm your 24/7 AI Casino Support. You can chat with me, send deposit receipt photos/videos, or ask how to load Juwa 777 / Game Vault!",
    time: "Just now",
  },
];

export function LiveCasinoChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<{ file: File; previewUrl: string; type: "image" | "video" } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from localStorage on initial load
  useEffect(() => {
    try {
      const saved = localStorage.getItem("spin_chat_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Sync messages to localStorage whenever chat updates
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem("spin_chat_history", JSON.stringify(messages));
      }
    } catch {
      // ignore
    }
  }, [messages]);

  // Fetch logged in userId or guest visitor id
  useEffect(() => {
    const supabase = createClient();
    if (supabase) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.id) {
          setUserId(user.id);
        } else {
          let guestId = localStorage.getItem("spin_guest_id");
          if (!guestId) {
            guestId = `guest_${Math.random().toString(36).substring(2, 9)}`;
            localStorage.setItem("spin_guest_id", guestId);
          }
          setUserId(guestId);
        }
      });
    }
  }, []);

  // Auto-open chat popup after 4 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setOpen(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  function handleClearHistory() {
    setMessages(INITIAL_MESSAGES);
    localStorage.removeItem("spin_chat_history");
    toast.success("Chat history cleared.");
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isImage && !isVideo) {
      toast.error("Please upload a photo or video file.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setMediaFile({
      file,
      previewUrl,
      type: isVideo ? "video" : "image",
    });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() && !mediaFile) return;

    const userText = input.trim();
    const currentMedia = mediaFile;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: userText || (currentMedia ? `Sent ${currentMedia.type}` : ""),
      mediaUrl: currentMedia?.previewUrl,
      mediaType: currentMedia?.type,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setMediaFile(null);
    setTyping(true);

    try {
      const res = await fetch("/api/chat/live-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          hasMedia: !!currentMedia,
          mediaName: currentMedia?.file.name,
          conversationHistory: messages.map((m) => `${m.sender}: ${m.text}`),
          userId: userId || "guest_visitor",
        }),
      });

      const data = await res.json();
      setTyping(false);

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "bot",
        text: data.reply || "I'm here to help! Ask me anything about games or cashouts.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);

      if (data.alertedTelegram) {
        toast.success("🚨 Alerted Human Support Team & Saved to Admin Inbox!");
      }
    } catch {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "bot",
          text: "⚡ I'm here! You can load game credits on your Dashboard or ask me how to play.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50">
      {/* Floating Chat Trigger Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-2xl hover:scale-110 transition-transform shadow-amber-500/40 border-2 border-amber-300"
          aria-label="Open Live Casino Chat"
        >
          <Bot className="h-7 w-7" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 text-[9px] font-bold text-black items-center justify-center">1</span>
          </span>
        </button>
      )}

      {/* Expanded Live Chat Window */}
      {open && (
        <div className="flex flex-col w-[340px] sm:w-[380px] h-[500px] rounded-3xl border border-amber-500/40 bg-zinc-950/95 text-foreground backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-950/60 via-zinc-900 to-black border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                  <Bot className="h-5 w-5" />
                </div>
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-zinc-950" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-foreground">AI Live Casino Support</h3>
                  <Badge className="bg-emerald-500/20 text-emerald-400 font-mono text-[9px]">SAVED 24/7</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">Multi-turn AI + Saved in Database</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-zinc-800 hover:text-amber-400 transition-colors"
                title="Clear Chat History"
              >
                <RefreshCw className="h-4 w-4" />
              </button>

              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-zinc-800 hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.sender === "bot" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 mt-0.5">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-2xl p-3 leading-relaxed space-y-2 ${
                    m.sender === "user"
                      ? "bg-amber-500 text-black font-medium rounded-tr-none"
                      : "bg-zinc-900 border border-border/60 text-zinc-200 rounded-tl-none"
                  }`}
                >
                  {/* Photo / Video Thumbnail Preview */}
                  {m.mediaUrl && m.mediaType === "image" && (
                    <img
                      src={m.mediaUrl}
                      alt="Uploaded media"
                      className="rounded-xl max-h-40 w-full object-cover border border-black/20"
                    />
                  )}

                  {m.mediaUrl && m.mediaType === "video" && (
                    <video
                      src={m.mediaUrl}
                      controls
                      className="rounded-xl max-h-40 w-full object-cover border border-black/20"
                    />
                  )}

                  {m.text && <p>{m.text}</p>}

                  <span
                    className={`block text-[9px] ${
                      m.sender === "user" ? "text-black/70 text-right" : "text-muted-foreground"
                    }`}
                  >
                    {m.time}
                  </span>
                </div>

                {m.sender === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 mt-0.5">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {typing && (
              <div className="flex gap-2 items-center text-muted-foreground text-xs font-mono">
                <Bot className="h-4 w-4 text-amber-400 animate-spin" />
                <span>Spinora AI is typing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Media Attachment Preview Bar */}
          {mediaFile && (
            <div className="px-3 py-2 bg-zinc-900 border-t border-border/50 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-amber-400 font-bold truncate">
                {mediaFile.type === "image" ? <ImageIcon className="h-4 w-4 shrink-0" /> : <Video className="h-4 w-4 shrink-0" />}
                <span className="truncate">{mediaFile.file.name}</span>
              </div>
              <button onClick={() => setMediaFile(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-3 border-t border-border/50 bg-background/80 flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-muted-foreground hover:text-amber-400 transition-colors rounded-xl bg-zinc-900 border border-border/60 shrink-0"
              title="Attach Photo or Video"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type message or attach photo/video..."
              className="flex-1 bg-zinc-900 border border-border/60 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 text-foreground"
            />

            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 bg-amber-500 text-black hover:bg-amber-400 shrink-0 rounded-xl"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
