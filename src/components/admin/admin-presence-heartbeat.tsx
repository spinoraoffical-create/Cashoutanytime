"use client";

import { useEffect } from "react";
import { pingAdminPresence } from "@/lib/actions/admin-presence";

const PING_INTERVAL_MS = 45_000;

/** Keeps admin last_seen_at fresh while any admin page is open. */
export function AdminPresenceHeartbeat() {
  useEffect(() => {
    void pingAdminPresence();
    const interval = setInterval(() => {
      void pingAdminPresence();
    }, PING_INTERVAL_MS);

    function onVisible() {
      if (document.visibilityState === "visible") {
        void pingAdminPresence();
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
