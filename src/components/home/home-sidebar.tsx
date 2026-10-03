"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Clock,
  Star,
  TrendingUp,
  Award,
  Search,
  Crown,
  Sparkles,
  LayoutDashboard,
  MessageSquare,
  Users,
  Headphones,
  ShieldCheck,
  StarHalf,
  Target,
  Gamepad2,
  Banknote,
} from "lucide-react";
import type { GameTab } from "@/lib/games";
import { cn } from "@/lib/utils";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { UnreadBadge } from "@/components/ui/unread-badge";

const SIDEBAR_LINKS: { id: GameTab; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "All Games", icon: LayoutGrid },
  { id: "upcoming", label: "Upcoming Games", icon: Clock },
  { id: "popular", label: "Popular Games", icon: Star },
  { id: "trending", label: "Trending Games", icon: TrendingUp },
  { id: "topRated", label: "Top Rated Games", icon: Award },
];

const ACCOUNT_LINKS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/games", label: "All Games", icon: Gamepad2 },
  { href: "/blog", label: "Blog & Guides", icon: Target },
  { href: "/dashboard/deposit", label: "Deposit", icon: Banknote },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/vip", label: "VIP Status", icon: Crown },
  { href: "/dashboard/referrals", label: "Referrals", icon: Users },
  { href: "/dashboard/reviews", label: "Reviews", icon: StarHalf },
  { href: "/spin", label: "Daily Spin", icon: Sparkles },
];

const PREFETCH_ROUTES = ACCOUNT_LINKS.map((link) => link.href).filter(
  (href) => !href.startsWith("/#") && href !== "/"
);

interface HomeSidebarProps {
  activeTab: GameTab;
  onTabChange: (tab: GameTab) => void;
  onSearchClick: () => void;
  walletSlot?: React.ReactNode;
  className?: string;
  /** From server session — sidebar renders account links on first paint. */
  initialLoggedIn?: boolean;
}

function SidebarFooter({
  isLoggedIn,
  onWarmMessages,
}: {
  isLoggedIn: boolean;
  onWarmMessages?: () => void;
}) {
  return (
    <div className="mt-auto space-y-3 pt-2">
      <div className="rounded-xl p-4 bg-gradient-to-br from-[#1f1f1f] to-[#141414] border border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <Headphones className="h-4 w-4 text-orange-400" />
          <p className="text-xs font-semibold text-white">24/7 Live Support</p>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
          Need help? Chat with our team anytime.
        </p>
        <Link
          href={isLoggedIn ? "/dashboard/messages" : "/support"}
          onTouchStart={() => isLoggedIn && onWarmMessages?.()}
          className="block text-center py-2 rounded-lg bg-white/5 text-white text-xs font-medium hover:bg-white/10 transition-colors border border-white/10"
        >
          {isLoggedIn ? "Open Messages" : "Contact Support"}
        </Link>
      </div>

      <div className="rounded-xl px-3 py-2.5 flex items-center gap-2 border border-emerald-500/20 bg-emerald-500/5">
        <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
        <p className="text-[10px] text-emerald-200/80 leading-snug">
          Secure accounts · Fast setup · Trusted platform
        </p>
      </div>
    </div>
  );
}

export function HomeSidebar({
  activeTab,
  onTabChange,
  onSearchClick,
  walletSlot,
  className,
  initialLoggedIn = false,
}: HomeSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const prefetched = useRef(new Set<string>());
  const [isLoggedIn, setIsLoggedIn] = useState(initialLoggedIn);
  const { count: unreadMessages } = useUnreadMessages();

  function warmRoute(href: string) {
    if (prefetched.current.has(href) || href.startsWith("/#") || href === "/") return;
    prefetched.current.add(href);
    router.prefetch(href);
  }

  useEffect(() => {
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      if (!supabase) return;
      void supabase.auth.getUser().then(({ data: { user } }) => {
        const loggedIn = !!user;
        setIsLoggedIn(loggedIn);
        if (loggedIn) {
          for (const href of PREFETCH_ROUTES) {
            warmRoute(href);
          }
        }
      });
    });
  }, [router]);

  return (
    <aside
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-white/5 bg-[#161616] p-4 shadow-xl shadow-black/20",
        "min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-6rem)]",
        className
      )}
    >
      {isLoggedIn && walletSlot}

      <button
        type="button"
        onClick={onSearchClick}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-gray-900 font-bold text-sm hover:from-orange-400 hover:to-amber-400 transition-all shadow-lg shadow-orange-500/20"
      >
        <Search className="h-4 w-4" />
        Search Games
      </button>

      {isLoggedIn && (
        <div className="rounded-xl p-4 border border-white/5 bg-[#1a1a1a]">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            My Account
          </p>
          <nav className="space-y-1">
            {ACCOUNT_LINKS.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href || (href !== "/" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch={!href.startsWith("/#") && href !== "/"}
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
      )}

      <div className="rounded-xl p-4 border border-white/5 bg-[#1a1a1a]">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Explore Games
        </p>
        <nav className="space-y-1">
          {SIDEBAR_LINKS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                activeTab === id
                  ? "bg-white/10 text-white font-medium"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {!isLoggedIn && (
        <>
          <div className="rounded-xl p-4 bg-gradient-to-br from-purple-700/80 to-purple-950 border border-purple-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-5 w-5 text-amber-400" />
              <h3 className="font-semibold text-sm text-white">Unlock Premium Access</h3>
            </div>
            <p className="text-xs text-purple-200/70 mb-3">
              Experience VIP perks, bigger wins, and exclusive features.
            </p>
            <Link
              href="/login"
              className="block text-center py-2 rounded-lg bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-colors border border-white/10"
            >
              Login & Access All
            </Link>
          </div>

          <div className="rounded-xl p-4 bg-gradient-to-br from-purple-600/60 to-indigo-950 border border-purple-400/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-amber-300" />
              <h3 className="font-semibold text-sm text-white">New Here?</h3>
            </div>
            <p className="text-xs text-purple-200/70 mb-3">Claim your free account & start playing!</p>
            <Link
              href="/register"
              className="block text-center py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-gray-900 text-xs font-bold hover:opacity-90 transition-opacity"
            >
              Sign Up
            </Link>
          </div>
        </>
      )}

      {isLoggedIn && (
        <div className="rounded-xl p-4 bg-gradient-to-br from-purple-700/80 to-purple-950 border border-purple-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-5 w-5 text-amber-400" />
            <h3 className="font-semibold text-sm text-white">Level Up Now</h3>
          </div>
          <p className="text-xs text-purple-200/70 mb-3">Unlock VIP rewards and exclusive perks.</p>
          <Link
            href="/dashboard/vip"
            onTouchStart={() => warmRoute("/dashboard/vip")}
            className="block text-center py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-gray-900 text-xs font-bold hover:opacity-90 transition-opacity"
          >
            View VIP Status
          </Link>
        </div>
      )}

      <SidebarFooter
        isLoggedIn={isLoggedIn}
        onWarmMessages={() => warmRoute("/dashboard/messages")}
      />
    </aside>
  );
}

export { SIDEBAR_LINKS };
