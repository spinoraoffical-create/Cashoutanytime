"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  MapPin,
  Sparkles,
  Trophy,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getMyGameAccount } from "@/lib/actions/game-loads";
import {
  GAME_BONUS_RULES,
  getOtherGames,
  UPCOMING_GAME_MESSAGE,
  type Game,
} from "@/lib/games";
import {
  generateRandomMoreWinnersCount,
  generateRandomWinner,
  generateRandomWinnersList,
  type GameWinner,
} from "@/lib/games/recent-winners";
import { GameOtherGames } from "@/components/games/game-other-games";
import { GameDepositSection } from "@/components/games/game-deposit-section";
import { GameWalletLoadSection } from "@/components/games/game-wallet-load-section";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface GameLandingClientProps {
  game: Game;
  autoCreate?: boolean;
  walletLoadEnabled?: boolean;
  initialGameAccount?: {
    game_username: string;
    game_password: string | null;
  } | null;
}

export function GameLandingClient({
  game,
  autoCreate,
  walletLoadEnabled,
  initialGameAccount,
}: GameLandingClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const autoCreateAttempted = useRef(false);
  const walletPanelRef = useRef<HTMLDivElement>(null);
  const [accountStatus, setAccountStatus] = useState<"loading" | "none" | "has">(
    initialGameAccount?.game_username ? "has" : "loading"
  );
  const [resolvedAccount, setResolvedAccount] = useState(initialGameAccount ?? null);
  const [winner, setWinner] = useState<GameWinner | null>(null);
  const [moreWinners, setMoreWinners] = useState(0);
  const [showAllWinners, setShowAllWinners] = useState(false);
  const [extraWinners, setExtraWinners] = useState<GameWinner[]>([]);
  const otherGames = getOtherGames(game.slug);

  useEffect(() => {
    setWinner(generateRandomWinner());
    setMoreWinners(generateRandomMoreWinnersCount());
  }, []);

  function openWalletPanel() {
    setTimeout(() => {
      walletPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function handleCreateAccount() {
    if (game.upcoming) {
      toast.info(UPCOMING_GAME_MESSAGE);
      return;
    }

    const { data: { user } } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

    if (!user) {
      router.push(
        `/login?redirect=${encodeURIComponent(`/games/${game.slug}?create=1`)}`
      );
      return;
    }

    openWalletPanel();
  }

  function handleAccountChange(hasAccount: boolean) {
    setAccountStatus(hasAccount ? "has" : "none");
  }

  useEffect(() => {
    if (!walletLoadEnabled || game.upcoming) {
      setAccountStatus("none");
      return;
    }
    if (initialGameAccount?.game_username) {
      setResolvedAccount(initialGameAccount);
      setAccountStatus("has");
      return;
    }

    let cancelled = false;

    async function resolveAccount() {
      const account = await getMyGameAccount(game.slug);
      if (cancelled) return;
      if (account?.game_username) {
        setResolvedAccount({
          game_username: account.game_username,
          game_password: account.game_password,
        });
        setAccountStatus("has");
        return;
      }

      if (!supabase) {
        setAccountStatus("none");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setAccountStatus("none");
        return;
      }

      const { data } = await supabase
        .from("game_load_requests")
        .select("game_username, game_password")
        .eq("user_id", user.id)
        .eq("game_slug", game.slug)
        .eq("status", "completed")
        .in("load_type", ["create_account", "new_account"])
        .not("game_username", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (data?.game_username) {
        setResolvedAccount({
          game_username: data.game_username,
          game_password: data.game_password,
        });
        setAccountStatus("has");
      } else {
        setAccountStatus("none");
      }
    }

    void resolveAccount();
    return () => {
      cancelled = true;
    };
  }, [game.slug, game.upcoming, initialGameAccount, walletLoadEnabled, supabase]);

  useEffect(() => {
    if (!autoCreate || autoCreateAttempted.current) return;
    autoCreateAttempted.current = true;

    if (walletLoadEnabled) {
      void (async () => {
        const { data: { user } } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
        if (user) openWalletPanel();
        else
          router.push(
            `/login?redirect=${encodeURIComponent(`/games/${game.slug}?create=1`)}`
          );
      })();
      return;
    }

    void handleCreateAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreate, walletLoadEnabled]);

  function handleHowItWorks() {
    setShowHowItWorks(true);
    setTimeout(() => {
      howItWorksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function toggleWinnersList() {
    if (!showAllWinners && extraWinners.length === 0 && winner) {
      setExtraWinners(generateRandomWinnersList(moreWinners, winner.username));
    }
    setShowAllWinners((v) => !v);
  }

  const rules = GAME_BONUS_RULES;
  const showWalletPanel = Boolean(walletLoadEnabled && !game.upcoming);
  const hasAccount =
    accountStatus === "has" || Boolean(resolvedAccount?.game_username);

  const walletSection = showWalletPanel ? (
    <div ref={walletPanelRef} className="scroll-mt-24">
      <GameWalletLoadSection
        game={game}
        initialAccount={resolvedAccount}
        onAccountChange={handleAccountChange}
      />
    </div>
  ) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-8">
      {/* Upcoming notice */}
      {game.upcoming && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5">
          <p className="text-sm font-semibold text-amber-200 text-center">
            {UPCOMING_GAME_MESSAGE}
          </p>
        </section>
      )}

      {/* Hero banner + game identity */}
      <section className="relative overflow-hidden rounded-2xl border border-white/10">
        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-90", game.gradient)} />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay"
          style={{ backgroundImage: `url(${game.image})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/60 to-transparent" />

        <div className="relative p-5 sm:p-6 flex items-end gap-4 min-h-[140px]">
          <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl">
            <Image
              src={game.image}
              alt={game.name}
              fill
              className="object-cover"
              priority
              sizes="96px"
            />
          </div>
          <div className="min-w-0 pb-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">{game.name}</h1>
            <p className="text-sm text-white/70 mt-0.5">{game.category}</p>
          </div>
        </div>
      </section>

      {/* Account panel — first thing after hero when wallet load is enabled */}
      {walletSection}

      {/* Recent winners */}
      <section className="rounded-2xl border border-white/10 bg-[#1a1a1a] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h2 className="font-bold text-white">Recent winners</h2>
          </div>
          <LiveBadge />
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 flex items-center justify-between gap-3 min-h-[72px]">
          {winner ? (
            <>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-white">{winner.username}</span>
                  {winner.verified && (
                    <BadgeCheck className="h-4 w-4 text-sky-400 shrink-0" aria-label="Verified" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  from {winner.state}
                </p>
              </div>
              <span className="text-xl sm:text-2xl font-bold text-emerald-400 shrink-0">
                ${winner.amount}
              </span>
            </>
          ) : (
            <div className="w-full h-10 rounded-lg bg-white/5 animate-pulse" aria-hidden />
          )}
        </div>

        {winner && (
        <button
          type="button"
          onClick={toggleWinnersList}
          className="w-full text-center text-xs text-orange-400 hover:text-orange-300 mt-3 flex items-center justify-center gap-1 transition-colors"
        >
          {showAllWinners ? (
            <>
              Show less <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              + {moreWinners} more winners <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
        )}

        {showAllWinners && extraWinners.length > 0 && (
          <ul className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
            {extraWinners.map((w, i) => (
              <li
                key={`${w.username}-${i}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-[#242424]/80 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-white truncate">{w.username}</span>
                    {w.verified && (
                      <BadgeCheck className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-label="Verified" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    {w.state}
                  </p>
                </div>
                <span className="text-sm font-bold text-emerald-400 shrink-0">${w.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Bonuses & Rules */}
      <section className="rounded-2xl border border-white/10 bg-[#1a1a1a] p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-violet-400" />
          <h2 className="font-bold text-white">Bonuses &amp; Rules</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl bg-[#242424] border border-white/5 p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">First Time Bonus</p>
            <p className="text-3xl font-bold text-emerald-400">{rules.firstTimeBonus}%</p>
          </div>
          <div className="rounded-xl bg-[#242424] border border-white/5 p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Regular Bonus</p>
            <p className="text-3xl font-bold text-teal-400">{rules.regularBonus}%</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white">
            Load: ${rules.minDeposit} – ${rules.maxDeposit}
          </span>
          <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200">
            Redeem: {rules.redeemMin}x – {rules.redeemMax}x
          </span>
        </div>
      </section>

      {/* SEO bio */}
      <section className="rounded-2xl border border-white/5 bg-[#161616] p-4 sm:p-5">
        <h2 className="sr-only">About {game.name}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{game.bio}</p>
      </section>

      {/* Create Account — only when user has no game login yet */}
      <section className="space-y-3">
        {!hasAccount && accountStatus === "none" && (
          <button
            type="button"
            onClick={handleCreateAccount}
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded-xl py-4 px-6 text-base font-bold transition-opacity shadow-lg",
              game.upcoming
                ? "text-white/80 bg-[#2a2a2a] border border-white/10 cursor-not-allowed opacity-80"
                : "text-black bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 hover:opacity-95 shadow-orange-500/20"
            )}
          >
            <UserPlus className="h-5 w-5" />
            {game.upcoming ? "Coming Soon" : "Create Account"}
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <a
            href={game.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 text-sm font-semibold text-white bg-[#2a2a2a] border border-white/10 hover:border-white/20 hover:bg-[#333] transition-colors"
          >
            <Download className="h-4 w-4" />
            Download App
          </a>
          <button
            type="button"
            onClick={handleHowItWorks}
            className="flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 text-sm font-semibold text-white bg-[#2a2a2a] border border-white/10 hover:border-white/20 hover:bg-[#333] transition-colors"
          >
            <Info className="h-4 w-4" />
            How it works
          </button>
        </div>
      </section>

      {!game.upcoming && <GameDepositSection game={game} />}

      {/* How it works (expandable) */}
      {showHowItWorks && (
        <div
          ref={howItWorksRef}
          className="rounded-2xl border border-orange-500/20 bg-[#1a1a1a] p-5 space-y-4 scroll-mt-24"
        >
          <h3 className="font-bold text-white">How to get started</h3>
          {walletLoadEnabled ? (
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">1</span>
                <span>
                  Tap <strong className="text-white">Create Account</strong> to open your {game.name} panel.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">2</span>
                <span>
                  In the panel, create your game login — username and password appear instantly when ready.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">3</span>
                <span>
                  Download the app, sign in with your credentials, then use <strong className="text-white">Load</strong> to move Spinora wallet credits into {game.name}.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">4</span>
                <span>
                  Need more Spinora balance? Use the <strong className="text-white">Deposit</strong> section below for PayPal, Chime, Cash App, Bitcoin, or Venmo.
                </span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">1</span>
                <span>
                  Tap <strong className="text-white">Create Account</strong> to open your {game.name} panel.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">2</span>
                <span>
                  Download the app with the button above, then use your login from the panel.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">3</span>
                <span>
                  Use the <strong className="text-white">Deposit</strong> section to load funds — pick PayPal, Chime, Cash App, Bitcoin, or Venmo and upload your payment screenshot.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">4</span>
                <span>
                  Redeem at {rules.redeemMin}x–{rules.redeemMax}x after loading from Total Deposit.
                </span>
              </li>
            </ol>
          )}
        </div>
      )}

      <GameOtherGames games={otherGames} />
    </div>
  );
}
