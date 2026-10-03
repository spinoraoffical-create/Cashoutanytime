import Link from "next/link";
import { Clock, Sparkles } from "lucide-react";
import { SITE_NAME } from "@/lib/constants";

export function SpinComingSoon() {
  return (
    <div className="relative min-h-screen pt-16 pb-12 overflow-hidden bg-[#0a0a14]">
      <div className="absolute inset-0 spin-page-bg" />
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-purple-700/15 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-indigo-900/20 rounded-full blur-[140px]" />

      <div className="relative mx-auto max-w-2xl px-4 sm:px-6 py-16 sm:py-24 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-500/15 border border-purple-500/30 mb-6">
          <Sparkles className="h-10 w-10 text-purple-300" />
        </div>

        <p className="text-sm font-semibold uppercase tracking-wider text-purple-300 mb-3">
          Coming Soon
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">Daily Spin Wheel</h1>
        <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-lg mx-auto mb-8">
          We&apos;re building a new daily spin experience for {SITE_NAME} members — free spins,
          Total Deposit prizes, and VIP rewards. Check back soon.
        </p>

        <div className="rounded-2xl border border-white/10 bg-[#12121f]/80 backdrop-blur-sm p-6 text-left mb-8">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white text-sm">Spin is temporarily unavailable</p>
              <p className="text-sm text-muted-foreground mt-1">
                Make a deposit and load your favorite games while we finish the new spin wheel.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/#games"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-bold text-black hover:opacity-90 transition-opacity"
          >
            Browse Games
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
