"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { LobbyAppShell } from "@/components/home/lobby/lobby-app-shell";
import { LobbySidebar, type LobbyMenuId } from "@/components/home/lobby/lobby-sidebar";
import { useLobbyProfile } from "@/components/home/lobby/use-lobby-profile";
import { useRouter } from "next/navigation";
import { useState } from "react";

const AUTH_PREFIXES = ["/login", "/register", "/reset-password"];
const SKIP_VIP_SHELL_PREFIXES = ["/", "/dashboard", "/admin"];

function shouldSkipVipShell(pathname: string) {
  return SKIP_VIP_SHELL_PREFIXES.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`))
  );
}

function isAuthRoute(pathname: string) {
  return AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

interface VipPageLayoutProps {
  children: ReactNode;
  /** Extra class on main content when inside VIP shell */
  contentClassName?: string;
}

/**
 * Wraps public/marketing pages: logged-out users get Navbar + Footer;
 * logged-in users get the full VIP casino shell (same as lobby/dashboard).
 */
export function VipPageLayout({ children, contentClassName }: VipPageLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoggedIn, ready } = useLobbyProfile();
  const [lobbyMenu, setLobbyMenu] = useState<LobbyMenuId>("lobby");

  if (!ready) {
    return (
      <div className="lobby-cosmic min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-purple-600 border-t-amber-400 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!isLoggedIn || isAuthRoute(pathname) || shouldSkipVipShell(pathname)) {
    return (
      <>
        <Navbar />
        <div className="pt-16 min-h-screen bg-background">{children}</div>
        <Footer fullWidth />
      </>
    );
  }

  function handleLobbyMenu(menu: LobbyMenuId) {
    setLobbyMenu(menu);
    if (menu === "lobby") router.push("/");
    else if (menu === "promotions") router.push("/promotions");
    else if (menu === "vip") router.push("/dashboard/vip");
    else if (menu === "leaderboard") router.push("/leaderboard");
    else if (menu === "support") router.push("/dashboard/messages");
    else router.push("/#games");
  }

  return (
    <LobbyAppShell
      sidebar={<LobbySidebar activeMenu={lobbyMenu} onMenuChange={handleLobbyMenu} />}
    >
      <div className={contentClassName ?? "vip-page-content mx-auto max-w-6xl py-2 px-1 sm:px-2"}>
        {children}
      </div>
    </LobbyAppShell>
  );
}

export { shouldSkipVipShell, isAuthRoute };
