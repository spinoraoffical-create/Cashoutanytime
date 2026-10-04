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

export const metadata: Metadata = { title: "Activity | Sweepstakes Hub" };

type Filter = "all" | "deposits" | "cashouts" | "bonuses";

function bucket(tx: WalletTransactionRow): Filter {
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
  { id: "all", label: "ALL" },
  { id: "deposits", label: "DEPOSITS" },
  { id: "cashouts", label: "CASHOUTS" },
  { id: "bonuses", label: "BONUSES" },
];

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const filter = (FILTERS.some((f) => f.id === params.filter) ? params.filter : "all") as Filter;

  const { data } = await supabase
    .from("wallet_transactions")
    .select("id, amount, wallet_type, transaction_type, source, description, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(80);

  const rows = (data ?? []) as WalletTransactionRow[];
  const items = filter === "all" ? rows : rows.filter((tx) => bucket(tx) === filter);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deposits, cash outs, game transfers, and rewards in one history.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={f.id === "all" ? "/dashboard/activity" : `/dashboard/activity?filter=${f.id}`}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap",
              filter === f.id ? "bg-primary text-white" : "bg-white/8 text-muted-foreground"
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
    </div>
  );
}
