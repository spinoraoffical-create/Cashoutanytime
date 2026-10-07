"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Search, Wallet } from "lucide-react";
import { useLobbyProfile } from "@/components/home/lobby/use-lobby-profile";
import { useUnreadMessages } from "@/hooks/use-unread-messages";

function pageTitle(pathname: string) {
  if (pathname === "/" || pathname === "/home") return "Home";
  if (pathname.startsWith("/games/")) return "Game detail";
  if (pathname === "/play" || pathname.startsWith("/play/")) return "Play";
  if (pathname.startsWith("/dashboard/wallet") || pathname.startsWith("/dashboard/deposit") || pathname.startsWith("/dashboard/withdraw")) {
    return "Wallet";
  }
  if (pathname.startsWith("/dashboard/activity")) return "Activity";
  if (pathname === "/dashboard") return "Account";
  if (pathname.startsWith("/support")) return "Support";
  if (pathname.startsWith("/help")) return "Help";
  if (pathname.startsWith("/dashboard/messages")) return "Inbox";
  if (pathname.startsWith("/dashboard/security")) return "Security";
  if (pathname.startsWith("/dashboard/responsible")) return "Responsible Gaming";
  if (pathname.startsWith("/dashboard/affiliate")) return "Affiliate Program";
  if (pathname.startsWith("/dashboard/rewards")) return "Rewards";
  if (pathname.startsWith("/dashboard/referrals")) return "Referrals";
  return "Sweepstakes Hub";
}

export function LobbyDesktopHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { balance, balancesHidden, profile, displayName } = useLobbyProfile();
  const { count: unreadMessages } = useUnreadMessages();
  const fmt = balancesHidden
    ? "••••"
    : balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const initial = (profile?.name || displayName || "P").slice(0, 1).toUpperCase();
  const onPlay = pathname === "/play" || pathname.startsWith("/games");

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") || "").trim();
    router.push(q ? `/play?q=${encodeURIComponent(q)}` : "/play");
  }

  return (
    <header className="jg-desktop-header sticky top-0 z-30 hidden items-center gap-4 px-6 lg:flex">
      <div className="min-w-[150px] shrink-0 text-lg font-black">{pageTitle(pathname)}</div>
      {onPlay ? (
        <div className="flex-1" aria-hidden />
      ) : (
        <form onSubmit={onSearch} className="max-w-xl flex-1">
          <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#24152e]/80 px-3.5">
            <Search className="h-4 w-4 text-[#b9b3c6]" />
            <input
              name="q"
              placeholder="Search games"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#b9b3c6]"
            />
          </label>
        </form>
      )}
      <div className="flex items-center gap-1.5">
        <Link
          href="/dashboard/wallet"
          className="hidden h-11 items-center gap-2 rounded-2xl border border-white/10 bg-[#24152e]/80 px-3 xl:inline-flex"
        >
          <Wallet className="h-4 w-4 text-[#ff718c]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#b9b3c6]">Wallet</span>
          <span className="font-mono text-sm font-extrabold tabular-nums">${fmt}</span>
        </Link>
        <Link
          href="/dashboard/messages"
          className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-white/10"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadMessages > 0 ? (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#f3264f] px-1 text-[10px] font-extrabold text-white">
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          ) : null}
        </Link>
        <Link href="/dashboard" className="grid h-11 w-11 place-items-center rounded-full" aria-label="Your profile">
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
    </header>
  );
}
