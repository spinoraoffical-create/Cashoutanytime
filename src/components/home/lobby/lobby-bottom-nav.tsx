"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingCart,
  Puzzle,
  Landmark,
  Banknote,
  Crown,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LEFT = [
  { label: "Shop", href: "/dashboard/deposit", icon: ShoppingCart },
  { label: "Redeem", href: "/dashboard/withdraw", icon: Puzzle },
  { label: "Bank", href: "/dashboard/wallet", icon: Landmark },
];

const RIGHT = [
  { label: "Withdraw", href: "/dashboard/withdraw", icon: Banknote },
  { label: "VIP Pass", href: "/dashboard/vip", icon: Crown },
  { label: "Chat", href: "/dashboard/messages", icon: MessageCircle },
];

export function LobbyBottomNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || (href !== "/" && pathname.startsWith(href));
  }

  return (
    <nav className="lobby-bottom-nav shrink-0 z-50">
      <div className="flex items-end justify-between px-4 sm:px-8 lg:pl-[calc(188px+1rem)] xl:pl-[calc(200px+1rem)] pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-0.5">
        <div className="flex items-end gap-4 sm:gap-6 flex-1 justify-start">
          {LEFT.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className={cn(
                "lobby-bottom-item flex flex-col items-center gap-0.5 min-w-[48px]",
                isActive(href) ? "text-amber-400" : "text-purple-300/50 hover:text-purple-200"
              )}
            >
              <Icon className="h-[20px] w-[20px]" strokeWidth={1.75} />
              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wide">{label}</span>
            </Link>
          ))}
        </div>

        <Link href="/dashboard/deposit" className="lobby-deposit-btn relative mx-2 sm:mx-6 shrink-0 -mt-4 sm:-mt-6">
          <div className="absolute -inset-4 bg-amber-400/25 blur-2xl rounded-full pointer-events-none" />
          <span className="absolute -left-5 bottom-0 w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] hidden sm:block" />
          <span className="absolute -right-4 bottom-1 w-2.5 h-2.5 rounded-full bg-yellow-300 shadow-[0_0_6px_rgba(251,191,36,0.8)] hidden sm:block" />
          <span className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(251,191,36,0.7)] hidden sm:block" />
          <div className="relative px-8 sm:px-14 py-2 sm:py-3 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 text-amber-950 font-black text-xs sm:text-[15px] uppercase tracking-[0.12em] border-2 border-amber-100/80 shadow-[0_0_45px_rgba(251,191,36,0.65),0_4px_0_#b45309] hover:brightness-110 transition-all">
            Deposit
          </div>
        </Link>

        <div className="flex items-end gap-4 sm:gap-6 flex-1 justify-end">
          {RIGHT.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className={cn(
                "lobby-bottom-item flex flex-col items-center gap-0.5 min-w-[48px]",
                isActive(href) ? "text-amber-400" : "text-purple-300/50 hover:text-purple-200"
              )}
            >
              <Icon className="h-[20px] w-[20px]" strokeWidth={1.75} />
              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wide">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
