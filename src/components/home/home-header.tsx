"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Search, Menu } from "lucide-react";
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
  { ssr: false, loading: () => <div className="hidden sm:block w-9 h-9 rounded-lg bg-white/5" aria-hidden /> }
);

interface HomeHeaderProps {
  onSearchClick: () => void;
  onMenuClick?: () => void;
  assumeLoggedIn?: boolean;
}

export function HomeHeader({ onSearchClick, onMenuClick, assumeLoggedIn = false }: HomeHeaderProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(assumeLoggedIn);

  useEffect(() => {
    if (assumeLoggedIn) return;

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
  }, [assumeLoggedIn]);

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 py-3 bg-[#121212]/95 backdrop-blur-md border-b border-white/5 overflow-visible">
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors shrink-0"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <AnimatedLogo
          textClassName="inline-flex text-xs sm:text-xl"
          imageSize={28}
          className="min-w-0 overflow-hidden [&_img]:sm:w-9 [&_img]:sm:h-9"
          href={isLoggedIn ? "/" : "/"}
        />
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={onSearchClick}
          className="hidden sm:flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-gray-900 hover:opacity-90 transition-opacity shrink-0"
          aria-label="Search games"
        >
          <Search className="h-5 w-5" />
        </button>

        {isLoggedIn && (
          <NotificationDropdown buttonClassName="w-9 h-9 sm:w-10 sm:h-10" />
        )}

        {isLoggedIn ? (
          <>
            <Link
              href="/dashboard/deposit"
              prefetch={false}
              className="inline-flex px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-gray-900 text-[10px] sm:text-sm font-bold hover:opacity-90 transition-opacity shrink-0 whitespace-nowrap"
            >
              Deposit
            </Link>
            <UserAccountMenu compact />
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="inline text-xs sm:text-sm font-medium text-muted-foreground hover:text-white transition-colors px-1.5 sm:px-2 shrink-0 whitespace-nowrap"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-gray-900 text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity shrink-0 whitespace-nowrap"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
