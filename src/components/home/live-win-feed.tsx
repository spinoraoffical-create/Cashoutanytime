"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Zap, Trophy } from "lucide-react";

interface LiveWin {
  id: string;
  user: string;
  amount: number;
  game: string;
  timeAgo: string;
}

const MOCK_WINS: LiveWin[] = [
  { id: "1", user: "@DavidM", amount: 450.0, game: "Juwa 777", timeAgo: "1m ago" },
  { id: "2", user: "@Sarah_K", amount: 120.5, game: "Fire Kirin", timeAgo: "2m ago" },
  { id: "3", user: "@Alex777", amount: 890.0, game: "Game Vault 999", timeAgo: "4m ago" },
  { id: "4", user: "@VIP_Jason", amount: 250.0, game: "Orion Stars", timeAgo: "5m ago" },
  { id: "5", user: "@Elena_W", amount: 640.0, game: "Vegas Sweeps", timeAgo: "7m ago" },
  { id: "6", user: "@Marcus99", amount: 310.0, game: "VBlink", timeAgo: "9m ago" },
];

export function LiveWinFeed() {
  const [wins, setWins] = useState<LiveWin[]>(MOCK_WINS);

  useEffect(() => {
    const interval = setInterval(() => {
      const users = ["@Tyler_R", "@Chime_VIP", "@CryptoKing", "@LuckySpin", "@JuwaMaster"];
      const games = ["Juwa 777", "Fire Kirin", "Game Vault 999", "Orion Stars", "Panda Master"];
      const newWin: LiveWin = {
        id: Date.now().toString(),
        user: users[Math.floor(Math.random() * users.length)],
        amount: Math.floor(50 + Math.random() * 800),
        game: games[Math.floor(Math.random() * games.length)],
        timeAgo: "Just now",
      };
      setWins((prev) => [newWin, ...prev.slice(0, 5)]);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-amber-500/30 bg-black/70 p-3 backdrop-blur-xl shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <Trophy className="h-4 w-4" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-amber-400">
            Live Winner Feed
          </span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {wins.map((win) => (
            <div
              key={win.id}
              className="flex items-center gap-2 rounded-xl border border-border/50 bg-zinc-900/90 px-3 py-1.5 text-xs font-mono shrink-0 transition-all hover:border-amber-500/50"
            >
              <span className="font-bold text-foreground">{win.user}</span>
              <span className="font-black text-emerald-400">+${win.amount.toFixed(2)}</span>
              <span className="text-[10px] text-muted-foreground">({win.game})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
