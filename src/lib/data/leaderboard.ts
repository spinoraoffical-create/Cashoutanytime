import { createClient } from "@/lib/supabase/server";
import {
  utcDateKey,
  utcMonthKey,
  utcWeekKey,
} from "@/lib/data/dashboard";
import type { LeaderboardPeriod } from "@/lib/database.types";

export const LEADERBOARD_PERIODS: {
  key: LeaderboardPeriod;
  label: string;
}[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "all_time", label: "All Time" },
];

export function periodKeyFor(period: LeaderboardPeriod): string {
  switch (period) {
    case "daily":
      return utcDateKey();
    case "weekly":
      return utcWeekKey();
    case "monthly":
      return utcMonthKey();
    case "all_time":
      return "all";
  }
}

export type LeaderboardRow = {
  user_id: string;
  rank: number;
  score: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  level: number;
  country: string | null;
};

export type LeaderboardView = {
  period: LeaderboardPeriod;
  rows: LeaderboardRow[];
  me: LeaderboardRow | null;
};

/**
 * Standings for a period. Joins live leaderboard_entries to public_profiles.
 * `currentUserId` (optional) surfaces the viewer's own rank even when off-page.
 */
export async function getLeaderboard(
  period: LeaderboardPeriod,
  limit = 50,
  currentUserId?: string
): Promise<LeaderboardView> {
  const supabase = await createClient();
  const periodKey = periodKeyFor(period);

  const { data: entries } = await supabase
    .from("leaderboard_entries")
    .select("user_id, rank, score")
    .eq("period", period)
    .eq("period_key", periodKey)
    .order("rank", { ascending: true })
    .limit(limit);

  const list = entries ?? [];
  const ids = list.map((e) => e.user_id);

  let profileMap = new Map<
    string,
    { username: string; display_name: string | null; avatar_url: string | null; level: number; country: string | null }
  >();

  if (ids.length) {
    const { data: profiles } = await supabase.rpc("public_profiles_by_ids", {
      p_ids: ids,
    });
    profileMap = new Map(
      (profiles ?? []).map((p: {
        id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        level: number;
        country: string | null;
      }) => [
        p.id,
        {
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          level: p.level,
          country: p.country,
        },
      ])
    );
  }

  const rows: LeaderboardRow[] = list.map((e) => {
    const p = profileMap.get(e.user_id);
    return {
      user_id: e.user_id,
      rank: e.rank ?? 0,
      score: e.score,
      username: p?.username ?? "player",
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      level: p?.level ?? 1,
      country: p?.country ?? null,
    };
  });

  let me: LeaderboardRow | null = null;
  if (currentUserId) {
    me = rows.find((r) => r.user_id === currentUserId) ?? null;
    if (!me) {
      const { data: myEntry } = await supabase
        .from("leaderboard_entries")
        .select("user_id, rank, score")
        .eq("period", period)
        .eq("period_key", periodKey)
        .eq("user_id", currentUserId)
        .maybeSingle();
      if (myEntry) {
        const { data: myProfiles } = await supabase.rpc(
          "public_profiles_by_ids",
          { p_ids: [currentUserId] }
        );
        const myProfile = myProfiles?.[0] ?? null;
        me = {
          user_id: currentUserId,
          rank: myEntry.rank ?? 0,
          score: myEntry.score,
          username: myProfile?.username ?? "you",
          display_name: myProfile?.display_name ?? null,
          avatar_url: myProfile?.avatar_url ?? null,
          level: myProfile?.level ?? 1,
          country: myProfile?.country ?? null,
        };
      }
    }
  }

  return { period, rows, me };
}

export function isLeaderboardPeriod(value: string): value is LeaderboardPeriod {
  return ["daily", "weekly", "monthly", "all_time"].includes(value);
}
