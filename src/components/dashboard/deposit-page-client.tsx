"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { GameDepositSection } from "@/components/games/game-deposit-section";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { GAMES } from "@/lib/games";
import { cn } from "@/lib/utils";

const PLAYABLE_GAMES = GAMES.filter((g) => !g.upcoming);

export function DepositPageClient() {
  const defaultSlug = PLAYABLE_GAMES[0]?.slug ?? "game-vault";
  const [gameSlug, setGameSlug] = useState(defaultSlug);

  const game = useMemo(
    () => PLAYABLE_GAMES.find((g) => g.slug === gameSlug) ?? PLAYABLE_GAMES[0],
    [gameSlug]
  );

  if (!game) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No games available for deposits yet.
      </div>
    );
  }

  return (
    <div>
      <DashboardPageHeader
        title="Deposit"
        description="Choose a payment method, send your deposit, then upload a screenshot. We credit your game account after verification."
      />

      <div className="mb-4 rounded-xl border border-white/10 bg-[#161616] p-4">
        <label htmlFor="deposit-game" className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Gamepad2 className="h-3.5 w-3.5" />
          Deposit for game
        </label>
        <select
          id="deposit-game"
          value={game.slug}
          onChange={(e) => setGameSlug(e.target.value)}
          className={cn(
            "w-full rounded-xl border border-white/10 bg-[#242424] px-4 py-3 text-sm text-white",
            "focus:outline-none focus:border-orange-500/40"
          )}
        >
          {PLAYABLE_GAMES.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.name}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground mt-2">
          Or open a{" "}
          <Link href="/#games" className="text-orange-400 hover:underline">
            game page
          </Link>{" "}
          to deposit while you browse.{" "}
          <Link href="/dashboard/deposits" className="text-orange-400 hover:underline">
            View my deposit history
          </Link>
        </p>
      </div>

      <GameDepositSection game={game} hideSectionAnchor />
    </div>
  );
}
