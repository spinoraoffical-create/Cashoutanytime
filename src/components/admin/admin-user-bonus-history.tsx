"use client";

import { useState } from "react";
import { getAdminUserBonusActivity } from "@/lib/actions/wallet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import {
  formatTransactionAmount,
  gameLoadSummary,
  transactionSummary,
  type BonusGameLoadRow,
  type WalletTransactionRow,
} from "@/lib/wallet/transaction-display";
import { ChevronDown, ChevronUp, History, Loader2 } from "lucide-react";

interface AdminUserBonusHistoryProps {
  userId: string;
  userName: string;
}

type TimelineItem =
  | { kind: "tx"; at: string; data: WalletTransactionRow }
  | { kind: "load"; at: string; data: BonusGameLoadRow };

const loadStatusVariant: Record<string, "default" | "warning" | "success" | "destructive"> = {
  pending: "warning",
  processing: "default",
  completed: "success",
  failed: "destructive",
  cancelled: "destructive",
};

function buildTimeline(
  transactions: WalletTransactionRow[],
  gameLoads: BonusGameLoadRow[]
): TimelineItem[] {
  const items: TimelineItem[] = [
    ...transactions.map((data) => ({
      kind: "tx" as const,
      at: data.created_at,
      data,
    })),
    ...gameLoads.map((data) => ({
      kind: "load" as const,
      at: data.created_at,
      data,
    })),
  ];

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function AdminUserBonusHistory({ userId, userName }: AdminUserBonusHistoryProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[] | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }

    setOpen(true);
    if (timeline !== null) return;

    setLoading(true);
    setError(null);
    const result = await getAdminUserBonusActivity(userId);
    setLoading(false);

    if ("error" in result) {
      setError(result.error ?? "Could not load history");
      return;
    }

    setTimeline(
      buildTimeline(
        result.transactions as WalletTransactionRow[],
        (result.gameLoads as BonusGameLoadRow[]).filter(
          (load) => load.load_type !== "load" || load.status !== "completed"
        )
      )
    );
  }

  return (
    <div className="w-full">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5 h-8 px-2 text-muted-foreground hover:text-foreground"
        onClick={() => void toggle()}
      >
        <History className="h-4 w-4" />
        Bonus wallet history
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </Button>

      {open && (
        <div className="mt-2 rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Bonus wallet loads, redeems, refunds, and credits for {userName}
          </p>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {!loading && !error && timeline?.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No bonus wallet activity yet.</p>
          )}

          {!loading && !error && timeline && timeline.length > 0 && (
            <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {timeline.map((item) => {
                if (item.kind === "tx") {
                  const tx = item.data;
                  const isDebit = tx.transaction_type === "debit";
                  return (
                    <li
                      key={`tx-${tx.id}`}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm border-b border-border/60 pb-2 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{transactionSummary(tx)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(tx.created_at)} · {formatRelativeTime(tx.created_at)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 font-semibold tabular-nums ${
                          isDebit ? "text-amber-400" : "text-emerald-400"
                        }`}
                      >
                        {formatTransactionAmount(Number(tx.amount), tx.transaction_type as WalletTransactionRow["transaction_type"])}
                      </span>
                    </li>
                  );
                }

                const load = item.data;
                return (
                  <li
                    key={`load-${load.id}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm border-b border-border/60 pb-2 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-medium">{gameLoadSummary(load)}</p>
                        <Badge variant={loadStatusVariant[load.status] ?? "secondary"} className="text-[10px] px-1.5 py-0">
                          {load.status}
                        </Badge>
                      </div>
                      {load.game_username && (
                        <p className="text-xs text-muted-foreground truncate">Game user: {load.game_username}</p>
                      )}
                      {load.error_message && load.status === "failed" && (
                        <p className="text-xs text-destructive truncate">{load.error_message}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(load.created_at)} · {formatRelativeTime(load.created_at)}
                      </p>
                    </div>
                    {load.load_type === "load" && Number(load.amount) > 0 && (
                      <span className="shrink-0 font-semibold tabular-nums text-amber-400">
                        −${Number(load.amount).toFixed(2)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
