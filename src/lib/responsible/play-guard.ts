import "server-only";

import { createClient } from "@/lib/supabase/server";

type Prefs = {
  depositLimit?: number;
  depositLimitPending?: number;
  depositLimitPendingAt?: string;
  weeklyLoadLimit?: number;
  weeklyLoadLimitPending?: number;
  weeklyLoadLimitPendingAt?: string;
  monthlyLoadLimit?: number;
  monthlyLoadLimitPending?: number;
  monthlyLoadLimitPendingAt?: string;
  timeoutUntil?: string;
  selfExcludeUntil?: string;
};

function activeLimit(current: unknown, pending: unknown, at: unknown) {
  if (typeof at === "string" && at && Date.now() >= new Date(at).getTime()) return Number(pending) || 0;
  return Number(current || 0);
}

const DAY = 24 * 60 * 60 * 1000;

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

/** Blocks adding money and game loads while a break, exclusion, or load limit is active. */
export async function responsibleBlock(amount: number): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Sign in to continue.";

  const prefs = (user.user_metadata?.prefs ?? {}) as Prefs;
  const now = Date.now();
  if (prefs.selfExcludeUntil && new Date(prefs.selfExcludeUntil).getTime() > now) {
    return "Self-exclusion is on. Adding money and loading a game stay off until it ends. Cash out still works.";
  }
  if (prefs.timeoutUntil && new Date(prefs.timeoutUntil).getTime() > now) {
    return "A short-term break is on. Adding money and loading a game stay off until it ends.";
  }

  const daily = activeLimit(prefs.depositLimit, prefs.depositLimitPending, prefs.depositLimitPendingAt);
  const weekly = activeLimit(prefs.weeklyLoadLimit, prefs.weeklyLoadLimitPending, prefs.weeklyLoadLimitPendingAt);
  const monthly = activeLimit(prefs.monthlyLoadLimit, prefs.monthlyLoadLimitPending, prefs.monthlyLoadLimitPendingAt);
  if (daily <= 0 && weekly <= 0 && monthly <= 0) return null;

  const since = new Date(now - 30 * DAY).toISOString();
  const { data } = await supabase
    .from("wallet_transactions")
    .select("amount, created_at")
    .eq("user_id", user.id)
    .eq("source", "deposit")
    .gte("created_at", since);

  const rows = data ?? [];
  const spent = (windowMs: number) =>
    rows.reduce((sum, row) => {
      const at = new Date(String(row.created_at)).getTime();
      return at >= now - windowMs ? sum + Number(row.amount || 0) : sum;
    }, 0);

  if (daily > 0 && spent(DAY) + amount > daily) {
    return `That would pass your daily limit of ${money(daily)}.`;
  }
  if (weekly > 0 && spent(7 * DAY) + amount > weekly) {
    return `That would pass your weekly limit of ${money(weekly)}.`;
  }
  if (monthly > 0 && spent(30 * DAY) + amount > monthly) {
    return `That would pass your monthly limit of ${money(monthly)}.`;
  }
  return null;
}

