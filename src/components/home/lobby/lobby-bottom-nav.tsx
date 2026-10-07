"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, History, Home, Wallet } from "lucide-react";
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
      p.startsWith("/dashboard/wallet") ||
      p.startsWith("/dashboard/deposit") ||
      p.startsWith("/dashboard/withdraw"),
  },
  {
    label: "Activity",
    href: "/dashboard/activity",
    icon: History,
    match: (p: string) => p.startsWith("/dashboard/activity"),
  },
] as const;

export function LobbyBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lobby-bottom-nav z-30 shrink-0 lg:hidden" aria-label="Player navigation">
      <div className="jg-bottom-nav mx-auto mb-3 w-[calc(100%-1.5rem)] max-w-[600px] overflow-hidden rounded-2xl">
        <div className="grid grid-cols-4">
          {TABS.map(({ label, href, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={label}
                href={href}
                aria-label={label}
                className="relative grid min-h-[56px] place-items-center py-2 text-[11px] font-bold"
              >
                {active ? <span className="jg-nav-active-pill absolute inset-1.5 rounded-xl" /> : null}
                <span className={cn("relative grid place-items-center gap-0.5", active ? "text-white" : "text-[#b9b3c6]")}>
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                  <span className="leading-none">{label}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
