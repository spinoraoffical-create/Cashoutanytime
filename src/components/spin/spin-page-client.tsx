"use client";

import { useState, useEffect } from "react";
import { History, Gift, Clock, Coins, Sparkles } from "lucide-react";
import { PrizeWheel } from "@/components/spin/prize-wheel";
import { SpinHistory } from "@/components/spin/spin-history";
import { StreakCalendarCard } from "@/components/spin/streak-calendar-card";
import { SITE_NAME } from "@/lib/constants";
import { WalletCardLoader } from "@/components/wallet/wallet-card-loader";
import Link from "next/link";

interface SpinPageClientProps {
  isLoggedIn: boolean;
  dailyLimit: number;
  remainingSpins: number;
  nextFreeSpinMs: number | null;
  history: Array<{
    id: string;
    prize_label: string;
    prize_type: string;
    prize_value: number;
    created_at: string;
  }>;
}

function formatCountdown(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

export function SpinPageClient({
  isLoggedIn,
  dailyLimit,
  remainingSpins: initialRemaining,
  nextFreeSpinMs,
  history,
}: SpinPageClientProps) {
  const [remaining, setRemaining] = useState(initialRemaining);
  const [cooldownMs, setCooldownMs] = useState(nextFreeSpinMs);
  const [showHistory, setShowHistory] = useState(false);
  const [walletRefresh, setWalletRefresh] = useState(0);

  useEffect(() => {
    setCooldownMs(nextFreeSpinMs);
  }, [nextFreeSpinMs]);

  useEffect(() => {
    if (!cooldownMs || cooldownMs <= 0) return;
    const timer = setInterval(() => {
      setCooldownMs((c) => (c && c > 1000 ? c - 1000 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownMs]);

  function handleSpinComplete(left: number, nextMs?: number | null) {
    setRemaining(left);
    setCooldownMs(nextMs ?? null);
    setWalletRefresh((k) => k + 1);
  }

  return (
    <div className="relative min-h-screen pt-16 pb-12 overflow-hidden bg-[#0a0a14]">
      {/* Smoky purple background */}
      <div className="absolute inset-0 spin-page-bg" />
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-purple-700/15 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-indigo-900/20 rounded-full blur-[140px]" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-amber-600/5 rounded-full blur-[100px]" />

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-8">
        {/* 7-Day Consecutive Streak + VIP Loot Box Card */}
        <StreakCalendarCard />

        <div className="grid lg:grid-cols-[minmax(220px,280px)_1fr_minmax(220px,280px)] gap-8 lg:gap-10 items-start">
          {/* Left panel */}
          <div className="space-y-6 order-2 lg:order-1">
            {isLoggedIn && <WalletCardLoader refreshKey={walletRefresh} />}

            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
                Ready to Test!{" "}
                <span className="text-amber-400 italic block sm:inline">Your Luck?</span>
              </h1>
              <p className="mt-4 text-sm sm:text-base text-amber-100/70 leading-relaxed">
                Spin the {SITE_NAME} Wheel and unlock amazing rewards! Every spin holds the chance
                to win cash bonuses, VIP points, and exclusive prizes.
              </p>
            </div>

            <div className="rounded-2xl p-5 bg-[#12121f]/80 border border-amber-500/20 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="h-5 w-5 text-amber-400" />
                <h3 className="font-semibold text-amber-400">Spin More, Win More!</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Upgrade your VIP tier for extra daily spins and bigger winning chances.
              </p>
              <Link href="/vip" className="inline-flex items-center gap-1 mt-3 text-sm text-orange-400 hover:text-orange-300 font-medium">
                View VIP Plans →
              </Link>
            </div>

            <div className="rounded-2xl p-5 bg-gradient-to-br from-purple-900/40 to-[#12121f]/80 border border-purple-500/25 backdrop-blur-sm hidden lg:block">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-purple-300" />
                <h3 className="font-semibold text-purple-200">Daily Free Spin</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Free spins unlock again 24 hours after your last spin. Come back daily to keep your streak going!
              </p>
            </div>
          </div>

          {/* Center — big wheel */}
          <div className="flex justify-center order-1 lg:order-2 lg:col-span-1">
            <PrizeWheel
              isLoggedIn={isLoggedIn}
              remainingSpins={remaining}
              nextFreeSpinMs={cooldownMs}
              onSpinComplete={handleSpinComplete}
            />
          </div>

          {/* Right panel */}
          <div className="space-y-4 order-3">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-amber-500/50 text-amber-400 text-sm font-bold hover:bg-amber-500/10 transition-colors ml-auto w-full sm:w-auto justify-center lg:justify-start lg:ml-auto lg:mr-0"
            >
              <History className="h-4 w-4" />
              Spin History
            </button>

            <div className="rounded-2xl p-5 bg-[#12121f]/90 border border-purple-500/25 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4">
                <Gift className="h-5 w-5 text-purple-400" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-white">
                  Available Spins
                </h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-muted-foreground">Daily Spins:</span>
                  <span className="text-purple-400 font-bold text-lg">{dailyLimit}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Remaining Spins:</span>
                  <span className="text-amber-400 font-bold text-lg">{remaining}</span>
                </div>
                {remaining <= 0 && cooldownMs && cooldownMs > 0 && (
                  <div className="flex justify-between items-center py-2 border-t border-white/5">
                    <span className="text-muted-foreground">Next spin in:</span>
                    <span className="text-purple-300 font-bold">{formatCountdown(cooldownMs)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl p-5 bg-[#12121f]/90 border border-amber-500/20 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-amber-400" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-amber-400">
                  To Get a Spin
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Each spin unlocks 24 hours after your previous one. Higher VIP tiers get more spins
                per 24-hour window!
              </p>
              {!isLoggedIn && (
                <Link
                  href="/register"
                  className="mt-4 block text-center py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-gray-900 text-sm font-bold hover:opacity-90"
                >
                  Sign Up Free
                </Link>
              )}
            </div>
          </div>
        </div>

        {showHistory && (
          <div className="mt-10 pt-8 border-t border-white/10">
            <SpinHistory history={history} />
          </div>
        )}
      </div>
    </div>
  );
}
