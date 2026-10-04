"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useLobbyProfile } from "@/components/home/lobby/use-lobby-profile";
import { LobbyAppShell } from "@/components/home/lobby/lobby-app-shell";
import { LobbySidebar, type LobbyMenuId } from "@/components/home/lobby/lobby-sidebar";
import { LoggedInHomeStrip, PublicHome } from "@/components/player/public-home";
import { GAMES, type Game } from "@/lib/games";

const ActivityToast = dynamic(
  () => import("@/components/ui/ActivityToast").then((m) => m.ActivityToast),
  { ssr: false, loading: () => null }
);

function DeferredActivityToast() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => setReady(true), { timeout: 8000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(() => setReady(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) return null;
  return <ActivityToast />;
}

interface HomeLandingShellProps {
  initialLoggedIn?: boolean;
  linkedGameSlugs?: string[];
  lobbyCatalog?: Game[];
  hero?: ReactNode;
  cmsSections?: ReactNode;
}

export function HomeLandingShell({
  initialLoggedIn = false,
  lobbyCatalog = GAMES,
}: HomeLandingShellProps) {
  const { isLoggedIn, ready: authReady, profile } = useLobbyProfile();
  const loggedIn = authReady ? isLoggedIn : initialLoggedIn;
  const [lobbyMenu, setLobbyMenu] = useState<LobbyMenuId>("lobby");

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div
          className="w-10 h-10 rounded-full border-2 border-primary/40 border-t-primary animate-spin"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (loggedIn) {
    return (
      <LobbyAppShell
        sidebar={<LobbySidebar activeMenu={lobbyMenu} onMenuChange={setLobbyMenu} />}
      >
        <LoggedInHomeStrip games={lobbyCatalog} kycStatus={profile?.kycStatus} />
        <DeferredActivityToast />
      </LobbyAppShell>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 pt-4">
      <PublicHome games={lobbyCatalog} />
    </div>
  );
}
