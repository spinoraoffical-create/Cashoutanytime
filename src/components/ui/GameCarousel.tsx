"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const GAMES = [
  { name: "Fire Kirin", img: "/games/fire-kirin.webp", badge: "HOT" as const },
  { name: "Orion Stars", img: "/games/orion-stars.webp", badge: "HOT" as const },
  { name: "Juwa", img: "/games/juwa.webp", badge: "POPULAR" as const },
  { name: "Panda Master", img: "/games/panda-master.webp", badge: "HOT" as const },
  { name: "MR All In One", img: "/games/mr-all-in-one.webp", badge: "NEW" as const },
  { name: "Vegas Sweeps", img: "/games/vegas-sweeps.webp", badge: "POPULAR" as const },
];

const BADGE_STYLES = {
  HOT: "bg-gradient-to-r from-red-600 to-orange-500 text-white badge-hot",
  POPULAR: "bg-gradient-to-r from-blue-600 to-cyan-500 text-white",
  NEW: "bg-gradient-to-r from-green-600 to-emerald-400 text-white",
};

function GameCard({ name, img, badge }: (typeof GAMES)[0]) {
  return (
    <div className="game-carousel-card group relative w-[150px] h-[190px] flex-shrink-0 rounded-xl overflow-hidden cursor-pointer">
      <Image src={img} alt={name} fill className="object-cover" sizes="150px" />
      <span
        className={cn(
          "absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
          BADGE_STYLES[badge]
        )}
      >
        {badge}
      </span>
      <div className="game-card-shimmer" />
      <div className="absolute inset-x-0 bottom-0 z-10 p-2 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <p className="text-xs font-semibold text-white text-center">{name}</p>
      </div>
    </div>
  );
}

function CarouselRow({ reverse = false }: { reverse?: boolean }) {
  const items = [...GAMES, ...GAMES];
  return (
    <div
      className={cn(
        "carousel-row flex gap-[14px] w-max",
        reverse ? "carousel-row-reverse" : "carousel-row-normal"
      )}
    >
      {items.map((game, i) => (
        <GameCard key={`${game.name}-${i}`} {...game} />
      ))}
    </div>
  );
}

export function GameCarousel() {
  return (
    <section className="py-12 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-center">
          Most Played <span className="gradient-text">Right Now</span>
        </h2>
      </div>
      <div className="space-y-[14px] carousel-container">
        <CarouselRow />
        <CarouselRow reverse />
      </div>
    </section>
  );
}
