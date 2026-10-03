import { Crown, Medal } from "lucide-react";

import { GlassCard } from "@/components/shared/glass-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import type { LeaderboardRow } from "@/lib/data/leaderboard";
import { cn } from "@/lib/utils";

const PODIUM: Record<number, { ring: string; text: string }> = {
  1: { ring: "ring-2 ring-ws-gold", text: "text-ws-gold-deep dark:text-ws-gold" },
  2: { ring: "ring-2 ring-slate-400 dark:ring-[#C7CCD6]", text: "text-slate-500 dark:text-[#C7CCD6]" },
  3: { ring: "ring-2 ring-amber-700 dark:ring-[#CD7F32]", text: "text-amber-700 dark:text-[#CD7F32]" },
};

export function LeaderboardTable({
  rows,
  me,
  highlightUserId,
}: {
  rows: LeaderboardRow[];
  me?: LeaderboardRow | null;
  highlightUserId?: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Crown />}
        title="No rankings yet"
        description="Earn XP this period to claim your spot on the board."
      />
    );
  }

  const meOnPage = me && rows.some((r) => r.user_id === me.user_id);

  return (
    <div className="space-y-3">
      <GlassCard className="overflow-hidden">
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const podium = PODIUM[row.rank];
            const isMe = row.user_id === highlightUserId;
            return (
              <li
                key={row.user_id}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 sm:px-6",
                  isMe && "bg-ws-gold/5"
                )}
              >
                <span
                  className={cn(
                    "tnum flex w-8 shrink-0 justify-center text-sm font-bold",
                    podium?.text ?? "text-muted-foreground"
                  )}
                >
                  {row.rank <= 3 ? (
                    row.rank === 1 ? (
                      <Crown className="size-5" aria-label="1st" />
                    ) : (
                      <Medal className="size-5" aria-label={`${row.rank}th`} />
                    )
                  ) : (
                    row.rank
                  )}
                </span>

                <Avatar className={cn("size-9 shrink-0", podium?.ring)}>
                  <AvatarImage src={row.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="bg-ws-surface-3 text-xs font-bold">
                    {row.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {row.display_name ?? row.username}
                    {isMe && (
                      <span className="ml-2 text-xs font-medium text-ws-gold">
                        You
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Level {row.level}
                  </p>
                </div>

                <p className="tnum shrink-0 text-right text-sm font-bold text-ws-green-deep dark:text-ws-cyan">
                  {row.score.toLocaleString()}
                  <span className="ml-1 text-[10px] font-medium text-muted-foreground uppercase">
                    XP
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      </GlassCard>

      {/* sticky "your rank" row when the viewer is off-page */}
      {me && !meOnPage && (
        <GlassCard className="flex items-center gap-4 border-ws-gold/30 px-4 py-3 sm:px-6">
          <span className="tnum flex w-8 shrink-0 justify-center text-sm font-bold text-ws-gold">
            {me.rank}
          </span>
          <Avatar className="size-9 shrink-0 ring-2 ring-ws-gold">
            <AvatarImage src={me.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="bg-ws-surface-3 text-xs font-bold">
              {me.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {me.display_name ?? me.username}
              <span className="ml-2 text-xs font-medium text-ws-gold">You</span>
            </p>
            <p className="text-xs text-muted-foreground">Level {me.level}</p>
          </div>
          <p className="tnum shrink-0 text-sm font-bold text-ws-green-deep dark:text-ws-cyan">
            {me.score.toLocaleString()}
            <span className="ml-1 text-[10px] font-medium text-muted-foreground uppercase">
              XP
            </span>
          </p>
        </GlassCard>
      )}
    </div>
  );
}
