"use client";

import { useEffect, useState, type RefObject } from "react";
import Link from "next/link";
import { ShieldCheck, Star, UserRound } from "lucide-react";
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
  onMarkResolved?: (rating: number) => void;
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
  onMarkResolved,
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
    if (!rating || saving || resolved === true) return;
    setResolved(true);
    remember(rating, true);
    setSaving(true);
    await saveSupportFeedback(conversationId, { resolved: true, rating });
    onMarkResolved?.(rating);
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
        <div className="mb-4 px-1 text-sm">
          <p className="flex items-center gap-2 font-semibold text-white">
            <UserRound className="h-4 w-4 text-amber-300" />
            Your request is in the human support queue.
          </p>
          <p className="mt-1 text-xs text-[#b9b3c6]">
            You can keep this conversation open or come back later. Reference {reference}.
          </p>
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
              const fromStaff = message.from_staff === true;
              const isOwn = message.sender_id === userId && !fromStaff;
              const isAssistant =
                !isOwn && !fromStaff && (botSenderId ? message.sender_id === botSenderId : true);
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
        <div className="mt-2 rounded-3xl border border-white/10 bg-[#101735] px-4 py-4">
          <p className="text-lg font-bold text-white">How was this support?</p>
          <p className="mt-2 text-sm text-[#b9b3c6]">
            Rate the overall help and tell us whether this issue is resolved.
          </p>
          <p className="text-sm text-[#b9b3c6]">This does not change your account or balances.</p>
          <p className="mt-4 font-bold text-white">How would you rate the help?</p>
          <div className="mt-3 flex gap-2">
            {RATINGS.map((item) => (
              <button
                key={item.score}
                type="button"
                onClick={() => void chooseRating(item.score)}
                aria-label={`${item.score} ${item.label}`}
                aria-pressed={rating === item.score}
                className={cn(
                  "grid h-12 w-12 place-items-center rounded-2xl border",
                  rating != null && item.score <= rating
                    ? "border-amber-300 bg-amber-400/20 text-amber-300"
                    : "border-white/10 bg-[#070b1f] text-[#b9b3c6]"
                )}
              >
                <Star className={cn("h-5 w-5", rating != null && item.score <= rating && "fill-amber-300")} />
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#b9b3c6]">
            {rating ? RATINGS.find((item) => item.score === rating)?.label : "Choose a rating to continue."}
          </p>
          <p className="mt-4 font-bold text-white">Is your issue resolved?</p>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              disabled={!rating || saving}
              onClick={() => void markResolved()}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#070b1f] text-sm font-semibold text-white disabled:opacity-40"
            >
              <ShieldCheck className="h-4 w-4" /> Yes, resolved
            </button>
            <button
              type="button"
              disabled={!rating || saving}
              onClick={stillNeedHelp}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#070b1f] text-sm font-semibold text-white disabled:opacity-40"
            >
              <UserRound className="h-4 w-4" /> No, I still need help
            </button>
          </div>
          {resolved === true && <p className="mt-2 text-xs text-emerald-300">Marked resolved.</p>}
        </div>
      )}
    </div>
  );
}
