"use client";

import { ShieldCheck, CheckCircle2 } from "lucide-react";

export function VerifiedBadge({
  label = "Verified Player",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 ${className}`}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      <span>{label}</span>
    </span>
  );
}
