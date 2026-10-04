"use client";

import Link from "next/link";
import Image from "next/image";
import { Bell, Menu } from "lucide-react";
import { useLobbyProfile } from "@/components/home/lobby/use-lobby-profile";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { SITE_NAME } from "@/lib/constants";

interface LobbyTopBarProps {
  onMenuClick?: () => void;
}

export function LobbyTopBar({ onMenuClick }: LobbyTopBarProps) {
  const { balance, walletHidden, profile, displayName } = useLobbyProfile();
  const { count: unreadMessages } = useUnreadMessages();

  const fmt = walletHidden
    ? "••••"
    : balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const initial = (profile?.name || displayName || "P").slice(0, 1).toUpperCase();

  return (
    <header className="shrink-0 h-14 flex items-center justify-between px-3 sm:px-4 gap-2 border-b border-white/6 bg-[#0b0e14]/90 backdrop-blur-md">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-white/80 hover:bg-white/10"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>
        <Link href="/" className="flex items-center gap-2 min-w-0" aria-label={`${SITE_NAME} home`}>
          <Image src="/logo.webp" alt="" width={32} height={32} className="rounded-lg shrink-0" />
          <span className="truncate text-sm font-extrabold tracking-tight">{SITE_NAME}</span>
        </Link>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/dashboard/wallet"
          className="rounded-full bg-white/8 border border-white/10 px-3 py-1.5 text-sm font-extrabold tabular-nums text-white"
        >
          ${fmt}
        </Link>
        <Link
          href="/dashboard/notifications"
          className="relative w-9 h-9 rounded-full bg-white/8 border border-white/10 flex items-center justify-center"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadMessages > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-primary text-[8px] font-bold text-white flex items-center justify-center">
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          )}
        </Link>
        <Link
          href="/dashboard"
          className="relative w-9 h-9 rounded-full bg-primary/20 border border-primary/40 overflow-hidden flex items-center justify-center text-xs font-bold"
          aria-label="Account"
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
