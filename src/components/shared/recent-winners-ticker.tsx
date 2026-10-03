"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trophy } from "lucide-react";

type WinAlert = {
  id: string;
  user: string;
  amount: number;
  game: string;
};

const SEED_WINS: WinAlert[] = [
  { id: "1", user: "David M.", amount: 450, game: "Juwa" },
  { id: "2", user: "Sarah K.", amount: 128, game: "Fire Kirin" },
  { id: "3", user: "Alex777", amount: 890, game: "Game Vault" },
];

const USERS = ["Tyler R.", "Chime VIP", "LuckySpin", "JuwaMaster", "OrionPro", "VaultKing"];
const GAMES = ["Juwa", "Fire Kirin", "Orion Stars", "Game Vault", "Milky Way", "Panda Master"];

function randomWin(): WinAlert {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user: USERS[Math.floor(Math.random() * USERS.length)],
    amount: Math.floor(25 + Math.random() * 750),
    game: GAMES[Math.floor(Math.random() * GAMES.length)],
  };
}

/** Subtle floating toast for live win social proof. */
export function RecentWinnersTicker() {
  const [visible, setVisible] = useState<WinAlert | null>(null);
  const [queue, setQueue] = useState<WinAlert[]>(SEED_WINS);

  useEffect(() => {
    const showNext = () => {
      setQueue((prev) => {
        const next = prev[0] ?? randomWin();
        setVisible(next);
        const rest = prev.length > 1 ? prev.slice(1) : prev;
        return [...rest, randomWin()];
      });
    };

    showNext();
    const interval = setInterval(showNext, 5500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const hide = setTimeout(() => setVisible(null), 4800);
    return () => clearTimeout(hide);
  }, [visible]);

  return (
    <div
      className="pointer-events-none fixed bottom-20 right-4 z-[60] flex max-w-[min(100vw-2rem,320px)] flex-col gap-2 sm:bottom-6"
      aria-live="polite"
      aria-label="Recent winners"
    >
      <AnimatePresence mode="wait">
        {visible && (
          <motion.div
            key={visible.id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="hub-glass pointer-events-auto flex items-center gap-3 rounded-2xl border border-emerald-500/25 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.45),0_0_20px_rgba(16,185,129,0.12)]"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <Trophy className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">
                {visible.user} won on {visible.game}
              </p>
              <p className="text-sm font-black tabular-nums text-emerald-400">
                +${visible.amount.toLocaleString()}
              </p>
            </div>
            <span className="relative ml-auto flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
