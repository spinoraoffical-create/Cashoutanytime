"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Gamepad2, Gift, User, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function MobileBottomNav() {
  const pathname = usePathname();
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
      if (event === "SIGNED_OUT") setIsLoggedIn(false);
      else if (event === "SIGNED_IN") setIsLoggedIn(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // VIP shell has its own bottom nav when logged in
  if (isLoggedIn) return null;

  const navItems = [
    { label: "Lobby", href: "/", icon: Home },
    { label: "Dashboard", href: "/dashboard", icon: Gamepad2 },
    { label: "Daily Spin", href: "/spin", icon: Gift },
    { label: "KYC ID", href: "/dashboard/kyc", icon: ShieldCheck },
    { label: "Account", href: "/dashboard", icon: User },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-amber-500/30 bg-black/85 backdrop-blur-2xl p-2 px-4 shadow-2xl">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all ${
                isActive ? "text-amber-400 font-bold scale-105" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
