import Image from "next/image";
import Link from "next/link";
import { SITE_NAME, DAILY_SPIN_ENABLED } from "@/lib/constants";
import { Sparkles, Gamepad2, ShieldCheck, Zap } from "lucide-react";

/** Clean, Attractive Modern Luxury Hero Banner */
export function HeroStatic() {
  return (
    <section className="relative pb-6" aria-label="Welcome">
      <div className="casino-hero-banner relative w-full overflow-hidden rounded-3xl min-h-[300px] sm:min-h-[340px] lg:min-h-[380px] border border-amber-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        {/* Modern Clean Background with Neon Gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-900 to-black" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid lg:grid-cols-2 gap-8 items-center h-full px-6 sm:px-12 py-10 sm:py-14">
          <div className="text-left space-y-4">
            {/* Feature Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                ⚡ 24/7 Fast Automated Loads
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-400 border border-amber-500/30">
                🏆 VIP Sweepstakes Casino
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Play Top Games on <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500">
                {SITE_NAME}
              </span>
            </h1>

            <p className="text-sm sm:text-base text-zinc-300 max-w-lg leading-relaxed">
              Instant 1-click game account loading for Juwa 777, Fire Kirin, Game Vault, and Orion Stars. Fast 15-minute cashouts with 24/7 automated bot fulfillment.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-3">
              {DAILY_SPIN_ENABLED ? (
                <Link
                  href="/spin"
                  className="bg-gradient-to-r from-amber-500 to-amber-400 text-black hover:from-amber-400 hover:to-amber-300 font-extrabold text-sm px-8 py-3.5 rounded-2xl shadow-xl shadow-amber-500/25 transition-all hover:scale-105 inline-flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4" /> SPIN & CLAIM $10 FREE
                </Link>
              ) : (
                <Link
                  href="/spin"
                  className="inline-flex items-center gap-2 rounded-2xl border border-purple-500/40 bg-purple-500/10 px-6 py-3.5 text-sm font-bold text-purple-200"
                >
                  Daily Spin Active
                </Link>
              )}

              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-zinc-900/90 px-6 py-3.5 text-sm font-bold text-white hover:bg-zinc-800 transition-all border-amber-500/30"
              >
                <Gamepad2 className="h-4 w-4 text-amber-400" /> Player Dashboard
              </Link>
            </div>
          </div>

          <div className="relative flex items-center justify-center min-h-[220px] lg:min-h-[280px]">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 rounded-full bg-amber-500/15 blur-3xl" />
            </div>
            <Link
              href="/spin"
              className="relative block w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] lg:w-[220px] lg:h-[220px] shrink-0 hover:scale-105 transition-transform"
              aria-label={`${SITE_NAME} — Spin now`}
            >
              <Image
                src="/logo.webp"
                alt={SITE_NAME}
                fill
                priority
                fetchPriority="high"
                sizes="(max-width: 640px) 160px, 220px"
                className="rounded-full object-cover shadow-[0_0_40px_rgba(245,158,11,0.4)] border-2 border-amber-400/40"
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
