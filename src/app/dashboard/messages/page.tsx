"use client";

import { UserMessagesInbox } from "@/components/chat/user-messages-inbox";
import { CHAT_PAGE_SHELL_CLASS } from "@/lib/chat/chat-layout";

export default function MessagesPage() {
  return (
    <div className={CHAT_PAGE_SHELL_CLASS}>
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl sm:text-3xl font-bold">Messages</h1>
        <p className="text-muted-foreground">Chat with our support team — like Messenger</p>
      </div>

      <div className="flex-1 min-h-0">
        <UserMessagesInbox />
      </div>
    </div>
  );
}
