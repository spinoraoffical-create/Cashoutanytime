"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useMobileChatBack } from "@/lib/chat/use-mobile-chat-back";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

const MobileChatCloseContext = createContext<(() => void) | null>(null);

/** Close mobile chat and sync browser history (swipe-back safe). */
export function useMobileChatClose() {
  return useContext(MobileChatCloseContext);
}

interface MobileChatShellProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}

/** Full-screen mobile chat overlay — escapes parent overflow/clipping */
export function MobileChatShell({ open, onClose, children, className }: MobileChatShellProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const scrollYRef = useRef(0);
  const closeFromUi = useMobileChatBack(open && isMobile, () => onClose?.());

  useEffect(() => {
    if (!open || !isMobile) return;

    scrollYRef.current = window.scrollY;
    const { style } = document.body;
    const prev = {
      position: style.position,
      top: style.top,
      left: style.left,
      right: style.right,
      overflow: style.overflow,
      width: style.width,
    };

    style.position = "fixed";
    style.top = `-${scrollYRef.current}px`;
    style.left = "0";
    style.right = "0";
    style.width = "100%";
    style.overflow = "hidden";

    return () => {
      style.position = prev.position;
      style.top = prev.top;
      style.left = prev.left;
      style.right = prev.right;
      style.overflow = prev.overflow;
      style.width = prev.width;
      window.scrollTo(0, scrollYRef.current);
    };
  }, [open, isMobile]);

  if (!open || !isMobile) return null;

  return createPortal(
    <MobileChatCloseContext.Provider value={closeFromUi}>
      <div
        className={cn(
          "fixed inset-0 z-[250] flex flex-col min-h-0 overflow-hidden bg-[#0f0f0f]",
          "pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]",
          "overscroll-none",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex flex-col flex-1 min-h-0 h-full w-full overflow-hidden bg-[#0f0f0f] isolate">
          {children}
        </div>
      </div>
    </MobileChatCloseContext.Provider>,
    document.body
  );
}
