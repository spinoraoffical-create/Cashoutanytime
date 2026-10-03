"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SITE_NAME, DAILY_SPIN_ENABLED } from "@/lib/constants";
import { CoinFlipLogo } from "@/components/ui/coin-flip-logo";

const ROTATING_WORDS = ["Experience", "Rewards", "Thrills", "Action", "Wins"];

const COINS = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  left: 55 + (i * 3.5) % 40,
  delay: (i * 0.25) % 3,
  duration: 2.5 + (i % 3) * 0.5,
  size: 6 + (i % 4) * 2,
}));

export function Hero() {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setWordIndex((i) => (i + 1) % ROTATING_WORDS.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative pb-4">
      <div className="casino-hero-banner relative w-full overflow-hidden rounded-2xl min-h-[260px] sm:min-h-[300px] lg:min-h-[340px]">
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a0a2e] via-[#0d0318] to-[#1a1008]" />
        <div className="absolute inset-0 casino-hero-cave opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/30 via-transparent to-amber-900/20" />

        <div className="relative z-10 grid lg:grid-cols-2 gap-6 items-center h-full px-6 sm:px-10 py-10 sm:py-12 hero-fade-in">
          <div className="text-left">
            <p className="text-white/90 italic text-lg sm:text-xl mb-1 font-light">
              Craving Action?
            </p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white italic leading-tight mb-1">
              {SITE_NAME} games deliver nonstop casino
            </h1>
            <div className="h-10 sm:h-12 overflow-hidden mb-6">
              <span
                key={ROTATING_WORDS[wordIndex]}
                className="block text-2xl sm:text-3xl lg:text-4xl font-bold italic text-amber-400 hero-word-swap"
              >
                {ROTATING_WORDS[wordIndex]}
              </span>
            </div>

            {DAILY_SPIN_ENABLED ? (
              <Link href="/spin" className="spin-now-btn inline-block">
                SPIN NOW
              </Link>
            ) : (
              <Link
                href="/spin"
                className="inline-flex items-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/10 px-6 py-3 text-sm font-bold text-purple-200 hover:bg-purple-500/20 transition-colors"
              >
                Daily Spin — Coming Soon
              </Link>
            )}
          </div>

          <div className="relative flex items-center justify-center min-h-[200px] lg:min-h-[260px] hero-scale-in">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-amber-500/15 blur-3xl slot-glow" />
            </div>
            <CoinFlipLogo
              size={200}
              className="w-[140px] h-[140px] sm:w-[180px] sm:h-[180px] lg:w-[200px] lg:h-[200px]"
              href="/spin"
            />

            <div className="hidden sm:block absolute inset-0 pointer-events-none">
              {COINS.map((coin) => (
                <span
                  key={coin.id}
                  className="falling-coin absolute rounded-full bg-gradient-to-br from-amber-300 to-amber-600 border border-amber-200/50 shadow-[0_0_6px_rgba(251,191,36,0.6)]"
                  style={{
                    left: `${coin.left}%`,
                    width: coin.size,
                    height: coin.size,
                    animationDelay: `${coin.delay}s`,
                    animationDuration: `${coin.duration}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
