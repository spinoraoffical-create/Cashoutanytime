"use client";

import { useMemo, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { DollarPayDepositSection } from "@/components/payments/dollarpay-deposit-modal";

export function DepositPageClient({
  embedded = false,
  games = [],
}: {
  embedded?: boolean;
  games?: { slug: string; name: string }[];
}) {
  const defaultSlug = games[0]?.slug ?? "";
  const [gameSlug, setGameSlug] = useState(defaultSlug);
  const [changing, setChanging] = useState(false);

  const game = useMemo(
    () => games.find((g) => g.slug === gameSlug) ?? games[0],
    [gameSlug, games]
  );

  if (!game) {
    return <p className="py-12 text-center text-sm text-[#b9b3c6]">No games available for deposits yet.</p>;
  }

  return (
    <div id="add-money" className="space-y-4">
      {embedded ? null : (
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#b9b3c6]">Money</p>
          <h1 className="mt-1 text-4xl font-black leading-10">Add money</h1>
        </div>
      )}

      <DollarPayDepositSection
        gameSlug={game.slug}
        gameName={game.name}
        gamePicker={
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#ff6b89]/50 px-3 py-3">
              <div className="flex items-start gap-2">
                <Gamepad2 className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6b89]" />
                <div>
                  <p className="text-sm font-bold">For {game.name}</p>
                  <p className="text-xs text-[#b9b3c6]">Your game stays selected. Money is added to Wallet first.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChanging((v) => !v)}
                className="shrink-0 text-sm font-bold text-[#ff6b89]"
              >
                Change
              </button>
            </div>
            {changing ? (
              <select
                aria-label="Deposit for game"
                value={game.slug}
                onChange={(e) => {
                  setGameSlug(e.target.value);
                  setChanging(false);
                }}
                className="w-full rounded-xl border border-white/10 bg-[#160812] px-4 py-3 text-sm text-[#fcf9fb] outline-none"
              >
                {games.map((g) => (
                  <option key={g.slug} value={g.slug}>
                    {g.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        }
      />
    </div>
  );
}
