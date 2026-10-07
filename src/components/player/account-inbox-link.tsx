"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Inbox, Sparkles } from "lucide-react";
import { useUnreadMessages } from "@/hooks/use-unread-messages";

export function AccountInboxLink() {
  const { count } = useUnreadMessages();
  return (
    <Link href="/dashboard/messages" className="hub-card flex items-center justify-between rounded-2xl px-4 py-3">
      <span className="flex items-center gap-2 font-medium">
        <Inbox className="h-4 w-4" /> Inbox
      </span>
      {count > 0 ? (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#f3264f] px-1.5 text-[11px] font-black text-white">
          {count > 9 ? "9+" : count}
        </span>
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </Link>
  );
}

export function WhatsNewLink() {
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    setSeen(localStorage.getItem("hub-whats-new-seen") === "1");
  }, []);
  return (
    <Link href="/whats-new" className="hub-card flex items-center justify-between rounded-2xl px-4 py-3">
      <span className="flex items-center gap-2 font-medium">
        <Sparkles className="h-4 w-4" /> What&apos;s new
      </span>
      {seen ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <span className="h-2 w-2 rounded-full bg-[#f3264f]" />}
    </Link>
  );
}
