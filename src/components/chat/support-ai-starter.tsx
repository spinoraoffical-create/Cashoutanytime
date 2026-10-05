"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { SITE_NAME } from "@/lib/constants";

const TOPICS = [
  { id: "payment", label: "Payment status", message: "I need help with my payment status." },
  { id: "redeem", label: "Redeem help", message: "I need help redeeming." },
  { id: "game", label: "Game problem", message: "I have a game problem." },
  { id: "verify", label: "Verify account", message: "I need help verifying my account." },
  { id: "rewards", label: "Rewards", message: "I have a question about rewards." },
  { id: "account", label: "Account issue", message: "I have an account issue." },
] as const;

export function SupportAiStarter({
  userId,
  onConversationStarted,
}: {
  userId: string;
  onConversationStarted?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState<string | null>(null);

  async function send(text: string, requestHuman = false) {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setReply(null);
    try {
      const res = await fetch("/api/chat/live-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, userId, requestHuman }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error("Support is temporarily unavailable. Please try again later.");
        return;
      }
      setDraft("");
      setReply(typeof data.reply === "string" ? data.reply : "Sweepstakes Hub support is here.");
      onConversationStarted?.();
    } catch {
      toast.error("Support is temporarily unavailable. Please try again later.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-bold text-white">{SITE_NAME} support</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask a question and we’ll reply here. A person can take over if you need one.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TOPICS.map((topic) => (
          <button
            key={topic.id}
            type="button"
            disabled={sending}
            onClick={() => void send(topic.message)}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-50"
          >
            {topic.label}
          </button>
        ))}
      </div>

      {reply ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
          {reply}
        </div>
      ) : null}

      <form
        className="mt-auto flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Describe what you need help with"
          className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none placeholder:text-muted-foreground"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => void send("I need to speak with a person.", true)}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5 disabled:opacity-50"
          >
            Request person
          </button>
        </div>
      </form>
    </div>
  );
}
