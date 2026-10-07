"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gamepad2,
  Gift,
  Headphones,
  History,
  Home,
  Shield,
  Trophy,
  User,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/player/sign-out-button";

const MAIN = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" || p === "/home" },
  { href: "/play", label: "Play", icon: Gamepad2, match: (p: string) => p === "/play" || p.startsWith("/games") },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet, match: (p: string) => p.startsWith("/dashboard/wallet") || p.startsWith("/dashboard/deposit") || p.startsWith("/dashboard/withdraw") },
  { href: "/dashboard/activity", label: "Activity", icon: History, match: (p: string) => p.startsWith("/dashboard/activity") },
];

const EXPLORE = [
  { href: "/terms", label: "Rules", icon: Trophy, match: (p: string) => p === "/terms" },
  { href: "/dashboard/referrals", label: "Referrals", icon: Gift, match: (p: string) => p.startsWith("/dashboard/referrals") },
  { href: "/dashboard/rewards", label: "Rewards", icon: Gift, match: (p: string) => p.startsWith("/dashboard/rewards") },
];

const MORE = [
  { href: "/dashboard/affiliate", label: "Affiliate Program", icon: Gift, match: (p: string) => p.startsWith("/dashboard/affiliate") },
  { href: "/dashboard/responsible", label: "Responsible Gaming", icon: Shield, match: (p: string) => p.startsWith("/dashboard/responsible") },
  { href: "/support", label: "Support", icon: Headphones, match: (p: string) => p.startsWith("/support") },
  { href: "/dashboard", label: "Account", icon: User, match: (p: string) => p === "/dashboard" },
];

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: typeof MAIN;
  pathname: string;
}) {
  return (
    <div>
      {label ? (
        <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#b9b3c6]/70">{label}</p>
      ) : null}
      <ul className="space-y-1">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href + item.label}>
              <Link
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold",
                  active ? "text-[#fcf9fb]" : "text-[#b9b3c6] hover:bg-white/5 hover:text-[#fcf9fb]"
                )}
              >
                {active ? <span className="lobby-nav-btn-active absolute inset-0 rounded-xl" /> : null}
                <Icon className="relative h-[18px] w-[18px] shrink-0" />
                <span className="relative">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LobbyDesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="jg-desktop-sidebar hidden h-full w-[232px] shrink-0 flex-col lg:flex">
      <div className="border-b border-white/10 px-5 pb-5 pt-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#160812] text-lg font-black text-[#f3264f] ring-1 ring-white/10">
            SH
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-black leading-[1.05]">
              Sweepstakes
              <br />
              Hub
            </span>
            <span className="mt-0.5 text-[11px] text-[#b9b3c6]">Sweepstakes gaming</span>
          </span>
        </Link>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Main navigation">
        <NavGroup label="" items={MAIN} pathname={pathname} />
        <NavGroup label="Explore" items={EXPLORE} pathname={pathname} />
        <NavGroup label="More" items={MORE} pathname={pathname} />
      </nav>
      <div className="border-t border-white/10 px-3 py-4">
        <SignOutButton className="rounded-xl border-0 bg-transparent px-3 py-2.5 text-left text-[#b9b3c6] hover:bg-[#f3264f]/10 hover:text-[#ff718c]" />
      </div>
    </aside>
  );
}
