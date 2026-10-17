"use client";

import { VipGamePageShellWithWallet } from "@/components/layout/vip-game-page-shell";
import { GameLandingClient } from "@/components/games/game-landing-client";
import type { Game } from "@/lib/games";

interface GamePageShellProps {
  game: Game;
  autoCreate?: boolean;
  walletLoadEnabled?: boolean;
  providerReady?: boolean;
  initialGameAccount?: {
    game_username: string;
    game_password: string | null;
  } | null;
  guides?: { slug: string; title: string }[];
}

export function GamePageShell({
  game,
  autoCreate,
  walletLoadEnabled,
  providerReady = true,
  initialGameAccount,
  guides,
}: GamePageShellProps) {
  return (
    <VipGamePageShellWithWallet>
      <GameLandingClient
        game={game}
        autoCreate={autoCreate}
        walletLoadEnabled={walletLoadEnabled}
        providerReady={providerReady}
        initialGameAccount={initialGameAccount}
        guides={guides}
      />
    </VipGamePageShellWithWallet>
  );
}
