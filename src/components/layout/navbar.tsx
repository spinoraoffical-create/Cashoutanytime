"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Search, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedLogo } from "@/components/ui/animated-logo";
import { createClient } from "@/lib/supabase/client";

const NotificationDropdown = dynamic(
  () =>
    import("@/components/notifications/notification-dropdown").then(
      (m) => m.NotificationDropdown
    ),
  { ssr: false, loading: () => null }
);

const UserAccountMenu = dynamic(
  () => import("@/components/layout/user-account-menu").then((m) => m.UserAccountMenu),
  {
    ssr: false,
    loading: () => <div className="hidden sm:block h-9 w-9 rounded-full bg-white/5" aria-hidden />,
  }
);

const navLinks = [
  { href: "/games", label: "Games" },
  { href: "/blog", label: "Blog" },
  { href: "/promotions", label: "Promotions" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/vip", label: "VIP" },
  { href: "/support", label: "Support" },
];

type NavbarProps = {
  /** Homepage: open sidebar drawer on mobile */
  onMenuClick?: () => void;
  /** Homepage: focus game search */
  onSearchClick?: () => void;
};

export function Navbar({ onMenuClick, onSearchClick }: NavbarProps = {}) {
  const [open, setOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setIsLoggedIn(true);
      } else if (event === "SIGNED_OUT") {
        setIsLoggedIn(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  function closeMobile() {
    setOpen(false);
  }

  const authActions = isLoggedIn ? (
    <>
      <NotificationDropdown buttonClassName="w-9 h-9" />
      <Button size="sm" asChild className="hidden sm:inline-flex">
        <Link href="/dashboard/deposit">Deposit</Link>
      </Button>
      <UserAccountMenu compact />
    </>
  ) : (
    <>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/login">Login</Link>
      </Button>
      <Button size="sm" asChild>
        <Link href="/register">Get Started</Link>
      </Button>
    </>
  );

  const mobileAuthActions = isLoggedIn ? (
    <>
      <Button asChild>
        <Link href="/dashboard/deposit" onClick={closeMobile}>
          Deposit
        </Link>
      </Button>
      <Button variant="outline" asChild>
        <Link href="/dashboard" onClick={closeMobile}>
          Dashboard
        </Link>
      </Button>
    </>
  ) : (
    <>
      <Button variant="outline" asChild>
        <Link href="/login" onClick={closeMobile}>
          <User className="h-4 w-4" /> Login
        </Link>
      </Button>
      <Button asChild>
        <Link href="/register" onClick={closeMobile}>
          Get Started
        </Link>
      </Button>
    </>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <AnimatedLogo textClassName="text-lg" />
        </div>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          {onSearchClick && (
            <button
              type="button"
              onClick={onSearchClick}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-gray-900 hover:opacity-90 transition-opacity"
              aria-label="Search games"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
          {authActions}
        </div>

        <div className="flex md:hidden items-center gap-2">
          {onSearchClick && (
            <button
              type="button"
              onClick={onSearchClick}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-gray-900 hover:opacity-90 transition-opacity shrink-0"
              aria-label="Search games"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
          {!onMenuClick && (
            <button
              className="p-2 text-foreground"
              onClick={() => setOpen(!open)}
              aria-label="Toggle menu"
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          )}
          {isLoggedIn && <UserAccountMenu compact />}
        </div>
      </nav>

      <AnimatePresence>
        {open && !onMenuClick && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-border"
          >
            <div className="flex flex-col gap-2 p-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                  onClick={closeMobile}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 pt-2 border-t border-border">{mobileAuthActions}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
