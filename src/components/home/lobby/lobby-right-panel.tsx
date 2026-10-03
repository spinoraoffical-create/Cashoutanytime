"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock, ChevronRight, Star } from "lucide-react";
import { GAMES } from "@/lib/games";
import { IconCrownSmall } from "@/components/home/lobby/lobby-icons";

const JACKPOT_WINNERS = [
  { player: "Player_5689", amount: 12456.0, gameSlug: "fire-kirin" },
  { player: "LuckyStar99", amount: 8320.0, gameSlug: "juwa" },
  { player: "MegaSpin777", amount: 15890.0, gameSlug: "orion-stars" },
];

function getGameImage(slug: string) {
  return GAMES.find((g) => g.slug === slug)?.image ?? "/logo.webp";
}

function useCountdown(initialSeconds: number) {
  const [seconds, setSeconds] = useState(initialSeconds);
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => (s <= 0 ? initialSeconds : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [initialSeconds]);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Compact side panel — sits beside banner in reference layout */
export function LobbyRightPanel() {
  const countdown = useCountdown(12 * 3600 + 45 * 60 + 30);

  return (
    <aside className="lobby-right-panel flex flex-col gap-1.5 w-full h-full">
      <div className="lobby-panel-card rounded-[8px] overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-1.5 py-1 border-b border-purple-500/25 shrink-0">
          <div className="flex items-center gap-1">
            <IconCrownSmall className="w-2.5 h-2.5 text-amber-400" />
            <h3 className="text-[8px] font-black uppercase tracking-wider text-white/90">Jackpot Winners</h3>
          </div>
          <Link href="/leaderboard" className="text-purple-400/60">
            <ChevronRight className="h-2.5 w-2.5" />
          </Link>
        </div>
        <ul className="flex-1 min-h-0 overflow-hidden">
          {JACKPOT_WINNERS.map((win) => (
            <li key={win.player} className="flex items-center gap-1 px-1.5 py-[3px] border-b border-purple-500/8 last:border-0">
              <div className="relative w-6 h-6 rounded-[4px] overflow-hidden border border-purple-400/25 shrink-0">
                <Image src={getGameImage(win.gameSlug)} alt="" fill className="object-cover" sizes="24px" />
              </div>
              <p className="text-[8px] font-bold text-white/85 truncate flex-1">{win.player}</p>
              <p className="text-[8px] font-black text-amber-400 tabular-nums shrink-0">
                ${win.amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="lobby-panel-card rounded-[8px] px-2 py-1.5 text-center shrink-0">
        <div className="flex items-center justify-center gap-0.5 mb-0.5">
          <Star className="w-2 h-2 text-amber-400 fill-amber-400" />
          <span className="text-[7px] font-black uppercase tracking-wider text-purple-300/65">Tournament</span>
          <Star className="w-2 h-2 text-amber-400 fill-amber-400" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <svg className="w-7 h-7 shrink-0 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]" viewBox="0 0 48 48" aria-hidden>
            <path d="M14 42h20v4H14v-4zm2-28l4 8 6-10 6 10 4-8 8 28H8l8-28z" fill="#fbbf24" />
          </svg>
          <div className="text-left min-w-0">
            <p className="text-[7px] font-bold uppercase text-purple-300/60 leading-none">Daily Tourney</p>
            <p className="text-sm font-black text-amber-400 leading-tight">$5,000</p>
            <p className="text-[6px] font-bold text-purple-400/50 uppercase">Prize Pool</p>
          </div>
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-950/90 border border-purple-500/30 shrink-0">
            <Clock className="w-2.5 h-2.5 text-purple-400" />
            <span className="text-[10px] font-black text-white tabular-nums">{countdown}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
