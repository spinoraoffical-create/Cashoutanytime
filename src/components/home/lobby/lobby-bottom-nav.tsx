"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Gamepad2, Wallet, History } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Home", href: "/", icon: Home, match: (p: string) => p === "/" || p === "/home" },
  {
    label: "Play",
    href: "/play",
    icon: Gamepad2,
    match: (p: string) => p === "/play" || p.startsWith("/games") || p === "/dashboard/games",
  },
  {
    label: "Wallet",
    href: "/dashboard/wallet",
    icon: Wallet,
    match: (p: string) =>
      p === "/wallet" ||
      p.startsWith("/dashboard/wallet") ||
      p.startsWith("/dashboard/deposit") ||
      p.startsWith("/dashboard/withdraw"),
  },
  {
    label: "Activity",
    href: "/dashboard/activity",
    icon: History,
    match: (p: string) => p === "/activity" || p.startsWith("/dashboard/activity"),
  },
] as const;

export function LobbyBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lobby-bottom-nav shrink-0 z-50" aria-label="Player navigation">
      <div className="mx-auto flex max-w-[480px] items-center justify-around px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2">
        {TABS.map(({ label, href, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                "flex min-w-[64px] flex-col items-center gap-0.5 rounded-full px-4 py-2 text-[11px] font-semibold transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-md shadow-rose-500/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.85} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
