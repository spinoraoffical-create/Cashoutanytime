"use client";

import { useEffect, useState, type RefObject } from "react";
import Link from "next/link";
import { ChatMessageContent } from "@/components/chat/chat-message-content";
import { saveSupportFeedback } from "@/lib/actions/messages";
import {
  messageMentionsWallet,
  supportDayLabel,
  supportReferenceCode,
  threadRequestedHuman,
} from "@/lib/chat/support-thread";
import { SITE_NAME } from "@/lib/constants";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Message } from "@/types/database";

const RATINGS = [
  { score: 1, label: "Very poor" },
  { score: 2, label: "Poor" },
  { score: 3, label: "Okay" },
  { score: 4, label: "Good" },
  { score: 5, label: "Excellent" },
] as const;

export { supportReferenceCode, threadRequestedHuman };

function feedbackKey(conversationId: string) {
  return `hub-support-feedback:${conversationId}`;
}

function readLocalFeedback(conversationId: string): { rating: number | null; resolved: boolean | null } {
  if (typeof window === "undefined") return { rating: null, resolved: null };
  try {
    const raw = window.localStorage.getItem(feedbackKey(conversationId));
    if (!raw) return { rating: null, resolved: null };
    const parsed = JSON.parse(raw) as { rating?: number; resolved?: boolean };
    const rating =
      typeof parsed.rating === "number" && parsed.rating >= 1 && parsed.rating <= 5
        ? parsed.rating
        : null;
    const resolved = typeof parsed.resolved === "boolean" ? parsed.resolved : null;
    return { rating, resolved };
  } catch {
    return { rating: null, resolved: null };
  }
}

interface SupportThreadProps {
  conversationId: string;
  messages: Message[];
  userId: string | null;
  botSenderId: string | null;
  humanRequested: boolean;
  reference: string;
  initialRating: number | null;
  initialResolved: boolean | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll?: () => void;
  className?: string;
  onStillNeedHelp: () => void;
}

export function SupportThread({
  conversationId,
  messages,
  userId,
  botSenderId,
  humanRequested,
  reference,
  initialRating,
  initialResolved,
  scrollRef,
  onScroll,
  className,
  onStillNeedHelp,
}: SupportThreadProps) {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [resolved, setResolved] = useState<boolean | null>(initialResolved);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = readLocalFeedback(conversationId);
    setRating(initialRating ?? stored.rating);
    setResolved(initialResolved ?? stored.resolved);
  }, [conversationId, initialRating, initialResolved]);

  function remember(nextRating: number | null, nextResolved: boolean | null) {
    window.localStorage.setItem(
      feedbackKey(conversationId),
      JSON.stringify({ rating: nextRating, resolved: nextResolved })
    );
  }

  async function chooseRating(score: number) {
    setRating(score);
    remember(score, resolved);
    setSaving(true);
    await saveSupportFeedback(conversationId, { rating: score });
    setSaving(false);
  }

  async function markResolved() {
    if (!rating || saving) return;
    setResolved(true);
    remember(rating, true);
    setSaving(true);
    await saveSupportFeedback(conversationId, { resolved: true });
    setSaving(false);
  }

  function stillNeedHelp() {
    if (!rating || saving) return;
    setResolved(false);
    remember(rating, false);
    void saveSupportFeedback(conversationId, { resolved: false });
    onStillNeedHelp();
  }

  const groups: { day: string; items: Message[] }[] = [];
  for (const message of messages) {
    const day = supportDayLabel(message.created_at);
    const last = groups[groups.length - 1];
    if (!last || last.day !== day) groups.push({ day, items: [message] });
    else last.items.push(message);
  }

  const hasReply = messages.some((message) => message.sender_id !== userId);

  return (
    <div ref={scrollRef} onScroll={onScroll} className={className}>
      {humanRequested && (
        <div className="mb-4 rounded-2xl border border-white/10 bg-[#1a1024] px-4 py-3 text-sm">
          <p className="font-semibold text-white">Your request is in the human support queue.</p>
          <p className="mt-1 text-xs text-[#b9b3c6]">
            You can leave and come back. This same thread stays open. Reference {reference}.
          </p>
          <Link href="/help" className="mt-2 inline-block text-xs font-bold text-[#ff6b89]">
            Read frequently asked questions
          </Link>
        </div>
      )}

      {messages.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          An automated assistant answers first. Ask for a person at any time.
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.day} className="mb-4 space-y-3">
            <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-[#b9b3c6]">
              {group.day}
            </p>
            {group.items.map((message) => {
              const isOwn = message.sender_id === userId;
              const isAssistant = !isOwn && (botSenderId ? message.sender_id === botSenderId : true);
              const label = isOwn ? null : isAssistant ? `${SITE_NAME} AI` : "Owner";
              const showWallet = !isOwn && isAssistant && messageMentionsWallet(message.content);
              return (
                <div key={message.id} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] break-words text-sm",
                    isOwn
                      ? "rounded-full bg-white/10 px-4 py-2 text-white"
                      : "rounded-2xl border border-white/5 bg-[#1e1e1e] px-4 py-2.5 text-foreground"
                  )}
                >
                    {label && <p className="mb-1 text-[10px] font-semibold text-orange-400">{label}</p>}
                    <ChatMessageContent message={message} />
                    {showWallet && (
                      <Link
                        href="/dashboard/wallet"
                        className="mt-2 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white"
                      >
                        Wallet
                      </Link>
                    )}
                    <p className="mt-1.5 text-[10px] opacity-60">{formatRelativeTime(message.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}

      {hasReply && (
        <div className="mt-2 rounded-2xl border border-white/10 bg-[#141414] px-4 py-3">
          <p className="text-sm font-semibold text-white">How was this help?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {RATINGS.map((item) => (
              <button
                key={item.score}
                type="button"
                onClick={() => void chooseRating(item.score)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  rating === item.score
                    ? "border-orange-400 bg-orange-500/20 text-white"
                    : "border-white/15 text-[#b9b3c6] hover:bg-white/5"
                )}
                aria-pressed={rating === item.score}
              >
                {item.score} {item.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!rating || saving}
              onClick={() => void markResolved()}
              className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              Yes, resolved
            </button>
            <button
              type="button"
              disabled={!rating || saving}
              onClick={stillNeedHelp}
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              No, I still need help
            </button>
          </div>
          {resolved === true && (
            <p className="mt-2 text-xs text-emerald-300">Marked resolved.</p>
          )}
          {resolved === false && (
            <p className="mt-2 text-xs text-[#b9b3c6]">Sent to the same thread.</p>
          )}
        </div>
      )}
    </div>
  );
}
