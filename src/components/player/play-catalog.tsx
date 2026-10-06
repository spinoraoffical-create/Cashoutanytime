"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Gamepad2, LayoutGrid, Search, SlidersHorizontal, Sparkles, Star } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Game } from "@/lib/games";
import { usePlayerMotion } from "@/lib/player-motion";
import { MotionPage } from "@/components/player/motion-page";

const FAV_KEY = "hub-favorite-games";

type Segment = "all" | "rooms" | "instant";
type Chip = "all" | "popular" | "favorites" | "yours";

export function PlayCatalog({ games }: { games: Game[] }) {
  const rooms = games.filter((g) => !g.upcoming);
  const [segment, setSegment] = useState<Segment>("all");
  const [chip, setChip] = useState<Chip>("all");
  const [q, setQ] = useState("");
  const [favs, setFavs] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [category, setCategory] = useState("all");
  const { stagger, tap } = usePlayerMotion();

  useEffect(() => {
    try {
      setFavs(JSON.parse(localStorage.getItem(FAV_KEY) || "[]") as string[]);
    } catch {
      setFavs([]);
    }
  }, []);

  function toggleFav(slug: string) {
    setFavs((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
  }

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(rooms.map((g) => g.category)))],
    [rooms]
  );

  const list = useMemo(() => {
    let rows = rooms;
    if (segment === "instant") return [];
    if (chip === "popular") rows = rows.filter((g) => g.popular);
    if (chip === "favorites" || chip === "yours") rows = rows.filter((g) => favs.includes(g.slug));
    if (category !== "all") rows = rows.filter((g) => g.category === category);
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter(
        (g) =>
          g.name.toLowerCase().includes(s) ||
          g.provider.toLowerCase().includes(s) ||
          g.category.toLowerCase().includes(s)
      );
    }
    return rows;
  }, [rooms, segment, chip, category, q, favs]);

  return (
    <MotionPage className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-extrabold">
          Play
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-sm font-bold text-zinc-400">
            {rooms.length}
          </span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Open a Game Room. Instant play uses a separate balance and is not on this floor.
        </p>
      </div>

      <div className="flex rounded-full bg-[#1a1730] p-1">
        {(
          [
            ["all", "All Games", LayoutGrid],
            ["rooms", "Game Rooms", Gamepad2],
            ["instant", "Instant Games", Sparkles],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSegment(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold sm:text-sm",
              segment === id ? "bg-[#2a2548] text-white" : "text-zinc-400"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <label className="hub-card flex items-center gap-2 rounded-2xl px-3 py-2.5">
        <Search className="h-4 w-4 text-zinc-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search games, providers, categories"
          className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
        />
      </label>

      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-2 overflow-x-auto scrollbar-hide">
          {(
            [
              ["all", "All"],
              ["popular", "Popular"],
              ["favorites", "Favorites"],
              ["yours", "Yours"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setChip(id)}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold",
                chip === id ? "bg-white text-zinc-950" : "bg-white/8 text-zinc-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="flex shrink-0 items-center gap-1 rounded-full bg-white/8 px-3 py-1.5 text-sm font-semibold text-zinc-200"
          aria-expanded={showFilters}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filter
        </button>
      </div>

      {showFilters ? (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setCategory(name)}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold capitalize",
                category === name ? "bg-primary text-white" : "bg-white/8 text-zinc-400"
              )}
            >
              {name === "all" ? "All categories" : name}
            </button>
          ))}
        </div>
      ) : null}

      {segment !== "instant" ? (
        <h2 className="text-lg font-extrabold">
          {segment === "rooms" ? "Game Rooms" : "All games"}{" "}
          <span className="text-sm font-semibold text-zinc-500">{list.length}</span>
        </h2>
      ) : null}

      {segment === "instant" ? (
        <div className="hub-card rounded-[24px] px-5 py-10 text-center">
          <p className="font-bold">Instant Games are not on this floor</p>
          <p className="mt-1 text-sm text-zinc-400">Game Rooms use load and redeem from your wallet.</p>
        </div>
      ) : list.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-400">
          {chip === "yours" || chip === "favorites"
            ? "Star a room and it will show up here."
            : "No games match that search."}
        </p>
      ) : (
        <motion.div
          className="grid grid-cols-2 gap-3"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: stagger } },
          }}
        >
          {list.map((g) => (
            <motion.div
              key={g.slug}
              variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
              whileTap={tap}
              className="hub-card relative overflow-hidden rounded-2xl hover:shadow-[0_0_22px_rgba(255,45,85,0.28)]"
            >
              <button
                type="button"
                onClick={() => toggleFav(g.slug)}
                className="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1.5 text-white"
                aria-label="Favorite"
              >
                <Star className={cn("h-3.5 w-3.5", favs.includes(g.slug) && "fill-[#f5c542] text-[#f5c542]")} />
              </button>
              <Link href={`/games/${g.slug}`} className="block">
                <div className="relative h-28 w-full bg-white/5">
                  <Image src={g.image} alt="" fill className="object-cover" />
                  {g.popular ? (
                    <span className="absolute left-2 top-2 rounded bg-[#f5c542] px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-950">
                      Featured
                    </span>
                  ) : null}
                  {g.trending ? (
                    <span className="absolute bottom-2 left-2 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                      Hot
                    </span>
                  ) : null}
                </div>
                <div className="flex items-end justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{g.name}</p>
                    <p className="text-[11px] text-zinc-400">{g.category}</p>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-[0_0_12px_rgba(255,45,85,0.45)]">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </MotionPage>
  );
}
