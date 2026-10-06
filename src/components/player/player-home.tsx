"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Search, Shield, X } from "lucide-react";
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
    <motion.div whileTap={tap} className="shrink-0">
      <Link href={`/games/${game.slug}`} className="hub-card block w-[168px] overflow-hidden rounded-2xl">
        <div className="relative h-28 w-full bg-white/5">
          <Image src={game.image} alt="" fill className="object-cover" />
          {game.popular ? (
            <span className="absolute left-2 top-2 rounded-full bg-[#f5c542] px-2 py-0.5 text-[9px] font-bold uppercase text-zinc-950">
              Featured
            </span>
          ) : null}
          <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow-[0_0_12px_rgba(255,45,85,0.45)]">
            <ChevronRight className="h-4 w-4" />
          </span>
        </div>
        <div className="p-3">
          <p className="truncate text-sm font-bold">{game.name}</p>
          <p className="text-xs capitalize text-zinc-400">{game.category}</p>
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
  const [catalog, setCatalog] = useState<"rooms" | "instant">("rooms");
  const [hideVerify, setHideVerify] = useState(false);
  const { stagger, tap } = usePlayerMotion();

  const filtered = useMemo(() => {
    let rows = rooms;
    if (ownedOnly) {
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

  return (
    <MotionPage className="space-y-6 pb-4">
      {verify?.show ? (
        <ClaimVerifyBanner href={verify.href} title={verify.title} body={verify.body} />
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowSearch((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/8"
          aria-label="Search games"
        >
          <Search className="h-4 w-4" />
        </button>
        <div className="flex flex-1 rounded-full bg-[#1c1830] p-1">
          <button
            type="button"
            onClick={() => setCatalog("rooms")}
            className={cn(
              "flex-1 rounded-full py-2.5 text-sm font-bold",
              catalog === "rooms" ? "bg-[#f5c542] text-zinc-950" : "text-zinc-400"
            )}
          >
            Game Rooms
          </button>
          <button
            type="button"
            onClick={() => setCatalog("instant")}
            className={cn(
              "flex-1 rounded-full py-2.5 text-sm font-semibold",
              catalog === "instant" ? "bg-[#f5c542] text-zinc-950" : "text-zinc-300"
            )}
          >
            Instant Games
          </button>
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

      {catalog === "instant" ? (
        <section className="hub-card rounded-[24px] p-5">
          <h2 className="text-xl font-extrabold">Instant Games</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Instant play is not on this floor. Game Rooms are ready — load credits, then redeem winnings back to your wallet.
          </p>
          <Button type="button" className="mt-4 rounded-full bg-[#f5c542] font-bold text-zinc-950 hover:bg-[#f5c542]/90" onClick={() => setCatalog("rooms")}>
            Back to Game Rooms
          </Button>
        </section>
      ) : (
        <section className="relative overflow-hidden rounded-[24px]">
          <div className="relative h-48 w-full">
            <Image src="/games/game-vault.webp" alt="" fill sizes="480px" className="object-cover" priority />
            <div className="absolute inset-0 bg-gradient-to-r from-[#07060c] via-[#07060c]/80 to-[#07060c]/20" />
            <div className="absolute inset-0 flex items-end p-5">
              <div>
                <h2 className="text-3xl font-extrabold">Game Rooms</h2>
                <Link
                  href="/play"
                  className="mt-3 inline-flex rounded-full bg-[#f5c542] px-4 py-2 text-sm font-bold text-zinc-950"
                >
                  Browse rooms →
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {catalog === "rooms" ? (
        <div className="flex gap-5 px-1">
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
                "text-sm font-semibold",
                ownedOnly === owned ? "text-white" : "text-zinc-500"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {catalog === "rooms" ? (
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold">Game Rooms</h2>
            <p className="text-sm text-zinc-400">Choose a room to view its details</p>
          </div>
          <Link href="/play" className="text-sm font-semibold text-primary">
            See all →
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
      ) : null}

      {verify?.show && !hideVerify ? (
        <section className="hub-card flex items-center gap-3 rounded-[22px] p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <Shield className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">Verify your account</p>
            <p className="text-xs text-zinc-400">Confirm your email and phone to secure your account.</p>
          </div>
          <Link href={verify.href} className="shrink-0 rounded-full bg-primary px-3 py-2 text-xs font-bold text-white">
            Verify now →
          </Link>
          <button
            type="button"
            onClick={() => setHideVerify(true)}
            className="shrink-0 text-zinc-500"
            aria-label="Hide getting started"
          >
            <X className="h-4 w-4" />
          </button>
        </section>
      ) : null}

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
              See all →
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
              href: "/dashboard/verification",
              title: "Verify to cash out",
              body: "Finish ID checks before redeeming.",
            }
          : null
      }
      dailySpinEnabled={false}
    />
  );
}
