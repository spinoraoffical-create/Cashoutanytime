"use client";

import { SITE_NAME } from "@/lib/constants";

export function BrandLogo({ className = "h-9", showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2.5 group cursor-pointer ${className}`}>
      {/* Ultra-Premium Royal Gold Crest Badge Emblem */}
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 p-0.5 shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform duration-300">
        <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-neutral-950">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-6 w-6 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Crown & Diamond Crest Emblem */}
            <path
              d="M12 2L15 8L21 9L16.5 13.5L18 19.5L12 16L6 19.5L7.5 13.5L3 9L9 8L12 2Z"
              fill="url(#gold-gradient)"
              stroke="#fbbf24"
              strokeWidth="0.8"
            />
            <circle cx="12" cy="11" r="2" fill="#121212" />
            <defs>
              <linearGradient id="gold-gradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#fef08a" />
                <stop offset="0.5" stopColor="#f59e0b" />
                <stop offset="1" stopColor="#b45309" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {showText && (
        <div className="flex flex-col">
          <span className="text-lg font-black tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent drop-shadow-sm uppercase">
            {SITE_NAME}
          </span>
          <span className="text-[9px] font-bold tracking-[0.2em] text-emerald-400 uppercase -mt-1">
            ROYALE VIP
          </span>
        </div>
      )}
    </div>
  );
}
