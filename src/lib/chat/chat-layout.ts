/** Shared scroll region styles — flex child must scroll on mobile + desktop. */
export const CHAT_SCROLL_CLASS =
  "flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch]";

/** Page shell so chat fills remaining viewport (title + nav + padding). */
export const CHAT_PAGE_SHELL_CLASS =
  "flex flex-col min-h-0 h-[calc(100dvh-11rem)] sm:h-[calc(100dvh-10rem)] lg:h-[calc(100vh-7rem)]";

export const CHAT_INBOX_CARD_CLASS =
  "h-full min-h-0 flex flex-col overflow-hidden border-white/10 bg-[#161616]";
