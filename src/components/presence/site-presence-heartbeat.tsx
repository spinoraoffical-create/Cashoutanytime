"use client";

import { useEffect } from "react";
import { pingSitePresence } from "@/lib/actions/presence";

const PING_INTERVAL_MS = 45_000;

/** Keeps profile last_seen_at fresh while the user has the site open. */
export function SitePresenceHeartbeat() {
  useEffect(() => {
    void pingSitePresence();

    const interval = setInterval(() => {
      void pingSitePresence();
    }, PING_INTERVAL_MS);

    function onVisible() {
      if (document.visibilityState === "visible") {
        void pingSitePresence();
      }
    }

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
