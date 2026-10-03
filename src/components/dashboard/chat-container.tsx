"use client";

import * as React from "react";
import { format } from "date-fns";
import { FileText, Headset, ImagePlus, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  is_staff: boolean;
  body: string;
  attachment_url: string | null;
  created_at: string;
};

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 5 * 1024 * 1024;

interface ChatContainerProps {
  ticketId: string;
  initialMessages: ChatMessage[];
  closed: boolean;
  perspective: "player" | "staff";
  onSend: (params: {
    ticketId: string;
    body: string;
    attachmentUrl?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onCloseTicket?: (ticketId: string) => Promise<{
    ok: boolean;
    error?: string;
    message?: string;
  }>;
}

export function ChatContainer({
  ticketId,
  initialMessages,
  closed,
  perspective,
  onSend,
  onCloseTicket,
}: ChatContainerProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [isClosed, setIsClosed] = React.useState(closed);
  const [body, setBody] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [localPreview, setLocalPreview] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription — deduplicates against optimistic placeholders
  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    const channel = supabase
      .channel(`chat:${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          const incoming = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            // Replace matching optimistic placeholder so the message isn't duplicated
            const optIdx = prev.findIndex(
              (m) =>
                m.id.startsWith("_opt_") &&
                m.is_staff === incoming.is_staff &&
                m.body === incoming.body
            );
            if (optIdx !== -1) {
              const next = [...prev];
              next[optIdx] = incoming;
              return next;
            }
            return [...prev, incoming];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED.includes(f.type)) {
      toast.error("Only JPG, PNG, WebP or PDF files allowed.");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("File must be under 5 MB.");
      return;
    }
    setFile(f);
    setLocalPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  function clearFile() {
    setFile(null);
    setLocalPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadFile(f: File): Promise<string | null> {
    const supabase = createClient();
    if (!supabase) {
      toast.error("Chat is unavailable.");
      return null;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const uid = user?.id;
    if (!uid) {
      toast.error("Not signed in.");
      return null;
    }
    const ext = f.name.split(".").pop() ?? "bin";
    const path = `${uid}/${ticketId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("ticket-attachments")
      .upload(path, f, { upsert: false });
    if (error) {
      toast.error("Upload failed — please try again.");
      return null;
    }
    const { data } = await supabase.storage
      .from("ticket-attachments")
      .createSignedUrl(path, 365 * 24 * 3600);
    return data?.signedUrl ?? null;
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed && !file) {
      toast.error("Type a message or attach an image.");
      return;
    }
    if (sending) return;
    setSending(true);

    // Capture current values before clearing the form
    const capturedFile = file;
    const capturedPreview = localPreview;
    const capturedBody = trimmed;
    const optId = `_opt_${Date.now()}`;

    // Optimistic update — message appears instantly
    setMessages((prev) => [
      ...prev,
      {
        id: optId,
        is_staff: perspective === "staff",
        body: capturedBody,
        attachment_url: capturedPreview,
        created_at: new Date().toISOString(),
      },
    ]);
    setBody("");
    clearFile();
    textareaRef.current?.focus();

    try {
      let attachmentUrl: string | undefined;
      if (capturedFile) {
        const url = await uploadFile(capturedFile);
        if (!url) {
          setMessages((prev) => prev.filter((m) => m.id !== optId));
          return;
        }
        attachmentUrl = url;
        // Swap local blob URL for the real signed URL
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optId ? { ...m, attachment_url: attachmentUrl! } : m
          )
        );
      }
      const result = await onSend({ ticketId, body: capturedBody, attachmentUrl });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to send.");
        setMessages((prev) => prev.filter((m) => m.id !== optId));
      }
    } finally {
      setSending(false);
    }
  }

  async function handleClose() {
    if (!onCloseTicket) return;
    setClosing(true);
    const result = await onCloseTicket(ticketId);
    setClosing(false);
    if (result.ok) {
      setIsClosed(true);
      toast.success(result.message ?? "Chat closed.");
    } else {
      toast.error(result.error ?? "Could not close.");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Message list */}
      <div className="space-y-3">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages yet — send the first one below.
          </p>
        ) : (
          messages.map((msg, i) => {
            const prev = messages[i - 1];
            const firstOfRun = !prev || prev.is_staff !== msg.is_staff;
            const mine =
              perspective === "player" ? !msg.is_staff : msg.is_staff;
            const isPdf =
              !!msg.attachment_url &&
              !msg.attachment_url.startsWith("blob:") &&
              (msg.attachment_url.toLowerCase().endsWith(".pdf") ||
                msg.attachment_url.includes("application%2Fpdf"));
            const isOpt = msg.id.startsWith("_opt_");

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 transition-opacity duration-150",
                  mine ? "flex-row-reverse" : "flex-row",
                  isOpt && "opacity-60"
                )}
              >
                {firstOfRun ? (
                  <Avatar className="mt-1 size-8 shrink-0">
                    <AvatarFallback
                      className={cn(
                        "text-xs font-bold",
                        msg.is_staff
                          ? "bg-ws-green/15 text-ws-green-deep dark:text-ws-green"
                          : "bg-ws-green/10 text-ws-green-deep dark:text-ws-green"
                      )}
                    >
                      {msg.is_staff ? (
                        <Headset className="size-3.5" aria-hidden />
                      ) : perspective === "player" ? (
                        "Me"
                      ) : (
                        "M"
                      )}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <span className="size-8 shrink-0" aria-hidden />
                )}

                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
                    mine
                      ? "rounded-tr-sm bg-ws-green/15"
                      : "rounded-tl-sm glass"
                  )}
                >
                  {firstOfRun && (
                    <p className="mb-1 text-[11px] font-semibold text-muted-foreground">
                      {msg.is_staff
                        ? "WinSweeps Support"
                        : perspective === "player"
                        ? "You"
                        : "Member"}
                      {isOpt ? (
                        <span className="ml-2 font-normal">Sending…</span>
                      ) : (
                        <time
                          dateTime={msg.created_at}
                          className="ml-2 font-normal"
                        >
                          {format(new Date(msg.created_at), "MMM d, HH:mm")}
                        </time>
                      )}
                    </p>
                  )}

                  {msg.attachment_url && (
                    <div className="mb-2">
                      {isPdf ? (
                        <a
                          href={msg.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2 text-xs text-ws-gold hover:bg-foreground/10"
                        >
                          <FileText className="size-4 shrink-0" aria-hidden />
                          View PDF
                        </a>
                      ) : (
                        <a
                          href={msg.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- can transiently be a blob: URL during optimistic send, which next/image can't render */}
                          <img
                            src={msg.attachment_url}
                            alt="Attachment"
                            className="max-h-48 max-w-full rounded-lg border border-foreground/10 object-cover"
                            loading="lazy"
                          />
                        </a>
                      )}
                    </div>
                  )}

                  {msg.body && (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {msg.body}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply form / closed state */}
      {isClosed ? (
        <p className="rounded-xl border border-foreground/8 bg-foreground/[0.02] px-4 py-3 text-center text-sm text-muted-foreground">
          This chat is closed.
          {perspective === "player" && (
            <> Start a new chat if you need more help.</>
          )}
        </p>
      ) : (
        <form onSubmit={handleSend} className="space-y-2">
          {localPreview && (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob: object URL, next/image can't render it */}
              <img
                src={localPreview}
                alt="Attachment preview"
                className="max-h-32 rounded-lg border border-foreground/10 object-cover"
              />
              <button
                type="button"
                onClick={clearFile}
                aria-label="Remove attachment"
                className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
              >
                <X className="size-3" aria-hidden />
              </button>
            </div>
          )}
          {file && !localPreview && (
            <div className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
              <FileText
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {file.name}
              </span>
              <button
                type="button"
                onClick={clearFile}
                aria-label="Remove attachment"
                className="ml-auto"
              >
                <X className="size-3.5 text-muted-foreground" aria-hidden />
              </button>
            </div>
          )}

          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            maxLength={5000}
            placeholder={
              perspective === "staff"
                ? "Reply to member… (Enter ↵ to send)"
                : "Type a message… (Enter ↵ to send)"
            }
            disabled={sending}
            className="resize-none"
          />

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={pickFile}
          />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={sending}
                title="Attach image or PDF"
              >
                <ImagePlus className="size-4" aria-hidden />
              </Button>
              {onCloseTicket && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  disabled={closing || sending}
                >
                  {closing && (
                    <Loader2
                      className="mr-1 size-3.5 animate-spin"
                      aria-hidden
                    />
                  )}
                  Close chat
                </Button>
              )}
            </div>
            <Button type="submit" size="sm" disabled={sending}>
              {sending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
