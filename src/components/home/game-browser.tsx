"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { GAMES, filterGames, type GameTab } from "@/lib/games";
import { CompactGameCard } from "@/components/home/compact-game-card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TABS: { id: GameTab; label: string }[] = [
  { id: "all", label: "All Games" },
  { id: "popular", label: "Popular Games" },
  { id: "trending", label: "Trending Games" },
  { id: "promotional", label: "Promotional" },
  { id: "upcoming", label: "Upcoming Games" },
];

export function GameBrowser() {
  const [tab, setTab] = useState<GameTab>("all");
  const [search, setSearch] = useState("");
  const games = filterGames(tab, search);

  return (
    <section className="py-16 bg-card/20" id="games">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-2">
              Explore <span className="gradient-text">Games</span>
            </h2>
            <p className="text-muted-foreground">Browse and request accounts for top gaming platforms</p>
          </div>
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search games..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                tab === t.id
                  ? "gradient-bg text-white shadow-lg shadow-purple-500/25"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${tab}-${search}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
          >
            {games.length > 0 ? (
              games.map((game, i) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <CompactGameCard game={game} variant="grid" />
                </motion.div>
              ))
            ) : (
              <div className="col-span-full text-center py-16 text-muted-foreground">
                No games found. Try a different search or tab.
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Showing {games.length} of {GAMES.length} games
        </p>
      </div>
    </section>
  );
}
