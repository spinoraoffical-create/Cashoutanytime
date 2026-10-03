"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface GlowButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "gold";
  className?: string;
  "aria-label"?: string;
}

export function GlowButton({
  children,
  href,
  onClick,
  variant = "primary",
  className,
  "aria-label": ariaLabel,
}: GlowButtonProps) {
  const inner = (
    <span
      className={cn(
        "glow-btn relative inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-200",
        variant === "primary" &&
          "bg-gradient-to-r from-[#7c3aed] to-[#5b21b6] text-white hover:-translate-y-0.5 active:scale-[0.97]",
        variant === "gold" &&
          "bg-gradient-to-r from-[#fbbf24] to-[#d97706] text-gray-900 shadow-[0_4px_0_#92400e] hover:-translate-y-0.5 active:scale-[0.97] active:shadow-[0_2px_0_#92400e]",
        className
      )}
    >
      {children}
    </span>
  );

  const wrapperClass = cn(
    "glow-btn-wrapper relative inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
  );

  if (href) {
    return (
      <Link href={href} className={wrapperClass} aria-label={ariaLabel}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={wrapperClass}
      aria-label={ariaLabel}
    >
      {inner}
    </button>
  );
}
