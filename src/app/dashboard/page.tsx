import Link from "next/link";
import {
  Banknote,
  Crown,
  Flame,
  Gift,
  History,
  Plus,
  Sparkles,
  Wallet,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { ClaimButton } from "@/components/dashboard/claim-button";
import { GameLobbySwitcher, type LobbyPlatform } from "@/components/dashboard/game-lobby-switcher";
import { RolloverTracker } from "@/components/dashboard/rollover-tracker";
import {
  getDashboardCore,
  getGameAccountSummary,
  getRecentActivity,
  getRewardsOverview,
  getWalletData,
  getActiveJobsByGame,
  getDashboardGameAccounts,
} from "@/lib/data/dashboard";
import { getDashboardRollover } from "@/lib/data/rollover";
import { GAMES } from "@/lib/games";

const FEATURED_SLUGS = [
  "juwa",
  "fire-kirin",
  "orion-stars",
  "game-vault",
  "milky-way",
  "panda-master",
] as const;

const QUICK_ACTIONS = [
  { label: "Add Funds", sub: "Top up wallet", href: "/dashboard/deposit", icon: Plus },
  { label: "Daily Spin", sub: "Free rewards", href: "/spin", icon: Sparkles },
  { label: "VIP Lounge", sub: "Tier perks", href: "/dashboard/vip", icon: Crown },
  { label: "Refer & Earn", sub: "Invite friends", href: "/dashboard/referrals", icon: Gift },
];

function buildLobbyPlatforms(
  accounts: Awaited<ReturnType<typeof getDashboardGameAccounts>>
): LobbyPlatform[] {
  const bySlug = new Map(
    accounts
      .map((a) => {
        const slug = a.games?.slug;
        return slug ? ([slug, a] as const) : null;
      })
      .filter((e): e is [string, (typeof accounts)[number]] => e !== null)
  );

  return FEATURED_SLUGS.map((slug) => {
    const catalog = GAMES.find((g) => g.slug === slug);
    const account = bySlug.get(slug);
    return {
      slug,
      name: catalog?.name ?? slug,
      image: catalog?.image ?? "/games/juwa.webp",
      tagline: catalog?.bio?.slice(0, 72) ?? "Create account & load instantly.",
      linked: Boolean(account && !account.pending),
      username: account?.game_username,
      pending: account?.pending,
    };
  });
}

export default async function DashboardHomePage() {
  const core = await getDashboardCore();
  const { profile, tier } = core;
  const multiplier = Number(tier?.reward_multiplier ?? 1);
  const displayName = profile.display_name ?? profile.username ?? "Player";

  const [rewards, activity, gameSummary, wallet, rollover, accounts, activeJobs] =
    await Promise.all([
      getRewardsOverview(profile, multiplier),
      getRecentActivity(6),
      getGameAccountSummary(),
      getWalletData(),
      getDashboardRollover(),
      getDashboardGameAccounts(),
      getActiveJobsByGame(),
    ]);

  const daily = rewards.streams.find((s) => s.rule.reward_type === "daily");
  const lobbyPlatforms = buildLobbyPlatforms(accounts);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-400/80">Gaming hub</p>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Welcome back, <span className="hub-gradient-text">{displayName}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Wallet, platforms, rollover progress, and rewards — all in one place.
          </p>
        </div>
        <Link
          href="/dashboard/vip"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.15)]"
        >
          <Crown className="h-3.5 w-3.5 text-amber-400" /> {tier?.name ?? "VIP"} · {multiplier}× rewards
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="hub-card hub-card-glow flex items-center justify-between gap-4 rounded-2xl p-5">
          <div>
            <div className="flex items-center gap-2 text-emerald-400/90">
              <Wallet className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-wider">Wallet balance</span>
            </div>
            <p className="mt-2 text-3xl font-extrabold tabular-nums text-foreground">
              ${wallet.balance.toLocaleString()}
            </p>
          </div>
          <Link
            href="/dashboard/deposit"
            className="shrink-0 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110"
          >
            Add Funds
          </Link>
        </div>
        <div className="hub-card rounded-2xl p-5">
          <div className="flex items-center gap-2 text-emerald-400/90">
            <Banknote className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider">Cash-out balance</span>
          </div>
          <p className="mt-2 text-3xl font-extrabold tabular-nums text-foreground">
            ${wallet.cashout.toLocaleString()}
          </p>
          <Link
            href="/dashboard/wallet"
            className="mt-1 inline-block text-xs text-emerald-400 underline-offset-4 hover:underline"
          >
            View wallet history →
          </Link>
        </div>
      </div>

      <RolloverTracker rollover={rollover} />

      <GameLobbySwitcher platforms={lobbyPlatforms} activeJobs={activeJobs} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.href + a.label}
            href={a.href}
            className="hub-card flex items-center gap-3 rounded-xl p-4 transition-all hover:border-emerald-500/25 hover:shadow-[0_0_20px_rgba(16,185,129,0.08)]"
          >
            <span className="shrink-0 text-emerald-400">
              <a.icon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{a.label}</p>
              <p className="truncate text-xs text-muted-foreground">{a.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {daily && (
        <div className="hub-card flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Daily reward</p>
            <h2 className="mt-1 text-lg font-bold text-foreground">
              {daily.claimed ? "Claimed — streak secured" : "Your daily reward is ready"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {daily.claimed
                ? `Come back tomorrow to extend your ${profile.current_streak ?? 0}-day streak.`
                : `${Math.round(daily.rule.coins * multiplier).toLocaleString()} coins + ${daily.rule.xp.toLocaleString()} XP${multiplier > 1 ? ` · ${multiplier}× VIP boost` : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-emerald-400">
              <Flame className="h-5 w-5" aria-hidden />
              <span className="tabular-nums text-lg font-bold">{profile.current_streak ?? 0}</span>
              <span className="text-xs text-muted-foreground">streak</span>
            </span>
            <ClaimButton ruleKey={daily.rule.key} claimed={daily.claimed} size="lg">
              <Gift className="size-4" aria-hidden /> Claim
            </ClaimButton>
          </div>
        </div>
      )}

      <Link
        href="/dashboard/games"
        className="hub-card flex items-center justify-between gap-4 rounded-2xl p-5 transition-all hover:border-emerald-500/25"
      >
        <div>
          <p className="font-semibold text-foreground">My Games</p>
          <p className="text-sm text-muted-foreground">
            {gameSummary.total === 0
              ? "Create accounts and manage loads from one place."
              : gameSummary.pending > 0
                ? `${gameSummary.linked} linked · ${gameSummary.pending} setting up`
                : `${gameSummary.linked} linked game${gameSummary.linked === 1 ? "" : "s"}`}
          </p>
        </div>
        <span className="shrink-0 text-sm font-medium text-emerald-400">Open →</span>
      </Link>

      <div className="hub-card rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent activity
          </p>
          <Link
            href="/dashboard/activity"
            className="text-xs font-medium text-emerald-400 underline-offset-4 hover:underline"
          >
            Full history
          </Link>
        </div>
        {activity.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <History className="h-8 w-8 text-foreground/15" aria-hidden />
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {activity.map((item) => (
              <li key={item.id} className="flex items-center gap-3 text-sm">
                <span className="size-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-foreground">{item.description}</span>
                <time dateTime={item.created_at} className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
