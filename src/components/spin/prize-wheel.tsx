"use client";

import { useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WHEEL_PRIZES, getSpinRotation } from "@/lib/spin/prizes";
import { spinWheel } from "@/lib/actions/spin";
import { cn } from "@/lib/utils";

interface PrizeWheelProps {
  isLoggedIn: boolean;
  remainingSpins: number;
  nextFreeSpinMs: number | null;
  onSpinComplete: (remaining: number, nextFreeSpinMs?: number | null) => void;
}

interface WheelRadii {
  emoji: number;
  label: number;
  rim: number;
}

function formatCountdown(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

const RIM_DOTS = 24;
const DEFAULT_RADII: WheelRadii = { emoji: 158, label: 118, rim: 188 };

function measureRadii(width: number): WheelRadii {
  const padding = width >= 520 ? 36 : 20;
  const innerRadius = width / 2 - padding / 2;
  return {
    emoji: Math.round(innerRadius * 0.88),
    label: Math.round(innerRadius * 0.66),
    rim: Math.round(width / 2 - 4),
  };
}

export function PrizeWheel({
  isLoggedIn,
  remainingSpins,
  nextFreeSpinMs,
  onSpinComplete,
}: PrizeWheelProps) {
  const router = useRouter();
  const outerRef = useRef<HTMLDivElement>(null);
  const prevCountdownRef = useRef(nextFreeSpinMs);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [countdown, setCountdown] = useState(nextFreeSpinMs);
  const [radii, setRadii] = useState<WheelRadii>(DEFAULT_RADII);

  useEffect(() => {
    setCountdown(nextFreeSpinMs);
  }, [nextFreeSpinMs]);

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const update = () => {
      const width = el.getBoundingClientRect().width;
      if (width > 0) setRadii(measureRadii(width));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    if (!countdown || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => (c && c > 1000 ? c - 1000 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    const prev = prevCountdownRef.current;
    prevCountdownRef.current = countdown;
    if (prev && prev > 0 && countdown === 0 && remainingSpins <= 0) {
      router.refresh();
    }
  }, [countdown, remainingSpins, router]);

  const segmentAngle = 360 / WHEEL_PRIZES.length;
  const gradientStops = WHEEL_PRIZES.map((p, i) => {
    const start = i * segmentAngle;
    const end = (i + 1) * segmentAngle;
    return `${p.color} ${start}deg ${end}deg`;
  }).join(", ");

  const handleSpin = useCallback(async () => {
    if (!isLoggedIn) {
      toast.error("Please log in to spin the wheel");
      return;
    }
    if (remainingSpins <= 0) {
      toast.error(
        countdown && countdown > 0
          ? `No spins left. Next free spin in ${formatCountdown(countdown)}.`
          : "No spins left. Your next free spin unlocks 24 hours after your last spin."
      );
      return;
    }
    if (spinning) return;

    setSpinning(true);

    const result = await spinWheel();

    if (result.error) {
      toast.error(result.error);
      setSpinning(false);
      return;
    }

    if (result.prize) {
      const newRotation = getSpinRotation(result.prize.index, rotation);
      setRotation(newRotation);

      setTimeout(() => {
        setSpinning(false);
        if (result.prize!.type === "luck") {
          toast.info(`${result.prize!.emoji} ${result.prize!.label} — Next spin in 24 hours.`);
        } else {
          toast.success(`${result.prize!.emoji} You won ${result.prize!.label}! Added to Total Deposit.`);
        }
        onSpinComplete(result.remainingSpins ?? 0, result.nextFreeSpinMs);
        if (result.remainingSpins === 0 && result.nextFreeSpinMs) {
          setCountdown(result.nextFreeSpinMs);
        }
      }, 5000);
    }
  }, [isLoggedIn, remainingSpins, spinning, rotation, countdown, onSpinComplete]);

  return (
    <div className="flex flex-col items-center w-full">
      <div className="prize-wheel-stage relative flex items-center justify-center">
        <div className="absolute inset-0 prize-wheel-glow rounded-full blur-3xl scale-90" />

        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 prize-wheel-pointer scale-75 sm:scale-100 origin-top">
          <div className="w-0 h-0 border-l-[18px] border-r-[18px] border-t-[30px] border-l-transparent border-r-transparent border-t-amber-400" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-amber-200" />
        </div>

        <div
          ref={outerRef}
          className="prize-wheel-outer relative w-[min(96vw,400px)] h-[min(96vw,400px)] sm:w-[520px] sm:h-[520px] lg:w-[580px] lg:h-[580px] rounded-full p-[10px] sm:p-[18px]"
        >
          <div className="absolute inset-0 pointer-events-none z-10">
            {Array.from({ length: RIM_DOTS }).map((_, i) => (
              <span
                key={i}
                className="prize-wheel-dot absolute left-1/2 top-1/2 w-2 h-2 -ml-1 -mt-1 rounded-full"
                style={{
                  transform: `rotate(${i * (360 / RIM_DOTS)}deg) translateY(-${radii.rim}px)`,
                }}
              />
            ))}
          </div>

          <svg
            className="absolute inset-[10px] sm:inset-[18px] z-20 pointer-events-none rounded-full"
            viewBox="0 0 100 100"
          >
            {WHEEL_PRIZES.map((_, i) => {
              const boundaryAngle = (i * segmentAngle - segmentAngle / 2) * (Math.PI / 180);
              const x2 = 50 + 50 * Math.sin(boundaryAngle);
              const y2 = 50 - 50 * Math.cos(boundaryAngle);
              return (
                <line
                  key={i}
                  x1="50"
                  y1="50"
                  x2={x2}
                  y2={y2}
                  stroke="rgba(251, 191, 36, 0.4)"
                  strokeWidth="0.18"
                />
              );
            })}
          </svg>

          <motion.div
            className="relative w-full h-full rounded-full overflow-hidden prize-wheel-inner shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]"
            style={{
              background: `conic-gradient(from -${segmentAngle / 2}deg, ${gradientStops})`,
            }}
            animate={{ rotate: rotation }}
            transition={{ duration: 5, ease: [0.17, 0.67, 0.12, 0.99] }}
          >
            {WHEEL_PRIZES.map((prize, i) => {
              const angle = i * segmentAngle;
              return (
                <div
                  key={prize.id}
                  className="absolute left-1/2 top-1/2 w-0 h-0 z-[1]"
                  style={{ transform: `rotate(${angle}deg)` }}
                >
                  <div
                    className="absolute left-0 top-0"
                    style={{
                      transform: `translate(-50%, -${radii.emoji}px) rotate(-${angle}deg)`,
                    }}
                  >
                    <div
                      className={cn(
                        "prize-wheel-emoji-wrap",
                        prize.value >= 10 && "prize-wheel-emoji-wrap--jackpot",
                        prize.type === "luck" && "prize-wheel-emoji-wrap--luck",
                        prize.type === "cash" && prize.value < 10 && "prize-wheel-emoji-wrap--cash"
                      )}
                    >
                      <span
                        className="prize-wheel-emoji"
                        role="img"
                        aria-hidden
                        style={{ animationDelay: `${i * 0.12}s` }}
                      >
                        {prize.emoji}
                      </span>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "absolute left-0 top-0 text-center",
                      prize.type === "luck" ? "w-[52px] sm:w-[88px]" : "w-[44px] sm:w-[72px]"
                    )}
                    style={{
                      transform: `translate(-50%, -${radii.label}px) rotate(-${angle}deg)`,
                    }}
                  >
                    <span
                      className={cn(
                        "font-extrabold text-amber-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-wide leading-tight block",
                        prize.type === "luck"
                          ? "text-[5px] sm:text-[8px] uppercase"
                          : "text-[8px] sm:text-xs"
                      )}
                    >
                      {prize.type === "luck" ? (
                        <>
                          <span className="block leading-[1.1]">Better Luck</span>
                          <span className="block leading-[1.1]">Next Time</span>
                        </>
                      ) : (
                        prize.label
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </motion.div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <div className="prize-wheel-hub w-[76px] h-[58px] sm:w-[140px] sm:h-[100px] lg:w-[156px] lg:h-[110px] rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-center px-1.5 sm:px-3">
              {remainingSpins > 0 ? (
                <>
                  <span className="text-[7px] sm:text-xs text-amber-200/60 uppercase tracking-wider">
                    Spins left
                  </span>
                  <span className="text-lg sm:text-3xl font-black text-amber-400 prize-wheel-hub-glow">
                    {remainingSpins}
                  </span>
                </>
              ) : countdown && countdown > 0 ? (
                <>
                  <span className="text-[7px] sm:text-[10px] text-amber-200/60 leading-tight px-0.5">
                    Next spin in
                  </span>
                  <span className="text-[8px] sm:text-sm font-bold text-amber-400 leading-tight mt-0.5 sm:mt-1 prize-wheel-hub-glow">
                    {formatCountdown(countdown)}
                  </span>
                </>
              ) : (
                <span className="text-xs sm:text-sm text-amber-400 font-semibold">No spins</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {isLoggedIn ? (
        <button
          type="button"
          onClick={handleSpin}
          disabled={spinning || remainingSpins <= 0}
          className={cn(
            "mt-10 prize-wheel-spin-btn",
            (spinning || remainingSpins <= 0) && "opacity-50 cursor-not-allowed"
          )}
        >
          {spinning ? "SPINNING..." : "SPIN NOW"}
        </button>
      ) : (
        <Link href="/login?redirect=/spin" className="mt-10 prize-wheel-spin-btn">
          LOGIN TO SPIN
        </Link>
      )}
    </div>
  );
}
