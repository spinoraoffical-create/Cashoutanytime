import * as React from "react";
import { Crown, Gem, Medal, Shield, Sparkles } from "lucide-react";

import type { VipTierKey } from "@/lib/database.types";
import { cn } from "@/lib/utils";

/** Tier visual identities — MASTER.md §6 tier colors. */
const tierStyles: Record<
  VipTierKey,
  { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  silver: {
    label: "Silver",
    className: "border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-300",
    Icon: Shield,
  },
  gold: {
    label: "Gold",
    className: "border-ws-gold/30 bg-ws-gold/10 text-ws-gold-deep dark:text-ws-gold",
    Icon: Medal,
  },
  platinum: {
    label: "Platinum",
    className: "border-cyan-400/30 bg-cyan-400/10 text-cyan-700 dark:text-cyan-300",
    Icon: Sparkles,
  },
  diamond: {
    label: "Diamond",
    className:
      "border-ws-cyan/30 bg-gradient-to-r from-ws-cyan/15 to-ws-green/15 text-cyan-700 dark:text-ws-cyan",
    Icon: Gem,
  },
  elite: {
    label: "Elite",
    className:
      "border-ws-gold/40 bg-gradient-to-r from-ws-gold/15 to-ws-green/15 text-ws-gold-deep dark:text-ws-gold",
    Icon: Crown,
  },
};

export function TierBadge({
  tier,
  size = "md",
  className,
}: {
  tier: VipTierKey;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const t = tierStyles[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide uppercase",
        size === "sm" && "px-2 py-0.5 text-[10px]",
        size === "md" && "px-2.5 py-1 text-xs",
        size === "lg" && "px-3.5 py-1.5 text-sm",
        t.className,
        className
      )}
    >
      <t.Icon
        className={cn(
          size === "sm" && "size-3",
          size === "md" && "size-3.5",
          size === "lg" && "size-4"
        )}
      />
      {t.label}
    </span>
  );
}
