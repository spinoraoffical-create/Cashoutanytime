"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { CreateGameAccountModal } from "@/components/games/create-game-account-modal";
import { GameWalletLoadSection } from "@/components/games/game-wallet-load-section";
import { createClient } from "@/lib/supabase/client";
import { getMyGameAccount } from "@/lib/actions/game-loads";
import { GAME_BONUS_RULES, UPCOMING_GAME_MESSAGE, type Game } from "@/lib/games";
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
  const autoCreateAttempted = useRef(false);
  const [accountStatus, setAccountStatus] = useState<"loading" | "none" | "has">(
    initialGameAccount?.game_username ? "has" : "none"
  );
  const [resolvedAccount, setResolvedAccount] = useState(initialGameAccount ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

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

    setCreateOpen(true);
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
    if (accountStatus === "loading") return;
    autoCreateAttempted.current = true;

    if (walletLoadEnabled && accountStatus === "has") return;

    void handleCreateAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreate, walletLoadEnabled, accountStatus]);

  const rules = GAME_BONUS_RULES;
  const hasAccount = accountStatus === "has" || Boolean(resolvedAccount?.game_username);

  const createModal = (
    <CreateGameAccountModal
      game={game}
      open={createOpen}
      onOpenChange={setCreateOpen}
      onCreated={() => setReloadToken((n) => n + 1)}
    />
  );

  return (
    <div className="space-y-3 pb-8">
      <div className="flex min-h-14 items-center gap-2.5">
        <Link
          href="/play"
          aria-label="Back to games"
          className="grid h-11 w-11 place-items-center rounded-2xl bg-[#24152e] text-[#fcf9fb]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl">
          <Image src={game.image} alt="" fill className="object-cover" priority sizes="44px" />
        </div>
        <h1 className="min-w-0 truncate text-lg font-black">{game.name}</h1>
      </div>

      {game.upcoming ? (
        <section className="rounded-2xl border border-white/10 bg-[#24152e] p-4">
          <p className="text-sm font-semibold text-[#f4c64e]">{UPCOMING_GAME_MESSAGE}</p>
        </section>
      ) : null}

      {!game.upcoming && hasAccount && resolvedAccount ? (
        <GameWalletLoadSection
          mode="owned"
          game={game}
          initialAccount={resolvedAccount}
          reloadToken={reloadToken}
        />
      ) : null}

      {!game.upcoming && !hasAccount ? (
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#24152e]">
          <div className="p-4">
            <h2 className="text-lg font-black">Start with {game.name}</h2>
            <p className="mt-1 text-sm text-[#b9b3c6]">
              Create your game sign-in, then load funds when you&apos;re ready.
            </p>
            <button
              type="button"
              onClick={() => void handleCreateAccount()}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-[#ff6b89] text-base font-bold text-[#3a1020]"
            >
              Create game account
            </button>
          </div>
          <details className="border-t border-white/10">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-bold text-[#b9b3c6] [&::-webkit-details-marker]:hidden">
              Before you start
              <ChevronDown className="h-4 w-4" />
            </summary>
            <p className="px-4 pb-4 text-sm leading-relaxed text-[#b9b3c6]">
              Loads start at ${rules.minDeposit}. Move winnings after they reach {rules.redeemMin}× your latest load, up to {rules.redeemMax}×. First load bonus {rules.firstTimeBonus}%. Later loads {rules.regularBonus}%.
            </p>
          </details>
        </section>
      ) : null}

      <details open className="overflow-hidden rounded-2xl border border-white/10 bg-[#1a1024]">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 text-sm font-black [&::-webkit-details-marker]:hidden">
          Rules &amp; game details
          <ChevronDown className="h-4 w-4 text-[#b9b3c6]" />
        </summary>
        <div className="space-y-3 px-4 pb-4 text-sm leading-relaxed text-[#b9b3c6]">
          <p>
            Loads start at <strong className="text-[#fcf9fb]">${rules.minDeposit}</strong>. Move winnings after they reach{" "}
            <strong className="text-[#fcf9fb]">{rules.redeemMin}×</strong> your latest load, up to {rules.redeemMax}×.
            First load bonus {rules.firstTimeBonus}%. Later loads {rules.regularBonus}%.
          </p>
          <p>{game.bio}</p>
        </div>
      </details>

      <Link href="/dashboard/activity" className="flex min-h-14 items-center justify-between border-b border-white/10 py-3 text-sm">
        <span className="font-bold">Activity</span>
        <span className="flex items-center gap-1 text-[#b9b3c6]">
          Loads and moved winnings
          <ChevronRight className="h-4 w-4" />
        </span>
      </Link>

      <Link href="/support" className="flex min-h-14 items-center justify-between border-b border-white/10 py-3 text-sm">
        <span className="font-bold">Get help</span>
        <span className="flex items-center gap-1 text-[#b9b3c6]">
          Talk to support
          <ChevronRight className="h-4 w-4" />
        </span>
      </Link>

      {createModal}
    </div>
  );
}
