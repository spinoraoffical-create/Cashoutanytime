"use client";

import { VipGamePageShellWithWallet } from "@/components/layout/vip-game-page-shell";
import { GameLandingClient } from "@/components/games/game-landing-client";
import type { Game } from "@/lib/games";

interface GamePageShellProps {
  game: Game;
  autoCreate?: boolean;
  walletLoadEnabled?: boolean;
  initialGameAccount?: {
    game_username: string;
    game_password: string | null;
  } | null;
}

export function GamePageShell({
  game,
  autoCreate,
  walletLoadEnabled,
  initialGameAccount,
}: GamePageShellProps) {
  return (
    <VipGamePageShellWithWallet>
      <GameLandingClient
        game={game}
        autoCreate={autoCreate}
        walletLoadEnabled={walletLoadEnabled}
        initialGameAccount={initialGameAccount}
      />
    </VipGamePageShellWithWallet>
  );
}
