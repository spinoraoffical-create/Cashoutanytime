import * as React from "react";

import { cn } from "@/lib/utils";

type GlassCardProps = React.ComponentProps<"div"> & {
  /** gradient hairline edge for featured surfaces */
  featured?: boolean;
  /** glow accent on hover */
  glow?: "gold" | "green" | "cyan" | "purple" | "none";
  /** stronger blur/background for elevated layers */
  elevated?: boolean;
};

const glowClass: Record<NonNullable<GlassCardProps["glow"]>, string> = {
  gold: "transition-shadow duration-300 hover:shadow-[0_0_24px_var(--ws-gold-glow)]",
  green: "transition-shadow duration-300 hover:shadow-[0_0_22px_var(--ws-green-glow)]",
  cyan: "transition-shadow duration-300 hover:shadow-[0_0_20px_var(--ws-cyan-glow)]",
  purple: "transition-shadow duration-300 hover:shadow-[0_0_24px_var(--ws-purple-glow)]",
  none: "",
};

export function GlassCard({
  featured = false,
  glow = "none",
  elevated = false,
  className,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        elevated ? "glass-strong" : "glass",
        featured && "glass-edge",
        "rounded-2xl",
        glowClass[glow],
        className
      )}
      {...props}
    />
  );
}
