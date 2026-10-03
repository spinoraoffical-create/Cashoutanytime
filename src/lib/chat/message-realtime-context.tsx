"use client";

import { createContext, useContext } from "react";

export interface MessageRealtimeContextValue {
  count: number;
  isAdmin: boolean;
  refresh: () => Promise<void>;
}

export const MessageRealtimeContext = createContext<MessageRealtimeContextValue>({
  count: 0,
  isAdmin: false,
  refresh: async () => {},
});

export function useUnreadMessages() {
  return useContext(MessageRealtimeContext);
}
