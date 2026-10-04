"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { LobbyAppShell } from "@/components/home/lobby/lobby-app-shell";
import { useLobbyProfile } from "@/components/home/lobby/use-lobby-profile";

const AUTH_PREFIXES = ["/login", "/register", "/reset-password"];
const SKIP_PLAYER_SHELL = ["/admin"];

function isAuthRoute(pathname: string) {
  return AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function shouldSkipPlayerShell(pathname: string) {
  return SKIP_PLAYER_SHELL.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

interface VipPageLayoutProps {
  children: ReactNode;
  contentClassName?: string;
}

export function VipPageLayout({ children, contentClassName }: VipPageLayoutProps) {
  const pathname = usePathname();
  const { isLoggedIn, ready } = useLobbyProfile();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-primary/40 border-t-primary"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!isLoggedIn || isAuthRoute(pathname) || shouldSkipPlayerShell(pathname)) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-background pt-16">{children}</div>
        <Footer fullWidth />
      </>
    );
  }

  return (
    <LobbyAppShell>
      <div className={contentClassName ?? "vip-page-content mx-auto w-full py-1"}>{children}</div>
    </LobbyAppShell>
  );
}

export { shouldSkipPlayerShell as shouldSkipVipShell, isAuthRoute };
