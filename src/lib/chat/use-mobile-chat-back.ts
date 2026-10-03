"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Binds mobile chat overlays to the browser back stack so swipe-back / hardware
 * back closes the chat instead of leaving the page.
 */
export function useMobileChatBack(open: boolean, onClose: () => void) {
  const pushedRef = useRef(false);
  const skipPopRef = useRef(false);
  const onCloseRef = useRef(onClose);

  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const mobile =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 767px)").matches;
    if (!mobile) return;

    window.history.pushState({ mobileChatOverlay: true }, "");
    pushedRef.current = true;

    function onPopState() {
      if (skipPopRef.current) {
        skipPopRef.current = false;
        pushedRef.current = false;
        return;
      }
      pushedRef.current = false;
      onCloseRef.current();
    }

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (pushedRef.current) {
        skipPopRef.current = true;
        pushedRef.current = false;
        window.history.back();
      }
    };
  }, [open]);

  const closeFromUi = useCallback(() => {
    const mobile =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 767px)").matches;
    if (mobile && pushedRef.current) {
      skipPopRef.current = true;
      pushedRef.current = false;
      window.history.back();
    }
    onCloseRef.current();
  }, []);

  return closeFromUi;
}
