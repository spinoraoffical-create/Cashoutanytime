"use client";

import { motion } from "framer-motion";
import { Lock, Unlock, TrendingUp } from "lucide-react";
import Link from "next/link";

import { Progress } from "@/components/ui/progress";
import type { RolloverProgress } from "@/lib/data/rollover";

type Props = {
  rollover: RolloverProgress | null;
};

export function RolloverTracker({ rollover }: Props) {
  if (!rollover) {
    return (
      <div className="hub-card rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <TrendingUp className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Bonus wager tracker</p>
            <p className="text-xs text-muted-foreground">
              Load a bonus to your game account to track rollover progress here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const {
    gameName,
    wageredAmount,
    requiredWager,
    percentComplete,
    maxCashoutRemaining,
    cashoutUnlocked,
    gameSlug,
  } = rollover;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="hub-card hub-card-glow rounded-2xl p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex size-10 items-center justify-center rounded-xl ${
              cashoutUnlocked
                ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                : "bg-amber-500/15 text-amber-400"
            }`}
          >
            {cashoutUnlocked ? <Unlock className="size-5" /> : <Lock className="size-5" />}
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400/90">
              Deposit bonus rollover
            </p>
            <h2 className="text-lg font-bold text-foreground">
              ${wageredAmount.toFixed(0)} / ${requiredWager.toFixed(0)} wagered — {percentComplete}%
              completed
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Active on <span className="font-medium text-foreground">{gameName}</span>
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            cashoutUnlocked
              ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
              : "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/25"
          }`}
        >
          {cashoutUnlocked ? "Cashout unlocked" : "Wager to unlock"}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <Progress
          value={percentComplete}
          className="h-2.5 bg-[#1a2030] [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-emerald-400 [&>div]:shadow-[0_0_12px_rgba(16,185,129,0.5)]"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Max cashout remaining:{" "}
            <span className="font-semibold text-amber-400">${maxCashoutRemaining.toFixed(2)}</span>
          </span>
          <Link
            href={`/games/${gameSlug}`}
            className="font-medium text-emerald-400 underline-offset-4 hover:underline"
          >
            Play & wager →
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
