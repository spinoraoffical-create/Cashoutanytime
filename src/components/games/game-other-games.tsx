"use client";

import Image from "next/image";
import Link from "next/link";
import type { Game } from "@/lib/games";

interface GameOtherGamesProps {
  games: Game[];
}

export function GameOtherGames({ games }: GameOtherGamesProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-white">Other Games</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {games.map((game, index) => (
          <Link
            key={game.id}
            href={`/games/${game.slug}`}
            className="group flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-[#1a1a1a] p-2.5 hover:border-orange-500/40 transition-colors"
          >
            <div className="relative w-full aspect-square rounded-lg overflow-hidden">
              <Image
                src={game.image}
                alt={game.name}
                fill
                priority={index < 6}
                loading={index < 6 ? "eager" : "lazy"}
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="120px"
              />
            </div>
            <span className="text-[10px] sm:text-xs font-semibold text-white text-center leading-tight line-clamp-2">
              {game.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
