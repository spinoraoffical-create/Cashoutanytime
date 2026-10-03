import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";

/**
 * Dashboard stat widget — glass card with HUD label, big tabular value and an
 * optional emerald/red delta (icon + text, never color alone).
 */
export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  icon,
  accent = "gold",
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: number;
  deltaLabel?: string;
  icon?: React.ReactNode;
  accent?: "gold" | "emerald" | "purple" | "cyan";
  className?: string;
}) {
  const accentText = {
    gold: "text-ws-gold-deep dark:text-ws-gold",
    emerald: "text-ws-green-deep dark:text-ws-emerald",
    purple: "text-violet-700 dark:text-ws-purple",
    cyan: "text-cyan-700 dark:text-ws-cyan",
  }[accent];

  return (
    <GlassCard className={cn("p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="hud-label text-muted-foreground">{label}</p>
        {icon && <span className={cn("[&_svg]:size-5", accentText)}>{icon}</span>}
      </div>
      <p className={cn("tnum mt-3 text-3xl font-bold", accentText)}>{value}</p>
      {delta !== undefined && (
        <p
          className={cn(
            "mt-2 inline-flex items-center gap-1 text-xs font-medium",
            delta >= 0 ? "text-ws-emerald" : "text-ws-danger"
          )}
        >
          {delta >= 0 ? (
            <ArrowUpRight className="size-3.5" aria-hidden />
          ) : (
            <ArrowDownRight className="size-3.5" aria-hidden />
          )}
          <span className="tnum">
            {delta >= 0 ? "+" : ""}
            {delta.toLocaleString()}
            {deltaLabel ? ` ${deltaLabel}` : ""}
          </span>
        </p>
      )}
    </GlassCard>
  );
}
