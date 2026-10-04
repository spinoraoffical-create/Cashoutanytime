"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import type { Game } from "@/lib/games";
import type { PublicPromotion } from "@/lib/data/promotions-public";
import { ClaimVerifyBanner } from "@/components/player/claim-verify-banner";
import { WalletSnapshot } from "@/components/player/wallet-snapshot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function RoomCard({ game }: { game: Game }) {
  return (
    <Link href={`/games/${game.slug}`} className="hub-card w-[148px] shrink-0 overflow-hidden rounded-2xl">
      <div className="relative h-28 w-full bg-white/5">
        <Image src={game.image} alt="" fill className="object-cover" />
        {game.popular ? (
          <span className="absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
            Featured
          </span>
        ) : null}
      </div>
      <div className="flex items-start justify-between gap-1 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{game.name}</p>
          <p className="text-xs text-muted-foreground">Load + redeem</p>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  );
}

export function PlayerHome({
  games,
  linkedSlugs,
  promotions,
  wallet,
  verify,
  dailySpinEnabled,
}: {
  games: Game[];
  linkedSlugs: string[];
  promotions: PublicPromotion[];
  wallet: { balance: number; cashout: number; freeplay: number };
  verify: { show: boolean; href: string; title: string; body?: string } | null;
  dailySpinEnabled: boolean;
}) {
  const rooms = games.filter((g) => !g.upcoming);
  const [q, setQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [ownedOnly, setOwnedOnly] = useState(false);

  const filtered = useMemo(() => {
    let rows = rooms;
    if (ownedOnly && linkedSlugs.length > 0) {
      rows = rows.filter((g) => linkedSlugs.includes(g.slug));
    }
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter(
        (g) =>
          g.name.toLowerCase().includes(s) ||
          g.provider.toLowerCase().includes(s) ||
          g.category.toLowerCase().includes(s)
      );
    }
    return rows;
  }, [rooms, ownedOnly, linkedSlugs, q]);

  const showOwned = linkedSlugs.length > 0;

  return (
    <div className="space-y-6 pb-4">
      {verify?.show ? (
        <ClaimVerifyBanner href={verify.href} title={verify.title} body={verify.body} />
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowSearch((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8"
          aria-label="Search games"
        >
          <Search className="h-4 w-4" />
        </button>
        <div className="flex flex-1 rounded-full bg-white/8 p-1">
          <span className="flex-1 rounded-full bg-amber-400 py-2 text-center text-sm font-bold text-zinc-950">
            Game Rooms
          </span>
        </div>
      </div>

      {showSearch ? (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search games, providers, categories"
          className="hub-card w-full rounded-2xl px-4 py-3 text-sm outline-none"
          autoFocus
        />
      ) : null}

      <section className="overflow-hidden rounded-[24px] bg-[#121826]">
        <div className="relative h-36 w-full bg-gradient-to-br from-rose-600/40 via-[#1a2233] to-[#0b0e14]">
          <div className="absolute inset-0 flex items-end p-5">
            <div>
              <h1 className="text-2xl font-extrabold">Game Rooms</h1>
              <p className="text-sm text-white/70">Load credits. Redeem winnings.</p>
              <Button asChild size="sm" className="mt-3 rounded-full">
                <Link href="/play">Browse rooms →</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {showOwned ? (
        <div className="flex gap-2">
          {(
            [
              [false, "All rooms"],
              [true, "Your rooms"],
            ] as const
          ).map(([owned, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setOwnedOnly(owned)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold",
                ownedOnly === owned ? "bg-white text-zinc-950" : "bg-white/8 text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-extrabold">Game Rooms</h2>
          <Link href="/play" className="text-sm font-semibold text-primary">
            See all
          </Link>
        </div>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-hide">
          {filtered.slice(0, 12).map((g) => (
            <RoomCard key={g.slug} game={g} />
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No rooms match that filter.</p>
        ) : null}
      </section>

      <Link href="/play" className="hub-card flex items-center gap-3 rounded-2xl p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-lg">🎮</span>
        <p className="flex-1 text-sm font-semibold">Browse every available title in one clear catalog</p>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>

      <WalletSnapshot initial={wallet} />

      {(promotions.length > 0 || dailySpinEnabled) && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-xl font-extrabold">Your rewards</h2>
            <Link href="/dashboard/rewards" className="text-sm font-semibold text-primary">
              See all
            </Link>
          </div>
          <div className="space-y-3">
            {dailySpinEnabled ? (
              <Link href="/spin" className="hub-card block rounded-2xl p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-400">Daily</p>
                <p className="mt-1 font-bold">Freeplay spin</p>
                <p className="text-sm text-muted-foreground">Claim if today&apos;s spin is still open.</p>
              </Link>
            ) : null}
            {promotions.slice(0, 4).map((p) => (
              <Link key={p.id} href="/promotions" className="hub-card block rounded-2xl p-4">
                {p.badge_text ? (
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">{p.badge_text}</p>
                ) : null}
                <p className="mt-1 font-bold">{p.title}</p>
                {p.summary ? <p className="text-sm text-muted-foreground">{p.summary}</p> : null}
                {p.ends_at ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ends {new Date(p.ends_at).toLocaleDateString()}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-3 pb-2 text-sm font-semibold">
        <Link href="/support" className="hub-card flex-1 rounded-2xl py-3 text-center">
          Help
        </Link>
        <Link href="/terms" className="hub-card flex-1 rounded-2xl py-3 text-center">
          Play controls
        </Link>
      </div>
    </div>
  );
}

export function LoggedInHomeStrip(props: {
  games: Game[];
  kycStatus?: string | null;
}) {
  return (
    <PlayerHome
      games={props.games}
      linkedSlugs={[]}
      promotions={[]}
      wallet={{ balance: 0, cashout: 0, freeplay: 0 }}
      verify={
        props.kycStatus && props.kycStatus !== "verified"
          ? {
              show: true,
              href: "/dashboard/kyc",
              title: "Verify to cash out",
              body: "Finish ID checks before redeeming.",
            }
          : null
      }
      dailySpinEnabled={false}
    />
  );
}
