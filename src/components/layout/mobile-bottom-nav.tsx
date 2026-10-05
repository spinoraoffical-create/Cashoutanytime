"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Gamepad2, HelpCircle, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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

  if (isLoggedIn) return null;
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) return null;

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Play", href: "/play", icon: Gamepad2 },
    { label: "Support", href: "/support", icon: HelpCircle },
    { label: "Sign in", href: "/login", icon: LogIn },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/8 bg-[#07060c]/92 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex min-w-[64px] flex-col items-center gap-0.5 rounded-full px-3 py-2 text-[11px] font-semibold",
                isActive ? "hub-neon-pill bg-primary text-white" : "text-zinc-400"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
