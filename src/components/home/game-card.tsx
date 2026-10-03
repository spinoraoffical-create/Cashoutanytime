"use client";

import type { Game } from "@/lib/games";
import { CompactGameCard } from "@/components/home/compact-game-card";
import { cn } from "@/lib/utils";

interface GameCardProps {
  game: Game;
  className?: string;
  eager?: boolean;
  variant?: "grid" | "lobby";
}

export function GameCard({ game, className, eager, variant = "grid" }: GameCardProps) {
  return (
    <div className={cn("w-full", className)}>
      <CompactGameCard game={game} variant={variant} eager={eager} />
    </div>
  );
}
