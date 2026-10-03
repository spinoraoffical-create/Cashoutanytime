"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Gift,
  Crown,
  Target,
  Trophy,
  Headphones,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLobbyProfile } from "@/components/home/lobby/use-lobby-profile";
import {
  IconLobby,
  IconSlots777,
  IconFish,
  IconTableCards,
  IconLiveCasino,
  IconFortuneWheel,
} from "@/components/home/lobby/lobby-icons";

export type LobbyMenuId =
  | "lobby"
  | "slots"
  | "fish"
  | "table"
  | "live"
  | "promotions"
  | "vip"
  | "missions"
  | "leaderboard"
  | "support";

const FILTER_ITEMS: {
  id: LobbyMenuId;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: "lobby", label: "LOBBY", icon: <IconLobby className="w-4 h-4" /> },
  { id: "slots", label: "SLOTS", icon: <IconSlots777 /> },
  { id: "fish", label: "FISH GAMES", icon: <IconFish className="w-4 h-4" /> },
  { id: "table", label: "TABLE GAMES", icon: <IconTableCards className="w-4 h-4" /> },
  { id: "live", label: "LIVE CASINO", icon: <IconLiveCasino /> },
];

const LINK_ITEMS: {
  id: LobbyMenuId;
  label: string;
  icon: React.ElementType;
  href: string;
}[] = [
  { id: "promotions", label: "PROMOTIONS", icon: Gift, href: "/promotions" },
  { id: "vip", label: "VIP CLUB", icon: Crown, href: "/dashboard/vip" },
  { id: "missions", label: "MISSIONS", icon: Target, href: "/dashboard" },
  { id: "leaderboard", label: "LEADERBOARD", icon: Trophy, href: "/leaderboard" },
  { id: "support", label: "SUPPORT", icon: Headphones, href: "/dashboard/messages" },
];

interface LobbySidebarProps {
  activeMenu: LobbyMenuId;
  onMenuChange: (id: LobbyMenuId) => void;
  className?: string;
}

export function LobbySidebar({ activeMenu, onMenuChange, className }: LobbySidebarProps) {
  const { profile, levelProgress } = useLobbyProfile();
  const level = profile?.level ?? 28;
  const displayName = "Spinora VIP";

  return (
    <aside className={cn("lobby-sidebar flex flex-col h-full py-3 px-2.5", className)}>
      {/* Profile */}
      <div className="lobby-profile-block px-2 pb-3 mb-1 border-b border-purple-500/25">
        <div className="flex items-center gap-2.5">
          <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-amber-400/70 shrink-0 shadow-[0_0_14px_rgba(251,191,36,0.35)]">
            {profile?.avatarUrl ? (
              <Image src={profile.avatarUrl} alt={displayName} fill className="object-cover" sizes="44px" />
            ) : (
              <Image
                src="/images/promos/spinora_model_five.jpg"
                alt={displayName}
                fill
                className="object-cover object-top"
                sizes="44px"
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-black text-white leading-tight">{displayName}</p>
            <p className="text-[11px] font-bold text-amber-400/90">Lv. {level}</p>
          </div>
        </div>
        <div className="mt-2.5 h-[6px] rounded-full bg-purple-950/90 overflow-hidden border border-purple-600/30">
          <div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-violet-400"
            style={{ width: `${Math.max(levelProgress, 35)}%` }}
          />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1 py-1">
        {FILTER_ITEMS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onMenuChange(id)}
            className={cn(
              "lobby-nav-btn flex items-center gap-2.5 w-full px-3 py-[9px] rounded-lg text-left transition-all",
              activeMenu === id
                ? "lobby-nav-btn-active text-white font-bold"
                : "text-purple-200/75 hover:text-white hover:bg-purple-800/25"
            )}
          >
            <span className="w-5 flex items-center justify-center shrink-0 opacity-90">{icon}</span>
            <span className="text-[10.5px] font-bold tracking-[0.06em]">{label}</span>
          </button>
        ))}

        <div className="my-2 mx-1 h-px bg-purple-500/15" />

        {LINK_ITEMS.map(({ id, label, icon: Icon, href }) => (
          <Link
            key={id}
            href={href}
            className="lobby-nav-btn flex items-center gap-2.5 w-full px-3 py-[9px] rounded-lg text-purple-200/75 hover:text-white hover:bg-purple-800/25 transition-all"
          >
            <Icon className="w-4 h-4 shrink-0 opacity-80" />
            <span className="text-[10.5px] font-bold tracking-[0.06em]">{label}</span>
          </Link>
        ))}
      </nav>

      {/* Spin & Win wheel */}
      <Link
        href="/spin"
        className="lobby-spin-block mt-auto flex flex-col items-center pt-3 pb-1 group"
      >
        <div className="relative group-hover:scale-105 transition-transform duration-300">
          <div className="absolute inset-0 bg-amber-400/25 blur-xl rounded-full scale-110" />
          <IconFortuneWheel className="relative w-[72px] h-[72px] drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]" />
        </div>
        <span className="mt-2 text-[11px] font-black text-amber-400 tracking-[0.12em]">SPIN &amp; WIN</span>
        <span className="text-[8px] font-bold text-amber-300/60 tracking-wide mt-0.5">WIN BIG EVERYDAY!</span>
      </Link>
    </aside>
  );
}
