"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { markNotificationRead, markNotificationsRead } from "@/lib/actions/notifications";
import { notificationCategory, safeNotificationPath } from "@/lib/notifications/player-notice-rules";
import { formatRelativeTime } from "@/lib/utils";

export type InboxItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  link_url: string | null;
};

export function InboxList({ items, error }: { items: InboxItem[]; error: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const unread = items.filter((item) => !item.is_read).length;

  async function markOne(id: string) {
    setPending(id);
    const result = await markNotificationRead(id);
    setPending(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function markAll() {
    setPending("all");
    const result = await markNotificationsRead();
    setPending(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  if (error) {
    return <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-6 text-sm text-rose-100">{error}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#b9b3c6]">{unread === 0 ? "No unread notices." : `${unread} unread on this page.`}</p>
        <button type="button" onClick={() => void markAll()} disabled={pending != null || unread === 0} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold disabled:opacity-50">
          Mark all as read
        </button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-[#b9b3c6]">No notifications yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const href = safeNotificationPath(item.link_url);
            return (
              <li key={item.id} className={`rounded-2xl border px-4 py-3 ${item.is_read ? "border-white/10 bg-[#1a1024]" : "border-[#ff6b89]/40 bg-[#2a1424]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#b9b3c6]">{notificationCategory(item.type)}</p>
                    <p className="mt-1 font-bold">{item.title}</p>
                    <p className="mt-1 text-sm text-[#d7d0e2]">{item.message || "No message text was saved."}</p>
                    <p className="mt-2 text-xs text-[#8d86a0]">{formatRelativeTime(item.created_at)}</p>
                  </div>
                  <span className="text-xs font-bold text-[#b9b3c6]">{item.is_read ? "Read" : "Unread"}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!item.is_read && (
                    <button type="button" onClick={() => void markOne(item.id)} disabled={pending != null} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold">
                      Mark read
                    </button>
                  )}
                  {href && (
                    <Link href={href} className="rounded-lg bg-[#ff6b89] px-3 py-1.5 text-xs font-bold text-[#3a1020]">
                      Open
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
