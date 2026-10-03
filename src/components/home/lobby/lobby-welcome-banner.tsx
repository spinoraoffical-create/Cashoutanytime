"use client";

import Link from "next/link";
import Image from "next/image";

const DOTS = [0, 1, 2, 3];

export function LobbyWelcomeBanner() {
  return (
    <section className="lobby-welcome-banner relative w-full overflow-hidden rounded-[10px] h-[118px] sm:h-[128px]">
      <div className="absolute inset-0 bg-gradient-to-r from-[#0e0028] via-[#220055] to-[#0a001e]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(147,51,234,0.5),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_90%_40%,rgba(251,191,36,0.12),transparent_50%)]" />

      {/* Treasure chest */}
      <div className="absolute left-0 bottom-0 w-[22%] max-w-[110px] h-full pointer-events-none">
        <Image
          src="/images/promos/spinora_gift_three.jpg"
          alt=""
          width={110}
          height={110}
          className="absolute bottom-0 left-0 w-full h-[95%] object-contain object-bottom drop-shadow-[0_0_18px_rgba(251,191,36,0.45)]"
          aria-hidden
        />
      </div>

      {/* Dragon */}
      <div className="absolute right-0 bottom-0 w-[24%] max-w-[120px] h-full pointer-events-none">
        <Image
          src="/images/promos/spinora_dealer_ten.jpg"
          alt=""
          width={120}
          height={120}
          className="absolute bottom-0 right-0 w-full h-[100%] object-contain object-bottom drop-shadow-[0_0_20px_rgba(251,191,36,0.35)]"
          aria-hidden
        />
      </div>

      {/* Copy */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-[18%] text-center">
        <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.22em] text-purple-300/75 mb-0.5">
          Welcome Bonus
        </p>
        <h2 className="text-[11px] sm:text-[13px] lg:text-[15px] font-black leading-snug mb-1.5 max-w-md">
          <span className="text-white">WELCOME BONUS </span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-300">
            150% UP TO $500 + 50 FREE SPINS
          </span>
        </h2>
        <Link
          href="/dashboard/deposit"
          className="lobby-claim-btn px-6 py-1.5 rounded-md bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 text-amber-950 font-black text-[10px] sm:text-[11px] uppercase tracking-[0.14em] border border-amber-200/70 hover:brightness-110"
        >
          Claim Now
        </Link>
      </div>

      {/* Carousel dots */}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {DOTS.map((i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-purple-400" : "bg-purple-700/80"}`}
          />
        ))}
      </div>

      <div className="absolute inset-0 rounded-[10px] border border-amber-500/35 pointer-events-none shadow-[inset_0_0_30px_rgba(147,51,234,0.15)]" />
    </section>
  );
}
