"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { motion } from "framer-motion";
import type { Game } from "@/lib/games";
import type { PublicPromotion } from "@/lib/data/promotions-public";
import { ClaimVerifyBanner } from "@/components/player/claim-verify-banner";
import { WalletSnapshot } from "@/components/player/wallet-snapshot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlayerMotion } from "@/lib/player-motion";
import { MotionPage } from "@/components/player/motion-page";

function RoomCard({ game, tap }: { game: Game; tap?: { scale: number } }) {
  return (
    <motion.div whileTap={tap} whileHover={{ y: -2 }} className="shrink-0">
      <Link
        href={`/games/${game.slug}`}
        className="hub-card block w-[148px] overflow-hidden rounded-2xl transition-shadow hover:shadow-[0_0_20px_rgba(255,45,85,0.25)]"
      >
        <div className="relative h-28 w-full bg-white/5">
          <Image src={game.image} alt="" fill className="object-cover" />
          {game.popular ? (
            <span className="absolute left-2 top-2 rounded bg-[#f5c542] px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-950">
              Featured
            </span>
          ) : null}
        </div>
        <div className="flex items-start justify-between gap-1 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{game.name}</p>
            <p className="text-xs text-zinc-400">Load + redeem</p>
          </div>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
        </div>
      </Link>
    </motion.div>
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
  const { stagger, tap } = usePlayerMotion();

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
    <MotionPage className="space-y-6 pb-4">
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
          <span className="flex-1 rounded-full bg-[#f5c542] py-2 text-center text-sm font-bold text-zinc-950">
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

      <section className="hub-card relative overflow-hidden rounded-[24px]">
        <div className="relative h-44 w-full bg-[radial-gradient(ellipse_at_top,_rgba(255,45,85,0.35),_transparent_55%),linear-gradient(160deg,#1a1028_0%,#07060c_70%)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(245,197,66,0.12),transparent)]" />
          <div className="absolute inset-0 flex items-end p-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ffd666]">Sweepstakes Hub</p>
              <h1 className="mt-1 text-2xl font-extrabold">Welcome to the floor</h1>
              <p className="text-sm text-zinc-400">Game Rooms — load credits, redeem winnings.</p>
              <Button asChild size="sm" className="hub-cta-glow mt-3 rounded-full">
                <Link href="/play">Enter Game Rooms</Link>
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
                ownedOnly === owned ? "bg-white text-zinc-950" : "bg-white/8 text-zinc-400"
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
        <motion.div
          className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-hide"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: stagger } },
          }}
        >
          {filtered.slice(0, 12).map((g) => (
            <motion.div
              key={g.slug}
              variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            >
              <RoomCard game={g} tap={tap} />
            </motion.div>
          ))}
        </motion.div>
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">No rooms match that filter.</p>
        ) : null}
      </section>

      <motion.div whileTap={tap}>
        <Link href="/play" className="hub-card flex items-center gap-3 rounded-2xl p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-lg">🎮</span>
          <p className="flex-1 text-sm font-semibold">Find your game — browse every available title</p>
          <ChevronRight className="h-4 w-4 text-zinc-500" />
        </Link>
      </motion.div>

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
              <Link href="/spin" className="hub-gold-edge hub-card block rounded-2xl p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#f5c542]">Daily</p>
                <p className="mt-1 font-bold">Freeplay spin</p>
                <p className="text-sm text-zinc-400">Claim if today&apos;s spin is still open.</p>
              </Link>
            ) : null}
            {promotions.slice(0, 4).map((p) => (
              <Link key={p.id} href="/promotions" className="hub-card block rounded-2xl p-4">
                {p.badge_text ? (
                  <p className="text-xs font-bold uppercase tracking-wider text-[#f5c542]">{p.badge_text}</p>
                ) : null}
                <p className="mt-1 font-bold">{p.title}</p>
                {p.summary ? <p className="text-sm text-zinc-400">{p.summary}</p> : null}
                {p.ends_at ? (
                  <p className="mt-1 text-xs text-zinc-500">Ends {new Date(p.ends_at).toLocaleDateString()}</p>
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
          Responsible play
        </Link>
      </div>
    </MotionPage>
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
