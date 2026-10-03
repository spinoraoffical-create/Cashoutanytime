"use client";

import { useState } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Flame, Gift, Lock, CheckCircle2, Sparkles } from "lucide-react";

interface StreakDay {
  day: number;
  reward: string;
  claimed: boolean;
  isCurrent: boolean;
  isLootBox?: boolean;
}

const STREAK_DAYS: StreakDay[] = [
  { day: 1, reward: "$3 Freeplay", claimed: true, isCurrent: false },
  { day: 2, reward: "$5 Freeplay", claimed: true, isCurrent: false },
  { day: 3, reward: "$10 Freeplay", claimed: false, isCurrent: true },
  { day: 4, reward: "$15 Bonus", claimed: false, isCurrent: false },
  { day: 5, reward: "$25 Reload", claimed: false, isCurrent: false },
  { day: 6, reward: "$35 Credit", claimed: false, isCurrent: false },
  { day: 7, reward: "👑 VIP Loot Box ($50-$500)", claimed: false, isCurrent: false, isLootBox: true },
];

export function StreakCalendarCard() {
  const [days, setDays] = useState<StreakDay[]>(STREAK_DAYS);
  const [streakCount, setStreakCount] = useState(2);

  function handleClaimToday() {
    setDays((prev) =>
      prev.map((d) => (d.isCurrent ? { ...d, claimed: true, isCurrent: false } : d))
    );
    setStreakCount((c) => c + 1);
    toast.success("🔥 Day 3 Streak Claimed! $10 Freeplay added to your wallet.");
  }

  return (
    <GlassCard className="p-6 border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-background to-black">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 mb-6 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
            <Flame className="h-6 w-6 text-amber-500 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">7-Day Consecutive Daily Reward Streak</h3>
              <Badge className="bg-amber-500 text-black font-extrabold text-[10px]">
                {streakCount}-DAY STREAK ACTIVE
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Log in daily to claim escalating freeplay rewards. Reach Day 7 to unlock the VIP Mystery Loot Box!
            </p>
          </div>
        </div>

        <Button
          onClick={handleClaimToday}
          className="bg-amber-500 text-black hover:bg-amber-400 font-extrabold text-xs py-6 px-6 rounded-2xl shadow-xl shadow-amber-500/25 gap-2 shrink-0"
        >
          <Sparkles className="h-4 w-4" />
          Claim Today's Day 3 Reward ($10)
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {days.map((item) => (
          <div
            key={item.day}
            className={`flex flex-col items-center justify-between p-4 rounded-2xl border text-center transition-all ${
              item.claimed
                ? "border-emerald-500/40 bg-emerald-500/10 opacity-70"
                : item.isCurrent
                ? "border-amber-500 bg-amber-500/20 shadow-lg shadow-amber-500/20 ring-2 ring-amber-500/50"
                : item.isLootBox
                ? "border-purple-500/60 bg-purple-500/20"
                : "border-border/60 bg-background/50"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Day {item.day}
            </span>

            <div className="my-2">
              {item.claimed ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto" />
              ) : item.isLootBox ? (
                <Gift className="h-7 w-7 text-purple-400 animate-pulse mx-auto" />
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground mx-auto" />
              )}
            </div>

            <span className="text-xs font-bold text-foreground block">{item.reward}</span>

            {item.claimed && (
              <Badge className="bg-emerald-500/20 text-emerald-300 text-[9px] mt-2">Claimed</Badge>
            )}
            {item.isCurrent && (
              <Badge className="bg-amber-500 text-black text-[9px] font-extrabold mt-2">Ready</Badge>
            )}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
