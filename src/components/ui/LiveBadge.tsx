"use client";

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-red-400 border border-red-500/35 bg-red-500/[0.12]">
      <span className="live-dot w-1.5 h-1.5 rounded-full bg-red-500" />
      Live
    </span>
  );
}
