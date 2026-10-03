"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Gamepad2,
  MessageSquare,
  Banknote,
  Crown,
  Users,
  Star,
  Target,
  Shield,
  BarChart3,
  LogOut,
  Menu,
  X,
  History,
  Wallet,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedLogo, AnimatedLogoText } from "@/components/ui/animated-logo";
import { cn } from "@/lib/utils";
import { logoutUser } from "@/lib/auth/logout";
import { WalletCardLoader } from "@/components/wallet/wallet-card-loader";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { UnreadBadge } from "@/components/ui/unread-badge";

const NotificationDropdown = dynamic(
  () =>
    import("@/components/notifications/notification-dropdown").then(
      (m) => m.NotificationDropdown
    ),
  { ssr: false, loading: () => null }
);

const userLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/#games", label: "Games", icon: Gamepad2, gamesLink: true as const },
  { href: "/dashboard/deposit", label: "Deposit", icon: Banknote },
  { href: "/dashboard/deposits", label: "My Deposits", icon: History },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/vip", label: "VIP Status", icon: Crown },
  { href: "/dashboard/referrals", label: "Referrals", icon: Users },
  { href: "/dashboard/reviews", label: "Reviews", icon: Star },
];

const adminLinks = [
  { href: "/admin", label: "Admin Panel", icon: Shield },
  { href: "/admin/chat", label: "Customer Chat", icon: MessageSquare },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/fraud", label: "Fraud / Flags", icon: ShieldAlert },
  { href: "/admin/transactions", label: "Transactions", icon: History },
  { href: "/admin/game-loads", label: "Wallet Loads", icon: Banknote },
  { href: "/admin/deposits", label: "Deposits", icon: Wallet },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
];

const ALL_NAV_ROUTES = [
  ...userLinks.map((l) => l.href),
  ...adminLinks.map((l) => l.href),
].filter((href) => !href.startsWith("/#"));

interface DashboardNavProps {
  isAdmin?: boolean;
}

function NavLinks({
  pathname,
  isAdmin,
  onNavigate,
  unreadMessages,
  warmRoute,
}: {
  pathname: string;
  isAdmin: boolean;
  onNavigate?: () => void;
  unreadMessages: number;
  warmRoute: (href: string) => void;
}) {
  return (
    <>
      {userLinks.map((link) => {
        const Icon = link.icon;
        const active = link.gamesLink
          ? pathname === "/" || pathname.startsWith("/games")
          : pathname === link.href ||
            (link.href !== "/dashboard" && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            prefetch
            onClick={onNavigate}
            onMouseEnter={() => warmRoute(link.href)}
            onFocus={() => warmRoute(link.href)}
            onTouchStart={() => warmRoute(link.href)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              active
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{link.label}</span>
            {link.href === "/dashboard/messages" && !isAdmin && (
              <UnreadBadge count={unreadMessages} />
            )}
          </Link>
        );
      })}

      {isAdmin && (
        <>
          <div className="pt-4 pb-2 px-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">
              Admin Only
            </p>
          </div>
          {adminLinks.map((link) => {
            const Icon = link.icon;
            const active =
              pathname === link.href ||
              (link.href !== "/admin" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch
                onClick={onNavigate}
                onMouseEnter={() => warmRoute(link.href)}
                onFocus={() => warmRoute(link.href)}
                onTouchStart={() => warmRoute(link.href)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{link.label}</span>
                {link.href === "/admin/chat" && (
                  <UnreadBadge count={unreadMessages} />
                )}
              </Link>
            );
          })}
        </>
      )}
    </>
  );
}

export function DashboardNav({ isAdmin = false }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const prefetched = useRef(new Set<string>());
  const [mobileOpen, setMobileOpen] = useState(false);
  const { count: unreadMessages } = useUnreadMessages();

  function warmRoute(href: string) {
    if (prefetched.current.has(href) || href.startsWith("/#")) return;
    prefetched.current.add(href);
    router.prefetch(href);
  }

  useEffect(() => {
    const routes = isAdmin ? ALL_NAV_ROUTES : userLinks.map((l) => l.href).filter((h) => !h.startsWith("/#"));
    for (const href of routes) {
      warmRoute(href);
    }
  }, [router, isAdmin]);

  async function handleLogout() {
    await logoutUser("/");
  }

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 glass border-b border-border h-14 flex items-center justify-between px-4">
        <AnimatedLogo imageSize={28} textClassName="text-sm" href="/dashboard" />
        <div className="flex items-center gap-1">
          <NotificationDropdown buttonClassName="bg-transparent border-transparent hover:bg-muted" />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-muted"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-[110] bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-[120] w-72 glass border-r border-border flex flex-col"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <AnimatedLogoText textClassName="text-base" />
                <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                <NavLinks
                  pathname={pathname}
                  isAdmin={isAdmin}
                  onNavigate={() => setMobileOpen(false)}
                  unreadMessages={unreadMessages}
                  warmRoute={warmRoute}
                />
              </nav>
              <div className="p-3 border-t border-border">
                <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col glass border-r border-border min-h-screen relative z-30">
        <div className="p-4 border-b border-border flex flex-col gap-3 overflow-visible">
          <div className="flex items-center justify-between gap-2">
            <AnimatedLogo imageSize={32} textClassName="text-sm" className="min-w-0" href="/" />
            <NotificationDropdown align="right" buttonClassName="bg-muted/50 border-border shrink-0" />
          </div>
          <WalletCardLoader />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavLinks pathname={pathname} isAdmin={isAdmin} unreadMessages={unreadMessages} warmRoute={warmRoute} />
        </nav>
        <div className="p-3 border-t border-border">
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>
    </>
  );
}
