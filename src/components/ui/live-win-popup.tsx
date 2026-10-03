"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Flame, Trophy, Zap, ShieldCheck, ArrowRight } from "lucide-react";

interface LiveWinEvent {
  id: number;
  player: string;
  location: string;
  action: string;
  amount: string;
  game: string;
  href: string;
  type: "win" | "cashout" | "jackpot" | "wheel";
  timeAgo: string;
}

const LIVE_EVENTS: LiveWinEvent[] = [
  {
    id: 1,
    player: "Alex M.",
    location: "Miami, FL",
    action: "won Big Win payout on",
    amount: "$340.00",
    game: "Juwa 777",
    href: "/games/juwa",
    type: "win",
    timeAgo: "12 seconds ago",
  },
  {
    id: 2,
    player: "David K.",
    location: "Houston, TX",
    action: "received instant payout in 6 mins via",
    amount: "$180.00",
    game: "Cash App",
    href: "/dashboard",
    type: "cashout",
    timeAgo: "Just now",
  },
  {
    id: 3,
    player: "Sarah B.",
    location: "Dallas, TX",
    action: "hit the MEGA JACKPOT on",
    amount: "$520.00",
    game: "Orion Stars",
    href: "/games/orion-stars",
    type: "jackpot",
    timeAgo: "45 seconds ago",
  },
  {
    id: 4,
    player: "Marcus T.",
    location: "Atlanta, GA",
    action: "unlocked 100% Deposit Match on",
    amount: "$100.00",
    game: "Daily Bonus Wheel",
    href: "/spin",
    type: "wheel",
    timeAgo: "1 min ago",
  },
  {
    id: 5,
    player: "Jason R.",
    location: "Columbus, OH",
    action: "cashed out successfully via",
    amount: "$410.00",
    game: "USDT Crypto",
    href: "/dashboard",
    type: "cashout",
    timeAgo: "2 mins ago",
  },
  {
    id: 6,
    player: "Carlos G.",
    location: "Los Angeles, CA",
    action: "won Boss Fish multiplier on",
    amount: "$290.00",
    game: "Game Vault 999",
    href: "/games/game-vault",
    type: "win",
    timeAgo: "Just now",
  },
];

export function LiveWinPopup() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;

    // Initial delay before showing first popup
    const startTimer = setTimeout(() => {
      setVisible(true);
    }, 4000);

    // Rotation interval every 10 seconds
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % LIVE_EVENTS.length);
        setVisible(true);
      }, 600);
    }, 10000);

    return () => {
      clearTimeout(startTimer);
      clearInterval(interval);
    };
  }, [dismissed]);

  if (dismissed) return null;

  const event = LIVE_EVENTS[currentIndex];

  const getBadgeIcon = () => {
    switch (event.type) {
      case "jackpot":
        return <Trophy className="h-4 w-4 text-amber-400 animate-bounce" />;
      case "cashout":
        return <Zap className="h-4 w-4 text-sky-400" />;
      case "wheel":
        return <ShieldCheck className="h-4 w-4 text-purple-400" />;
      default:
        return <Flame className="h-4 w-4 text-emerald-400" />;
    }
  };

  return (
    <div
      className={`fixed bottom-4 left-4 z-50 max-w-sm w-[calc(100vw-2rem)] sm:w-80 transition-all duration-500 transform ${
        visible
          ? "translate-y-0 opacity-100 scale-100"
          : "translate-y-8 opacity-0 scale-95 pointer-events-none"
      }`}
    >
      <div className="relative overflow-hidden rounded-2xl border border-ws-green/30 bg-[#18181b]/95 p-3.5 shadow-2xl backdrop-blur-xl shadow-ws-green/10">
        {/* Glow Background Gradient Accent */}
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-ws-green/15 blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
          title="Close notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Header Ticker Line */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            Real-Time Activity
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto pr-5">
            {event.timeAgo}
          </span>
        </div>

        {/* Content Body */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ws-green/15 border border-ws-green/30">
            {getBadgeIcon()}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs text-foreground/90 leading-tight">
              <strong className="font-bold text-white">{event.player}</strong>{" "}
              <span className="text-[11px] text-muted-foreground">({event.location})</span>{" "}
              {event.action} <span className="font-semibold text-emerald-300">{event.game}</span>
            </p>

            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-sm font-extrabold text-ws-green tracking-tight">
                +{event.amount}
              </span>

              <Link
                href={event.href}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300 hover:underline"
              >
                Claim <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
