import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import {
  Award,
  Coins,
  Gift,
  History,
  Sparkles,
  TrendingUp,
  UserPlus,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/data/dashboard";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Activity | Spinora" };

const PAGE_SIZE = 25;

const ACTION_ICON: Record<string, typeof Gift> = {
  reward_claimed: Gift,
  promotion_claimed: Sparkles,
  achievement_unlocked: Award,
  referral_rewarded: UserPlus,
  level_up: TrendingUp,
};

const ACTION_ACCENT: Record<string, string> = {
  reward_claimed: "text-ws-gold bg-ws-gold/10",
  promotion_claimed: "text-ws-purple bg-ws-purple/10",
  achievement_unlocked: "text-ws-cyan bg-ws-cyan/10",
  referral_rewarded: "text-ws-emerald bg-ws-emerald/10",
  level_up: "text-ws-gold bg-ws-gold/10",
};

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from("activity_log")
    .select("id, action, description, metadata, created_at", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  const items = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl">Activity History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A full ledger of your claims, unlocks, referrals and level-ups.
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<History />}
          title="No activity yet"
          description="Claim your daily reward to start your history."
          action={
            <Button asChild>
              <Link href="/dashboard/rewards">Go to Rewards</Link>
            </Button>
          }
        />
      ) : (
        <>
          <GlassCard className="overflow-hidden">
            <ul className="divide-y divide-foreground/8">
              {items.map((item) => {
                const Icon = ACTION_ICON[item.action] ?? Coins;
                const accent =
                  ACTION_ACCENT[item.action] ?? "text-muted-foreground bg-foreground/5";
                const meta = (item.metadata ?? {}) as Record<string, unknown>;
                const coins = Number(meta.coins ?? 0);
                const xp = Number(meta.xp ?? 0);
                return (
                  <li key={item.id} className="flex items-center gap-4 p-4">
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl",
                        accent
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.description}</p>
                      <time dateTime={item.created_at} className="text-xs text-muted-foreground">
                        {format(new Date(item.created_at), "MMM d, yyyy · HH:mm")}
                      </time>
                    </div>
                    {(coins > 0 || xp > 0) && (
                      <div className="shrink-0 text-right">
                        {coins > 0 && (
                          <p className="tnum text-sm font-semibold text-ws-gold">
                            +{coins.toLocaleString()}
                          </p>
                        )}
                        {xp > 0 && (
                          <p className="tnum text-xs font-medium text-ws-cyan">
                            +{xp.toLocaleString()} XP
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </GlassCard>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button
                asChild
                variant="outline"
                size="sm"
                disabled={page <= 1}
                className={cn(page <= 1 && "pointer-events-none opacity-50")}
              >
                <Link href={`/dashboard/activity?page=${page - 1}`}>Previous</Link>
              </Button>
              <p className="tnum text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <Button
                asChild
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                className={cn(page >= totalPages && "pointer-events-none opacity-50")}
              >
                <Link href={`/dashboard/activity?page=${page + 1}`}>Next</Link>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
