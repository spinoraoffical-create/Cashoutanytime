"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { toast } from "sonner";
import { Award, CheckCircle2, Gift, Sparkles, Trophy, ArrowRight } from "lucide-react";

interface Quest {
  id: string;
  title: string;
  rewardPoints: number;
  completed: boolean;
  href: string;
  actionText: string;
}

const INITIAL_QUESTS: Quest[] = [
  {
    id: "daily_login",
    title: "Daily Login Bonus",
    rewardPoints: 50,
    completed: true,
    href: "/dashboard",
    actionText: "Claimed",
  },
  {
    id: "spin_wheel",
    title: "Spin the Daily Bonus Wheel",
    rewardPoints: 100,
    completed: false,
    href: "/spin",
    actionText: "Spin Wheel",
  },
  {
    id: "refer_friend",
    title: "Invite a Friend to Spinora",
    rewardPoints: 250,
    completed: false,
    href: "/dashboard",
    actionText: "Get Referral Link",
  },
  {
    id: "first_deposit",
    title: "Request a $10+ Game Load",
    rewardPoints: 500,
    completed: false,
    href: "/dashboard",
    actionText: "Load Game",
  },
];

export function DailyQuestsCard() {
  const [quests, setQuests] = useState<Quest[]>(INITIAL_QUESTS);
  const [userPoints, setUserPoints] = useState(350);

  function handleClaimQuest(qId: string, points: number) {
    setQuests((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, completed: true, actionText: "Claimed" } : q))
    );
    setUserPoints((prev) => prev + points);
    toast.success(`🎉 Quest Completed! Earned +${points} VIP Award Points!`);
  }

  return (
    <GlassCard className="p-6 border-amber-500/30 bg-background/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 mb-6 gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            Daily Quests & Award Points Program
          </h2>
          <p className="text-xs text-muted-foreground">
            Complete daily tasks to earn VIP Award Points redeemable for free game load credits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-amber-500/20 text-amber-400 font-mono text-sm px-3 py-1">
            ⭐ {userPoints} Award Points
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {quests.map((q) => (
          <div
            key={q.id}
            className={`rounded-xl border p-3.5 transition-all flex items-center justify-between gap-3 ${
              q.completed
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-border/60 bg-background/60 hover:border-amber-500/40"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">{q.title}</span>
                {q.completed && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
              </div>
              <span className="text-[11px] font-mono text-amber-400 mt-0.5 block">
                +{q.rewardPoints} VIP Points
              </span>
            </div>

            {q.completed ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 text-[10px]">
                Done
              </Badge>
            ) : (
              <Link href={q.href}>
                <Button
                  size="sm"
                  onClick={() => q.id === "daily_login" && handleClaimQuest(q.id, q.rewardPoints)}
                  className="bg-amber-500 text-black hover:bg-amber-400 font-bold text-xs h-8 px-3 gap-1"
                >
                  {q.actionText} <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            )}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
