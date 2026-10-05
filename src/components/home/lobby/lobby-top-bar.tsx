"use client";

import Link from "next/link";
import Image from "next/image";
import { Bell } from "lucide-react";
import { useLobbyProfile } from "@/components/home/lobby/use-lobby-profile";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { SITE_NAME } from "@/lib/constants";

export function LobbyTopBar() {
  const { balance, walletHidden, profile, displayName } = useLobbyProfile();
  const { count: unreadMessages } = useUnreadMessages();

  const fmt = walletHidden
    ? "••••"
    : balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const initial = (profile?.name || displayName || "P").slice(0, 1).toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/8 bg-[#07060c]/80 px-4 backdrop-blur-md">
      <Link href="/" className="flex min-w-0 items-center gap-2" aria-label={`${SITE_NAME} home`}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-[10px] font-black text-white shadow-[0_0_16px_rgba(255,45,85,0.45)]">
          SH
        </span>
        <span className="truncate text-sm font-extrabold tracking-tight">{SITE_NAME}</span>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/dashboard/wallet"
          className="rounded-full border border-primary/30 bg-white/8 px-3 py-1.5 text-sm font-extrabold tabular-nums text-white shadow-[0_0_16px_rgba(255,45,85,0.25)]"
        >
          ${fmt}
        </Link>
        <Link
          href="/dashboard/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/8"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadMessages > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-bold text-white">
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          )}
        </Link>
        <Link
          href="/dashboard"
          className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-primary/40 bg-primary/20 text-xs font-bold"
          aria-label="Profile"
        >
          {profile?.avatarUrl ? (
            <Image src={profile.avatarUrl} alt="" fill className="object-cover" />
          ) : (
            initial
          )}
        </Link>
      </div>
    </header>
  );
}
