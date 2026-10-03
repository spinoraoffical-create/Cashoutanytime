"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Crown,
  Users,
  StarHalf,
  Target,
  Trophy,
  Sparkles,
  Headphones,
  ShieldCheck,
  Gamepad2,
  Banknote,
  History,
  Wallet,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { UnreadBadge } from "@/components/ui/unread-badge";
import { useLobbyProfile } from "@/components/home/lobby/use-lobby-profile";
import { IconFortuneWheel } from "@/components/home/lobby/lobby-icons";

const ACCOUNT_LINKS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/", label: "Lobby", icon: Home, exact: true },
  { href: "/dashboard/games", label: "My Games", icon: Gamepad2 },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/deposit", label: "Deposit", icon: Banknote },
  { href: "/dashboard/withdraw", label: "Withdraw", icon: Banknote },
  { href: "/dashboard/kyc", label: "KYC Verification", icon: ShieldCheck },
  { href: "/dashboard/deposits", label: "My Deposits", icon: History },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/vip", label: "VIP Status", icon: Crown },
  { href: "/dashboard/referrals", label: "Referrals", icon: Users },
  { href: "/dashboard/reviews", label: "Reviews", icon: StarHalf },
  { href: "/dashboard/rewards", label: "Rewards", icon: Target },
  { href: "/dashboard/achievements", label: "Achievements", icon: Trophy },
  { href: "/dashboard/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/dashboard/activity", label: "Activity", icon: History },
  { href: "/spin", label: "Daily Spin", icon: Sparkles },
];

interface LobbyAccountSidebarProps {
  walletSlot?: React.ReactNode;
  className?: string;
}

export function LobbyAccountSidebar({ walletSlot, className }: LobbyAccountSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const prefetched = useRef(new Set<string>());
  const { count: unreadMessages } = useUnreadMessages();
  const { profile, levelProgress } = useLobbyProfile();
  const level = profile?.level ?? 28;
  const displayName = "Spinora VIP";

  function warmRoute(href: string) {
    if (prefetched.current.has(href) || href.startsWith("/#")) return;
    prefetched.current.add(href);
    router.prefetch(href);
  }

  useEffect(() => {
    for (const { href } of ACCOUNT_LINKS) warmRoute(href);
  }, [router]);

  return (
    <aside className={cn("lobby-sidebar flex flex-col h-full py-3 px-2.5", className)}>
      <div className="lobby-profile-block px-2 pb-3 mb-1 border-b border-purple-500/25">
        <div className="flex items-center gap-2.5">
          <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-amber-400/70 shrink-0 shadow-[0_0_14px_rgba(251,191,36,0.35)]">
            {profile?.avatarUrl ? (
              <Image src={profile.avatarUrl} alt={displayName} fill className="object-cover" sizes="44px" />
            ) : (
              <Image
                src="/images/promos/spinora_model_five.jpg"
                alt={displayName}
                fill
                className="object-cover object-top"
                sizes="44px"
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-black text-white leading-tight">{displayName}</p>
            <p className="text-[11px] font-bold text-amber-400/90">Lv. {level}</p>
          </div>
        </div>
        <div className="mt-2.5 h-[6px] rounded-full bg-purple-950/90 overflow-hidden border border-purple-600/30">
          <div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-violet-400"
            style={{ width: `${Math.max(levelProgress, 35)}%` }}
          />
        </div>
      </div>

      {walletSlot && <div className="px-1 mb-2">{walletSlot}</div>}

      <nav className="flex flex-col gap-0.5 flex-1 py-1 overflow-y-auto scrollbar-hide min-h-0">
        <p className="px-3 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-purple-400/60">My Account</p>
        {ACCOUNT_LINKS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              prefetch={!href.startsWith("/#")}
              onMouseEnter={() => warmRoute(href)}
              onFocus={() => warmRoute(href)}
              className={cn(
                "lobby-nav-btn flex items-center gap-2.5 w-full px-3 py-[8px] rounded-lg text-left transition-all",
                active
                  ? "lobby-nav-btn-active text-white font-bold"
                  : "text-purple-200/75 hover:text-white hover:bg-purple-800/25"
              )}
            >
              <Icon className="w-4 h-4 shrink-0 opacity-90" />
              <span className="text-[10px] font-bold tracking-[0.04em] flex-1">{label}</span>
              {href === "/dashboard/messages" && <UnreadBadge count={unreadMessages} />}
            </Link>
          );
        })}
      </nav>

      <Link href="/dashboard/messages" className="mx-2 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-500/25 bg-purple-900/20 hover:bg-purple-900/35 transition-colors">
        <Headphones className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-[9px] font-bold text-purple-200">24/7 Live Support</span>
      </Link>

      <Link href="/spin" className="lobby-spin-block mt-auto flex flex-col items-center pt-2 pb-1 group shrink-0">
        <div className="relative group-hover:scale-105 transition-transform duration-300">
          <div className="absolute inset-0 bg-amber-400/25 blur-xl rounded-full scale-110" />
          <IconFortuneWheel className="relative w-[64px] h-[64px] drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]" />
        </div>
        <span className="mt-1.5 text-[10px] font-black text-amber-400 tracking-[0.12em]">SPIN &amp; WIN</span>
        <span className="text-[8px] font-bold text-amber-300/60 tracking-wide">WIN BIG EVERYDAY!</span>
      </Link>
    </aside>
  );
}
