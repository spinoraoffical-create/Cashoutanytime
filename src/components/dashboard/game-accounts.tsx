import Link from "next/link";
import Image from "next/image";
import { ExternalLink, Gamepad2, RefreshCcw, Wallet } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import {
  LoadCreditsButton,
  RedeemButton,
} from "@/components/dashboard/game-account-actions";
import type { DashboardGameAccount, ActiveJob } from "@/lib/data/dashboard";

const INITIALS_BG = [
  "from-ws-gold/30 to-ws-gold/10",
  "from-ws-cyan/30 to-ws-cyan/10",
  "from-ws-purple/30 to-ws-purple/10",
  "from-ws-emerald/30 to-ws-emerald/10",
];

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const JOB_LABELS: Record<string, string> = {
  new_account: "Creating…",
  create_account: "Creating…",
  reload: "Loading…",
  load: "Loading…",
  redeem: "Redeeming…",
  check_balance: "Checking…",
};

function JobPill({ job }: { job: ActiveJob }) {
  const label = JOB_LABELS[job.loadType] ?? "Working…";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ws-gold/10 px-2 py-0.5 text-[11px] font-semibold text-ws-gold">
      <span className="size-1.5 animate-pulse rounded-full bg-ws-gold" aria-hidden />
      {label}
    </span>
  );
}

function GameAccountCard({
  account,
  index,
  walletBalance,
  activeJob,
}: {
  account: DashboardGameAccount;
  index: number;
  walletBalance: number;
  activeJob?: ActiveJob;
}) {
  const game = account.games;
  const name = game?.name ?? "Game";
  const bg = INITIALS_BG[index % INITIALS_BG.length];
  const syncedAt = account.last_synced_at
    ? formatDistanceToNow(new Date(account.last_synced_at), { addSuffix: true })
    : null;
  const isPending = account.pending || activeJob?.loadType === "create_account" || activeJob?.loadType === "new_account";
  const job = isPending ? (activeJob ?? { loadType: "create_account", status: "pending" }) : activeJob;
  const hasRealGameId =
    !account.game_id.startsWith("pending-") && !account.game_id.startsWith("orphan-");

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-foreground/8 bg-ws-surface/60 p-4">
      <div className="flex items-center gap-3">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg">
          {game?.image_url ? (
            <Image src={game.image_url} alt={name} fill className="object-cover" sizes="48px" />
          ) : (
            <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${bg}`}>
              <span className="text-sm font-bold text-foreground/70">{initialsOf(name)}</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{name}</p>
            {job && <JobPill job={job} />}
          </div>
          <p className="truncate text-xs text-muted-foreground">@{account.game_username}</p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          {isPending ? (
            <>
              <p className="hud-label text-muted-foreground">Status</p>
              <p className="text-sm text-muted-foreground">Account setup in progress…</p>
            </>
          ) : (
            <>
              <p className="hud-label text-muted-foreground">Credits</p>
              <p className="tnum text-2xl font-bold text-ws-gold">
                {account.credits_balance.toLocaleString()}
              </p>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <RefreshCcw className="size-3" aria-hidden />
                {syncedAt ? `synced ${syncedAt}` : "pending sync"}
              </div>
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {!isPending && hasRealGameId && (
            <>
              <LoadCreditsButton gameId={account.game_id} walletBalance={walletBalance} />
              {account.credits_balance > 0 && (
                <RedeemButton gameId={account.game_id} gameBalance={account.credits_balance} />
              )}
            </>
          )}
          {!isPending && !hasRealGameId && game?.slug && (
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href={`/games/${game.slug}`}>Manage</Link>
            </Button>
          )}
          {game?.play_url ? (
            <Button asChild size="sm" variant="ghost" className="shrink-0">
              <a href={game.play_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" aria-hidden />
                Play
              </a>
            </Button>
          ) : game?.slug ? (
            <Button asChild size="sm" variant="ghost" className="shrink-0">
              <Link href={`/games/${game.slug}`}>
                <ExternalLink className="size-3.5" aria-hidden />
                Open
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function GameAccountsSection({
  accounts,
  walletBalance,
  activeJobs = {},
}: {
  accounts: DashboardGameAccount[];
  walletBalance: number;
  activeJobs?: Record<string, ActiveJob>;
}) {
  const hasNothing = accounts.length === 0;

  return (
    <GlassCard className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="hud-label text-muted-foreground">Linked accounts</p>
        <div className="flex items-center gap-2 text-sm">
          <Wallet className="size-4 text-ws-gold" aria-hidden />
          <span className="text-muted-foreground">Wallet</span>
          <span className="tnum font-bold text-ws-gold">${walletBalance.toLocaleString()}</span>
          <Button asChild size="sm" variant="outline" className="ml-1">
            <Link href="/dashboard/deposit">Add Funds</Link>
          </Button>
        </div>
      </div>

      {hasNothing ? (
        <div className="mt-4 flex flex-col items-center gap-3 py-6 text-center">
          <Gamepad2 className="size-10 text-ws-gold/40" aria-hidden />
          <p className="text-sm font-medium">No game accounts yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Open a game in the lobby, create your free account there, then come back here to load and cash out.
          </p>
          <Button asChild size="sm" variant="outline" className="mt-1">
            <Link href="/">Browse lobby</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account, i) => (
            <GameAccountCard
              key={account.id}
              account={account}
              index={i}
              walletBalance={walletBalance}
              activeJob={activeJobs[account.games?.slug ?? ""]}
            />
          ))}
        </div>
      )}
    </GlassCard>
  );
}
