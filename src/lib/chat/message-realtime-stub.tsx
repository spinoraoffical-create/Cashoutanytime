"use client";

import type { ReactNode } from "react";
import { MessageRealtimeContext } from "@/lib/chat/message-realtime-context";

/** Lightweight provider for guests — avoids loading Supabase realtime until login. */
export function MessageRealtimeStubProvider({ children }: { children: ReactNode }) {
  return (
    <MessageRealtimeContext.Provider
      value={{ count: 0, isAdmin: false, refresh: async () => {} }}
    >
      {children}
    </MessageRealtimeContext.Provider>
  );
}
