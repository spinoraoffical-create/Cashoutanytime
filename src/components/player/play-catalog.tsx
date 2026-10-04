"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Game } from "@/lib/games";

const FAV_KEY = "hub-favorite-games";

type Segment = "all" | "rooms";
type Chip = "all" | "popular" | "favorites";

export function PlayCatalog({ games }: { games: Game[] }) {
  const rooms = games.filter((g) => !g.upcoming);
  const [segment, setSegment] = useState<Segment>("all");
  const [chip, setChip] = useState<Chip>("all");
  const [q, setQ] = useState("");
  const [favs, setFavs] = useState<string[]>([]);

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

  const list = useMemo(() => {
    let rows = rooms;
    if (chip === "popular") rows = rows.filter((g) => g.popular);
    if (chip === "favorites") rows = rows.filter((g) => favs.includes(g.slug));
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
  }, [rooms, chip, q, favs]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-extrabold">
          Play
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-sm font-bold text-muted-foreground">
            {rooms.length}
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Game Rooms use load + redeem. Instant play is not offered on this catalog.
        </p>
      </div>

      <div className="flex rounded-full bg-white/8 p-1">
        {(
          [
            ["all", "All Games"],
            ["rooms", "Game Rooms"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSegment(id)}
            className={cn(
              "flex-1 rounded-full py-2 text-sm font-semibold",
              segment === id ? "bg-amber-400 text-zinc-950" : "text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="hub-card flex items-center gap-2 rounded-2xl px-3 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search games, providers, categories"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {(
          [
            ["all", "All"],
            ["popular", "Popular"],
            ["favorites", "Favorites"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setChip(id)}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold",
              chip === id ? "bg-primary text-white" : "bg-white/8 text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No games match that search.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {list.map((g) => (
            <div key={g.slug} className="hub-card relative overflow-hidden rounded-2xl">
              <button
                type="button"
                onClick={() => toggleFav(g.slug)}
                className="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1.5 text-white"
                aria-label="Favorite"
              >
                <Star className={cn("h-3.5 w-3.5", favs.includes(g.slug) && "fill-amber-400 text-amber-400")} />
              </button>
              <Link href={`/games/${g.slug}`} className="block">
                <div className="relative h-28 w-full bg-white/5">
                  <Image src={g.image} alt="" fill className="object-cover" />
                  {g.popular ? (
                    <span className="absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                      Featured
                    </span>
                  ) : null}
                  {g.trending ? (
                    <span className="absolute bottom-2 left-2 rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-950">
                      Hot
                    </span>
                  ) : null}
                </div>
                <div className="flex items-end justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{g.name}</p>
                    <p className="text-[11px] text-muted-foreground">{g.category}</p>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
