"use client";

import { useState, useEffect, useCallback } from "react";
import { GAMES } from "@/lib/games";
import { useIsMobile } from "@/lib/hooks/use-mobile";

interface Activity {
  emoji: string;
  user: string;
  action: string;
}

const FIRST_NAMES = [
  "Alex", "Diana", "Chris", "Emma", "Ryan", "Marco", "Lisa", "James", "Priya", "Noah",
  "Sofia", "Ethan", "Mia", "Lucas", "Ava", "Omar", "Nina", "Tyler", "Zara", "Kevin",
  "Hannah", "Diego", "Chloe", "Brandon", "Yuki", "Marcus", "Leila", "Jordan", "Anika", "Victor",
  "Rosa", "Derek", "Mei", "Andre", "Kira", "Samuel", "Fatima", "Logan", "Elena", "Raj",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAmount(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildActivity(name: string): Activity {
  const game = pick(GAMES).name;
  const templates: { emoji: string; action: string }[] = [
    { emoji: "🎮", action: `requested ${game} account` },
    { emoji: "🎰", action: `won $${randomAmount(40, 320)} on ${game}` },
    { emoji: "🏆", action: `reached ${pick(["Silver", "Gold", "Platinum"])} VIP` },
    { emoji: "💰", action: `earned +${randomAmount(50, 300)} referral pts` },
    { emoji: "💎", action: `claimed $${randomAmount(10, 100)} bonus` },
    { emoji: "🔥", action: `hit a ${randomAmount(2, 8)}x win on ${game}` },
    { emoji: "⭐", action: `spun the wheel on ${game}` },
    { emoji: "🎁", action: `unlocked promo on ${game}` },
    { emoji: "🪙", action: `deposited $${randomAmount(20, 200)}` },
    { emoji: "🎯", action: `joined via referral — +${randomAmount(50, 150)} pts` },
  ];
  const t = pick(templates);
  const lastInitial = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return {
    emoji: t.emoji,
    user: `${name} ${lastInitial}.`,
    action: t.action,
  };
}

function generateActivityPool(size: number): Activity[] {
  const names = shuffle(FIRST_NAMES).slice(0, Math.min(size, FIRST_NAMES.length));
  const pool = names.map((name) => buildActivity(name));

  while (pool.length < size) {
    pool.push(buildActivity(pick(FIRST_NAMES)));
  }

  return shuffle(pool);
}

const POOL_SIZE = 36;

export function ActivityToast() {
  const isMobile = useIsMobile();
  const [activities, setActivities] = useState<Activity[]>(() => generateActivityPool(POOL_SIZE));
  const [index, setIndex] = useState(() => Math.floor(Math.random() * POOL_SIZE));
  const [animating, setAnimating] = useState<"in" | "out">("in");

  const advance = useCallback(() => {
    setIndex((i) => {
      const next = i + 1;
      if (next >= activities.length) {
        setActivities(generateActivityPool(POOL_SIZE));
        return 0;
      }
      return next;
    });
  }, [activities.length]);

  useEffect(() => {
    const cycle = setInterval(() => {
      setAnimating("out");
      setTimeout(() => {
        advance();
        setAnimating("in");
      }, 400);
    }, 6000);

    return () => clearInterval(cycle);
  }, [advance]);

  const activity = activities[index] ?? activities[0];

  if (isMobile) return null;

  return (
    <div
      className={`activity-toast fixed top-[6.25rem] right-4 sm:right-6 z-[35] flex items-center gap-3 px-4 py-2.5 rounded-xl border border-purple-500/30 shadow-xl max-w-[min(100vw-2rem,20rem)] ${
        animating === "in" ? "toast-animate-in" : "toast-animate-out"
      }`}
      style={{ background: "rgba(13,3,24,0.92)" }}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-600/30 flex items-center justify-center text-lg">
        {activity.emoji}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-white truncate">{activity.user}</p>
        <p className="text-xs text-gray-400 truncate">{activity.action}</p>
      </div>
    </div>
  );
}
