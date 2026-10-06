"use client";

import { useEffect, useState } from "react";
import { useBalanceMask } from "@/lib/wallet/balance-mask";

const SIZES = ["sm", "md", "lg", "xl"] as const;

export function ProfilePreferences() {
  const [size, setSize] = useState<(typeof SIZES)[number]>("md");
  const { masked, toggle } = useBalanceMask();

  useEffect(() => {
    const saved = localStorage.getItem("hub-text-size");
    if (saved === "sm" || saved === "md" || saved === "lg" || saved === "xl") setSize(saved);
  }, []);

  function pick(next: (typeof SIZES)[number]) {
    setSize(next);
    localStorage.setItem("hub-text-size", next);
    document.documentElement.dataset.text = next;
  }

  return (
    <section className="hub-card space-y-4 rounded-[24px] p-4">
      <div>
        <p className="font-bold">Preferences</p>
        <p className="text-xs text-zinc-400">Text size and balance privacy</p>
      </div>
      <div className="flex gap-2">
        {SIZES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => pick(option)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase ${
              size === option ? "bg-white text-zinc-950" : "bg-white/8 text-zinc-300"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <button type="button" onClick={toggle} className="text-sm font-semibold text-primary">
        {masked ? "Show balances" : "Hide balances"}
      </button>
    </section>
  );
}
