"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/constants";

interface AnimatedLogoProps {
  showImage?: boolean;
  imageSize?: number;
  textClassName?: string;
  className?: string;
  href?: string;
}

export function AnimatedLogo({
  showImage = true,
  className,
  href = "/",
}: AnimatedLogoProps) {
  const [replayKey, setReplayKey] = useState(0);

  const replay = useCallback(() => {
    setReplayKey((k) => k + 1);
  }, []);

  return (
    <Link
      href={href}
      className={cn(
        "animated-logo group inline-flex items-center gap-2.5 min-w-0 select-none",
        className
      )}
      onMouseEnter={replay}
      onClick={replay}
    >
      {showImage && (
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 p-0.5 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform duration-300">
          <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-neutral-950">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5 text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L15 8L21 9L16.5 13.5L18 19.5L12 16L6 19.5L7.5 13.5L3 9L9 8L12 2Z"
                fill="url(#gold-gradient-logo)"
                stroke="#fbbf24"
                strokeWidth="0.8"
              />
              <circle cx="12" cy="11" r="2" fill="#121212" />
              <defs>
                <linearGradient id="gold-gradient-logo" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#fef08a" />
                  <stop offset="0.5" stopColor="#f59e0b" />
                  <stop offset="1" stopColor="#b45309" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      )}

      <div className="flex flex-col leading-none">
        <span className="text-lg font-black tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent drop-shadow-sm uppercase">
          {SITE_NAME}
        </span>
        <span className="text-[9px] font-bold tracking-[0.2em] text-emerald-400 uppercase mt-0.5">
          ROYALE VIP
        </span>
      </div>
    </Link>
  );
}

export function AnimatedLogoText({
  textClassName,
  className,
}: {
  textClassName?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-col leading-none select-none", className)}>
      <span className={cn("text-lg font-black tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent uppercase", textClassName)}>
        {SITE_NAME}
      </span>
      <span className="text-[9px] font-bold tracking-[0.2em] text-emerald-400 uppercase mt-0.5">
        ROYALE VIP
      </span>
    </span>
  );
}
