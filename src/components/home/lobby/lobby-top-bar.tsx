"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, Mail, Volume2, VolumeX } from "lucide-react";
import { useLobbyProfile } from "@/components/home/lobby/use-lobby-profile";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { IconGoldCoin, IconGiftBox } from "@/components/home/lobby/lobby-icons";

interface LobbyTopBarProps {
  onMenuClick?: () => void;
}

export function LobbyTopBar({ onMenuClick }: LobbyTopBarProps) {
  const { balance, fpBalance, walletHidden } = useLobbyProfile();
  const { count: unreadMessages } = useUnreadMessages();
  const [soundOn, setSoundOn] = useState(true);

  const fmt = (n: number) =>
    walletHidden
      ? "••••"
      : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <header className="lobby-top-bar shrink-0 h-[48px] grid grid-cols-[1fr_auto_1fr] items-center px-3 sm:px-4 gap-2">
      {/* Left — balances */}
      <div className="flex items-center gap-2 justify-start">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:bg-white/10"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="lobby-balance-chip flex items-center gap-1.5 pl-0.5 pr-1 py-0.5">
          <IconGoldCoin className="w-6 h-6 shrink-0" />
          <span className="text-[13px] font-black text-amber-300 tabular-nums whitespace-nowrap">${fmt(balance)}</span>
          <Link href="/dashboard/deposit" className="lobby-plus-btn w-6 h-6 flex items-center justify-center rounded text-white font-bold text-base leading-none" aria-label="Add funds">+</Link>
        </div>

        <div className="lobby-balance-chip flex items-center gap-1.5 pl-0.5 pr-1 py-0.5">
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-[8px] font-black text-emerald-950 shrink-0">FP</span>
          <span className="text-[13px] font-black text-emerald-300 tabular-nums whitespace-nowrap">{fmt(fpBalance)}</span>
          <Link href="/dashboard/rewards" className="lobby-plus-btn w-6 h-6 flex items-center justify-center rounded text-white font-bold text-base leading-none" aria-label="Add FP">+</Link>
        </div>
      </div>

      {/* Center — daily bonus */}
      <Link href="/spin" className="lobby-daily-bonus flex flex-col items-center gap-0 group justify-self-center">
        <IconGiftBox className="w-9 h-9 drop-shadow-[0_3px_10px_rgba(239,68,68,0.55)] group-hover:scale-105 transition-transform" />
        <span className="text-[8px] font-bold text-white/90 uppercase tracking-wide leading-none mt-0.5">Daily Bonus</span>
      </Link>

      {/* Right — utilities */}
      <div className="flex items-center gap-2 justify-end">
        <Link href="/dashboard/messages" className="relative lobby-utility-btn w-8 h-8" title="Mail">
          <Mail className="h-4 w-4 text-purple-200" />
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center">
            {unreadMessages > 0 ? (unreadMessages > 9 ? "9+" : unreadMessages) : "1"}
          </span>
        </Link>

        <button type="button" onClick={() => setSoundOn((v) => !v)} className="lobby-utility-btn w-8 h-8 hidden sm:flex" aria-label={soundOn ? "Mute" : "Unmute"}>
          {soundOn ? <Volume2 className="h-4 w-4 text-purple-200" /> : <VolumeX className="h-4 w-4 text-purple-200/40" />}
        </button>

        <button type="button" onClick={onMenuClick} className="relative lobby-utility-btn w-8 h-8 hidden lg:flex" aria-label="Menu">
          <Menu className="h-4 w-4 text-purple-200" />
          <span className="absolute -top-0.5 -right-0.5 w-[14px] h-[14px] rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center">!</span>
        </button>
      </div>
    </header>
  );
}
