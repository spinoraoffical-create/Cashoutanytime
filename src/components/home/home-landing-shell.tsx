"use client";

import { useLobbyProfile } from "@/components/home/lobby/use-lobby-profile";
import { LobbyAppShell } from "@/components/home/lobby/lobby-app-shell";
import { PublicHome } from "@/components/player/public-home";
import { PlayerHome } from "@/components/player/player-home";
import { GAMES, type Game } from "@/lib/games";
import type { PublicPromotion } from "@/lib/data/promotions-public";

interface HomeLandingShellProps {
  initialLoggedIn?: boolean;
  linkedGameSlugs?: string[];
  lobbyCatalog?: Game[];
  promotions?: PublicPromotion[];
  wallet?: { balance: number; cashout: number; freeplay: number };
  verify?: { show: boolean; href: string; title: string; body?: string } | null;
  dailySpinEnabled?: boolean;
}

export function HomeLandingShell({
  initialLoggedIn = false,
  lobbyCatalog = GAMES,
  linkedGameSlugs = [],
  promotions = [],
  wallet = { balance: 0, cashout: 0, freeplay: 0 },
  verify = null,
  dailySpinEnabled = false,
}: HomeLandingShellProps) {
  const { isLoggedIn, ready: authReady } = useLobbyProfile();
  const loggedIn = authReady ? isLoggedIn : initialLoggedIn;

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-primary/40 border-t-primary"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (loggedIn) {
    return (
      <LobbyAppShell>
        <PlayerHome
          games={lobbyCatalog}
          linkedSlugs={linkedGameSlugs}
          promotions={promotions}
          wallet={wallet}
          verify={verify}
          dailySpinEnabled={dailySpinEnabled}
        />
      </LobbyAppShell>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 pt-4">
      <PublicHome games={lobbyCatalog} />
    </div>
  );
}
