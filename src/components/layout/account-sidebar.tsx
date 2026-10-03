"use client";

import Link from "next/link";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { UnreadBadge } from "@/components/ui/unread-badge";

const ACCOUNT_LINKS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/games", label: "My Games", icon: Gamepad2 },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/deposit", label: "Deposit", icon: Banknote },
  { href: "/dashboard/withdraw", label: "Withdraw / Cash Out", icon: Banknote },
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

const PREFETCH_ROUTES = ACCOUNT_LINKS.map((link) => link.href).filter(
  (href) => !href.startsWith("/#")
);

interface AccountSidebarProps {
  walletSlot?: React.ReactNode;
  className?: string;
}

export function AccountSidebar({ walletSlot, className }: AccountSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const prefetched = useRef(new Set<string>());
  const { count: unreadMessages } = useUnreadMessages();

  function warmRoute(href: string) {
    if (prefetched.current.has(href) || href.startsWith("/#")) return;
    prefetched.current.add(href);
    router.prefetch(href);
  }

  useEffect(() => {
    for (const href of PREFETCH_ROUTES) {
      warmRoute(href);
    }
  }, [router]);

  return (
    <aside
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-white/5 bg-[#161616] p-4 shadow-xl shadow-black/20",
        "min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-6rem)]",
        className
      )}
    >
      {walletSlot}

      <div className="rounded-xl p-4 border border-white/5 bg-[#1a1a1a]">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          My Account
        </p>
        <nav className="space-y-1">
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
                onTouchStart={() => warmRoute(href)}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-white/10 text-white font-medium"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {href === "/dashboard/messages" && (
                  <UnreadBadge count={unreadMessages} />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto space-y-3 pt-2">
        <div className="rounded-xl p-4 bg-gradient-to-br from-[#1f1f1f] to-[#141414] border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <Headphones className="h-4 w-4 text-orange-400" />
            <p className="text-xs font-semibold text-white">24/7 Live Support</p>
          </div>
          <Link
            href="/dashboard/messages"
            prefetch
            onTouchStart={() => warmRoute("/dashboard/messages")}
            className="block text-center py-2 rounded-lg bg-white/5 text-white text-xs font-medium hover:bg-white/10 transition-colors border border-white/10"
          >
            Open Messages
          </Link>
        </div>
        <div className="rounded-xl px-3 py-2.5 flex items-center gap-2 border border-emerald-500/20 bg-emerald-500/5">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-[10px] text-emerald-200/80 leading-snug">
            Secure accounts · Fast setup · Trusted platform
          </p>
        </div>
      </div>
    </aside>
  );
}
