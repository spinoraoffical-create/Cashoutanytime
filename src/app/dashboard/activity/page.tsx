import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/data/dashboard";
import { cn } from "@/lib/utils";
import {
  formatTransactionAmount,
  transactionSummary,
  type WalletTransactionRow,
} from "@/lib/wallet/transaction-display";
import { ActivityCsvButton, ActivityRangeSelect } from "@/components/player/activity-tools";
import { ClaimVerifyBanner } from "@/components/player/claim-verify-banner";
import { MotionPage } from "@/components/player/motion-page";
import { getProfile } from "@/lib/supabase/session";

export const metadata: Metadata = { title: "Activity | Sweepstakes Hub" };

type Filter = "all" | "deposits" | "cashouts" | "bonuses" | "games";

function bucket(tx: WalletTransactionRow): Filter {
  if (tx.source === "game_load" || tx.source === "game_load_refund") return "games";
  if (tx.source === "deposit") return "deposits";
  if (tx.source === "game_redeem" || tx.wallet_type === "cashout") return "cashouts";
  if (
    tx.wallet_type === "bonus" ||
    tx.wallet_type === "bonus_redeem" ||
    tx.source === "spin" ||
    tx.source === "daily_task"
  ) {
    return "bonuses";
  }
  return "all";
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "deposits", label: "Deposits" },
  { id: "cashouts", label: "Cashouts" },
  { id: "bonuses", label: "Bonuses" },
  { id: "games", label: "Games" },
];

const RANGES = new Set(["7", "30", "90"]);

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; range?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const filter = (FILTERS.some((f) => f.id === params.filter) ? params.filter : "all") as Filter;
  const range = RANGES.has(params.range ?? "") ? params.range! : "all";
  const profile = await getProfile();
  const row = profile as (typeof profile & { kyc_status?: string | null }) | null;
  const kyc = row?.kyc_status;
  const needsVerify = Boolean(row && (!row.phone || (kyc && kyc !== "verified" && kyc !== "approved")));

  const { data } = await supabase
    .from("wallet_transactions")
    .select("id, amount, wallet_type, transaction_type, source, description, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(80);

  const rows = (data ?? []) as WalletTransactionRow[];
  const cutoff =
    range === "all" ? 0 : Date.now() - Number(range) * 24 * 60 * 60 * 1000;
  const ranged = cutoff ? rows.filter((tx) => new Date(tx.created_at).getTime() >= cutoff) : rows;
  const items = filter === "all" ? ranged : ranged.filter((tx) => bucket(tx) === filter);
  const filterHref = (id: Filter) => {
    const params = new URLSearchParams();
    if (id !== "all") params.set("filter", id);
    if (range !== "all") params.set("range", range);
    const query = params.toString();
    return query ? `/dashboard/activity?${query}` : "/dashboard/activity";
  };

  return (
    <MotionPage className="space-y-5">
      {needsVerify ? (
        <ClaimVerifyBanner
          href="/dashboard/kyc"
          title="Get $5 free play — just verify your email & phone"
          body="No deposit needed. Verify your email and phone number to unlock free play. New players — tap to see the details and claim."
        />
      ) : null}

      <div>
        <h1 className="text-3xl font-extrabold">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deposits, cash outs, game transfers, and rewards in one history.
        </p>
      </div>

      <section className="overflow-hidden rounded-[24px] bg-gradient-to-r from-[#241433] to-[#4a2048] p-5">
        <h2 className="max-w-[220px] text-2xl font-extrabold leading-tight">Every move, easy to follow.</h2>
        <p className="mt-2 max-w-[240px] text-sm text-zinc-300">
          The live record below remains the source of truth.
        </p>
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">History</p>
        <div className="flex items-center gap-2">
          <ActivityCsvButton rows={items} />
          <ActivityRangeSelect range={range} filter={filter} />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={filterHref(f.id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap uppercase",
              filter === f.id ? "bg-white text-zinc-950" : "bg-white/8 text-zinc-300"
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="hub-card flex flex-col items-center gap-2 rounded-[24px] py-14 text-center">
          <History className="h-10 w-10 text-foreground/15" />
          <p className="font-semibold">No transactions yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Add money or load a Game Room — receipts show up here.
          </p>
          <Button asChild className="mt-2 rounded-full">
            <Link href="/dashboard/deposit">Add money</Link>
          </Button>
        </div>
      ) : (
        <ul className="hub-card divide-y divide-white/5 rounded-[24px] px-4">
          {items.map((tx) => {
            const credit = tx.transaction_type !== "debit";
            return (
              <li key={tx.id} className="flex items-center gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{transactionSummary(tx)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <p className={cn("tnum text-sm font-bold", credit && "text-emerald-400")}>
                  {formatTransactionAmount(tx.amount, tx.transaction_type)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </MotionPage>
  );
}
