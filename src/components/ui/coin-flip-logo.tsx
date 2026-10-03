"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/constants";

interface CoinFlipLogoProps {
  size?: number;
  className?: string;
  href?: string;
}

export function CoinFlipLogo({ size = 180, className, href = "/spin" }: CoinFlipLogoProps) {
  const inner = (
    <div
      className={cn("coin-flip-scene group cursor-pointer", className)}
      style={className ? undefined : { width: size, height: size }}
    >
      <div className="coin-flip-inner">
        <div className="coin-flip-face coin-flip-front">
          <div className="coin-flip-rim">
            <Image
              src="/logo.webp"
              alt={SITE_NAME}
              width={size}
              height={size}
              className="rounded-full object-cover w-full h-full shadow-[0_0_40px_rgba(251,191,36,0.45)]"
              priority
            />
          </div>
        </div>
        <div className="coin-flip-face coin-flip-back">
          <div className="coin-flip-rim coin-flip-back-face">
            <span className="coin-flip-back-text">{SITE_NAME}</span>
            <span className="coin-flip-back-sub">SPIN &amp; WIN</span>
          </div>
        </div>
      </div>
      <div className="coin-flip-glow" aria-hidden />
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block" aria-label={`${SITE_NAME} — spin now`}>
        {inner}
      </Link>
    );
  }

  return inner;
}
