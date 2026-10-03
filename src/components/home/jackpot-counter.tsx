"use client";

import { useState, useEffect } from "react";
import { Coins, Flame } from "lucide-react";
import { TiltCard } from "@/components/shared/tilt-card";

export function JackpotCounter() {
  const [jackpot, setJackpot] = useState(1482920.45);

  useEffect(() => {
    const interval = setInterval(() => {
      setJackpot((prev) => prev + (0.15 + Math.random() * 0.45));
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return (
    <TiltCard>
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-purple-950/40 to-black p-6 shadow-2xl backdrop-blur-2xl transition-all hover:border-amber-400 hover:shadow-amber-500/20">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30 shadow-lg">
              <Coins className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-amber-400">
                  GRAND PROGRESSIVE JACKPOT
                </span>
                <span className="flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                  <Flame className="h-3 w-3" /> HOT
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Live cumulative prize pool across all 8 game platforms</p>
            </div>
          </div>

          <div className="font-mono text-3xl sm:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-100 to-amber-400 drop-shadow-[0_0_25px_rgba(245,158,11,0.5)]">
            ${jackpot.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </TiltCard>
  );
}
