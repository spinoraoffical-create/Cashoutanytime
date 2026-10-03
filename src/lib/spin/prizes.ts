import { FREEPLAY_RULES } from "@/lib/constants";

export interface WheelPrize {
  id: string;
  label: string;
  type: "cash" | "luck" | "points";
  value: number;
  emoji: string;
  color: string;
  weight: number;
}

/** Prioritize VIP points and small bonus amounts; jackpots remain rare. */
export const WHEEL_PRIZES: WheelPrize[] = [
  { id: "pts50", label: "50 VIP PTS", type: "points", value: 50, emoji: "👑", color: "#0f172a", weight: 22 },
  { id: "luck1", label: "BETTER LUCK NEXT TIME", type: "luck", value: 0, emoji: "🎲", color: "#0c1830", weight: 18 },
  { id: "pts25", label: "25 VIP PTS", type: "points", value: 25, emoji: "⭐", color: "#0a1428", weight: 20 },
  { id: "1", label: "$1", type: "cash", value: 1, emoji: "🎰", color: "#0a1428", weight: 14 },
  { id: "pts100", label: "100 VIP PTS", type: "points", value: 100, emoji: "💫", color: "#1a0a2e", weight: 8 },
  { id: "luck2", label: "BETTER LUCK NEXT TIME", type: "luck", value: 0, emoji: "🍀", color: "#0c1830", weight: 12 },
  { id: "2", label: "$2", type: "cash", value: 2, emoji: "💵", color: "#0a1428", weight: 10 },
  { id: "3", label: "$3", type: "cash", value: 3, emoji: "🥇", color: "#0c1830", weight: 8 },
  { id: "5", label: "$5", type: "cash", value: 5, emoji: "🔥", color: "#0a1428", weight: 5 },
  { id: "7", label: "$7", type: "cash", value: 7, emoji: "💎", color: "#1a0a2e", weight: 2 },
  { id: "10", label: "$10", type: "cash", value: FREEPLAY_RULES.maxBonusCash, emoji: "🎉", color: "#1a0a2e", weight: 1 },
];

export const DAILY_SPINS_BY_TIER: Record<string, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 3,
};

/** Rolling window — next spin unlocks 24 hours after the previous spin(s). */
export const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function pickWeightedPrize(): { prize: WheelPrize; index: number } {
  const total = WHEEL_PRIZES.reduce((s, p) => s + p.weight, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < WHEEL_PRIZES.length; i++) {
    rand -= WHEEL_PRIZES[i].weight;
    if (rand <= 0) return { prize: WHEEL_PRIZES[i], index: i };
  }
  return { prize: WHEEL_PRIZES[0], index: 0 };
}

export function getSpinRotation(prizeIndex: number, currentRotation: number): number {
  const segmentAngle = 360 / WHEEL_PRIZES.length;
  const fullSpins = 5;
  const segmentCenter = prizeIndex * segmentAngle;
  const target = 360 * fullSpins + (360 - segmentCenter);
  return currentRotation + target + Math.random() * 8 - 4;
}
