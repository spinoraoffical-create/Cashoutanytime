"use client";

import Link from "next/link";
import { Bell, Wallet } from "lucide-react";
import { useLobbyProfile } from "@/components/home/lobby/use-lobby-profile";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { SITE_NAME } from "@/lib/constants";

export function LobbyTopBar() {
  const { balance, balancesHidden, profile, displayName } = useLobbyProfile();
  const { count: unreadMessages } = useUnreadMessages();

  const fmt = balancesHidden
    ? "••••"
    : balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const initial = (profile?.name || displayName || "P").slice(0, 1).toUpperCase();

  return (
    <header className="jg-mobile-header sticky top-0 z-20 lg:hidden">
      <div className="jg-mobile-header-row flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex min-h-11 min-w-11 items-center gap-2 rounded-xl pr-1" aria-label={`${SITE_NAME} home`}>
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#160812] text-lg font-black text-[#f3264f] ring-1 ring-white/10">
            SH
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/dashboard/wallet"
            className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-white/15 bg-[#24152e]/90 px-3 text-sm font-extrabold tabular-nums text-[#fcf9fb]"
            aria-label="Wallet balances"
          >
            <Wallet className="h-3.5 w-3.5 text-[#ff718c]" />
            ${fmt}
          </Link>
          <Link
            href="/dashboard/messages"
            className="relative grid h-11 w-11 place-items-center rounded-full text-[#fcf9fb] hover:bg-white/10"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadMessages > 0 && (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#f3264f] px-1 text-[10px] font-extrabold text-white">
                {unreadMessages > 9 ? "9+" : unreadMessages}
              </span>
            )}
          </Link>
          <Link
            href="/dashboard"
            className="grid h-11 w-11 place-items-center rounded-full"
            aria-label="Your profile"
          >
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-[#100914]" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f3264f] text-xs font-black text-white ring-2 ring-[#100914]">
                {initial}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
