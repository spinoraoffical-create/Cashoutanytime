"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

export {
  CHAT_INBOX_CARD_CLASS,
  CHAT_PAGE_SHELL_CLASS,
  CHAT_SCROLL_CLASS,
} from "@/lib/chat/chat-layout";

const NEAR_BOTTOM_PX = 96;

function scrollToBottom(el: HTMLDivElement) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  });
}

/** Only pin to bottom when the user is already near the latest messages. */
export function useChatAutoScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  messageCount: number,
  messageFingerprint?: string,
  conversationKey?: string
) {
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    stickToBottomRef.current = true;
  }, [conversationKey]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || messageCount === 0) return;
    if (!stickToBottomRef.current) return;

    scrollToBottom(el);
  }, [scrollRef, messageCount, messageFingerprint, conversationKey]);

  return { onScroll };
}
