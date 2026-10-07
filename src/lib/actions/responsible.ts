"use server";

import { createClient } from "@/lib/supabase/server";

const DAY = 24 * 60 * 60 * 1000;

export async function getSpendingSummary() {
  const empty = { deposits: 0, redeems: 0 };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { days7: empty, days30: empty, days90: empty };

  const since = new Date(Date.now() - 90 * DAY).toISOString();
  const { data } = await supabase
    .from("wallet_transactions")
    .select("amount, source, created_at")
    .eq("user_id", user.id)
    .in("source", ["deposit", "game_redeem"])
    .gte("created_at", since);

  const rows = data ?? [];
  const windowOf = (days: number) => {
    const start = Date.now() - days * DAY;
    let deposits = 0;
    let redeems = 0;
    for (const row of rows) {
      if (new Date(String(row.created_at)).getTime() < start) continue;
      const amount = Number(row.amount || 0);
      if (row.source === "deposit") deposits += amount;
      if (row.source === "game_redeem") redeems += amount;
    }
    return { deposits, redeems };
  };

  return { days7: windowOf(7), days30: windowOf(30), days90: windowOf(90) };
}
