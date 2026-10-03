"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GAME_REQUEST_EVENT } from "@/lib/chat/events";

/** Refreshes server-rendered request lists when game requests change in realtime. */
export function GameRequestsLiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    function onUpdate() {
      router.refresh();
    }

    window.addEventListener(GAME_REQUEST_EVENT, onUpdate);
    return () => window.removeEventListener(GAME_REQUEST_EVENT, onUpdate);
  }, [router]);

  return null;
}
