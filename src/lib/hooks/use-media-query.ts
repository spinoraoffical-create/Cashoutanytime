"use client";

import { useSyncExternalStore } from "react";

function getMatchMedia(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia(query);
}

function subscribe(query: string, callback: () => void) {
  const mq = getMatchMedia(query);
  if (!mq) return () => {};
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot(query: string) {
  return getMatchMedia(query)?.matches ?? false;
}

/** SSR-safe media query — accurate on the first client render. */
export function useMediaQuery(query: string, serverFallback = false) {
  return useSyncExternalStore(
    (callback) => subscribe(query, callback),
    () => getSnapshot(query),
    () => serverFallback
  );
}

export function isMobileViewport() {
  return getSnapshot("(max-width: 767px)");
}
