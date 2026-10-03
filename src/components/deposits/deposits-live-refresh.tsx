"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DEPOSIT_REQUEST_EVENT } from "@/lib/chat/events";

export function DepositsLiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    function onUpdate() {
      router.refresh();
    }

    window.addEventListener(DEPOSIT_REQUEST_EVENT, onUpdate);
    return () => window.removeEventListener(DEPOSIT_REQUEST_EVENT, onUpdate);
  }, [router]);

  return null;
}
