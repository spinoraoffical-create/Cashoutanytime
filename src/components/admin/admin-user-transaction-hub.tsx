"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AdminTransactionRow } from "@/lib/actions/wallet";
import {
  getAdminUserTransactions,
  searchAdminTransactionUsers,
  type AdminTransactionUser,
} from "@/lib/actions/wallet";
import {
  formatTransactionAmount,
  transactionSourceLabel,
  transactionSummary,
  categorizeAdminTransactionPanel,
  walletColumnSummaryStats,
  type WalletTransactionRow,
} from "@/lib/wallet/transaction-display";
import { formatDate, formatRelativeTime, cn } from "@/lib/utils";
import { Search, Radio, User, X, Wallet, Loader2 } from "lucide-react";

export type { AdminTransactionUser };

interface AdminUserTransactionHubProps {
  users?: AdminTransactionUser[];
  transactions?: AdminTransactionRow[];
  live?: boolean;
  /** Load users and transactions on demand — much faster initial page load. */
  lazy?: boolean;
}

function TransactionEntry({ row, compact }: { row: AdminTransactionRow; compact?: boolean }) {
  const tx = row as WalletTransactionRow;
  const isDebit = row.transaction_type === "debit";

  return (
    <div className="border-b border-border/60 py-3 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <Badge variant="outline" className="text-[10px]">
              {transactionSourceLabel(row.source)}
            </Badge>
            <Badge variant={isDebit ? "warning" : "success"} className="text-[10px]">
              {isDebit ? "Debit" : "Credit"}
            </Badge>
          </div>
          <p className={cn("text-sm", compact ? "line-clamp-2" : "")}>{transactionSummary(tx)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDate(row.created_at)} · {formatRelativeTime(row.created_at)}
          </p>
        </div>
        <span
          className={cn(
            "font-bold tabular-nums shrink-0 text-base",
            isDebit ? "text-amber-400" : "text-emerald-400"
          )}
        >
          {formatTransactionAmount(Number(row.amount), tx.transaction_type)}
        </span>
      </div>
    </div>
  );
}

function WalletColumn({
  title,
  icon: Icon,
  transactions,
  emptyHint,
}: {
  title: string;
  icon: typeof Wallet;
  transactions: AdminTransactionRow[];
  emptyHint: string;
}) {
  const { loadsOut, creditsIn, redeemedBack, loadRefunds } =
    walletColumnSummaryStats(transactions);

  return (
    <Card className="flex flex-col min-h-[320px]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
          <span>{transactions.length} transaction{transactions.length === 1 ? "" : "s"}</span>
          {loadsOut > 0 && <span className="text-amber-400">Loads out: −${loadsOut.toFixed(2)}</span>}
          {creditsIn > 0 && (
            <span className="text-emerald-400">Credits in: +${creditsIn.toFixed(2)}</span>
          )}
          {loadRefunds > 0 && (
            <span className="text-muted-foreground">Load refunds: +${loadRefunds.toFixed(2)}</span>
          )}
          {redeemedBack > 0 && (
            <span className="text-sky-400">Redeemed back: +${redeemedBack.toFixed(2)}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto max-h-[520px] pt-0">
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{emptyHint}</p>
        ) : (
          transactions.map((row) => <TransactionEntry key={row.id} row={row} compact />)
        )}
      </CardContent>
    </Card>
  );
}

export function AdminUserTransactionHub({
  users: initialUsers = [],
  transactions: initialTransactions = [],
  live,
  lazy = false,
}: AdminUserTransactionHubProps) {
  const [userQuery, setUserQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminTransactionUser[]>(initialUsers);
  const [transactions, setTransactions] = useState<AdminTransactionRow[]>(initialTransactions);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchPending, startSearch] = useTransition();
  const [txPending, startTxLoad] = useTransition();

  useEffect(() => {
    if (!lazy) return;
    const timer = window.setTimeout(() => setDebouncedQuery(userQuery), 300);
    return () => window.clearTimeout(timer);
  }, [lazy, userQuery]);

  useEffect(() => {
    if (!lazy) return;
    startSearch(async () => {
      const result = await searchAdminTransactionUsers(debouncedQuery, 12);
      if ("users" in result) setUsers(result.users);
    });
  }, [lazy, debouncedQuery]);

  useEffect(() => {
    if (!lazy || !selectedUserId) return;
    startTxLoad(async () => {
      const result = await getAdminUserTransactions(selectedUserId);
      if ("transactions" in result) setTransactions(result.transactions);
    });
  }, [lazy, selectedUserId]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  useEffect(() => {
    if (!live || !selectedUserId) return;

    const supabase = createClient();
    if (!supabase) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;

      channel = supabase
        .channel(`admin-wallet-tx-user-${selectedUserId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "wallet_transactions",
            filter: `user_id=eq.${selectedUserId}`,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            const entry: AdminTransactionRow = {
              id: String(row.id),
              amount: Number(row.amount),
              wallet_type: String(row.wallet_type),
              transaction_type: String(row.transaction_type),
              source: String(row.source),
              description: (row.description as string | null) ?? null,
              created_at: String(row.created_at),
              user: selectedUser
                ? {
                    id: selectedUser.id,
                    full_name: selectedUser.full_name,
                    email: selectedUser.email,
                  }
                : null,
            };

            setTransactions((prev) => {
              if (prev.some((t) => t.id === entry.id)) return prev;
              return [entry, ...prev];
            });
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [live, selectedUserId, selectedUser]);

  const matchingUsers = useMemo(() => {
    if (lazy) return users;
    const q = userQuery.trim().toLowerCase();
    if (!q) return users.slice(0, 12);
    return users
      .filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [users, userQuery, lazy]);

  const userTransactions = useMemo(() => {
    if (!selectedUserId) return { deposit: [], bonus: [] };
    const mine = transactions.filter((t) => t.user?.id === selectedUserId);
    return {
      deposit: mine.filter((t) => categorizeAdminTransactionPanel(t) === "deposit"),
      bonus: mine.filter((t) => categorizeAdminTransactionPanel(t) === "bonus"),
    };
  }, [transactions, selectedUserId]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="relative max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Search user by name or email…"
            className="pl-9"
          />
          {(searchPending || txPending) && (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {!selectedUser && (
          <div className="flex flex-wrap gap-2">
            {matchingUsers.map((u) => (
              <Button
                key={u.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto py-2 px-3 text-left flex-col items-start gap-0.5"
                onClick={() => {
                  setSelectedUserId(u.id);
                  setUserQuery(u.full_name || u.email);
                  if (!lazy) return;
                  setTransactions([]);
                }}
              >
                <span className="font-medium">{u.full_name || "Unnamed"}</span>
                <span className="text-xs text-muted-foreground font-normal">{u.email}</span>
              </Button>
            ))}
            {matchingUsers.length === 0 && userQuery.trim() && (
              <p className="text-sm text-muted-foreground">No users match that search.</p>
            )}
          </div>
        )}
      </div>

      {selectedUser ? (
        <>
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-lg truncate">
                    {selectedUser.full_name || "Unnamed user"}
                  </h2>
                  <p className="text-sm text-muted-foreground truncate">{selectedUser.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {live && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                    <Radio className="h-3 w-3 animate-pulse" />
                    Live
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedUserId(null);
                    setUserQuery("");
                    if (lazy) setTransactions([]);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Change user
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground font-medium">Total Deposit</strong> — game loads and
            redeems from the deposit wallet.
          </p>

          <WalletColumn
            title="Total Deposit"
            icon={Wallet}
            transactions={userTransactions.deposit}
            emptyHint="No deposit-wallet loads or redeems yet for this user."
          />
        </>
      ) : (
        <Card className="p-10 text-center">
          <User className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="font-medium">Select a user above</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            One user at a time — see their Total Deposit transaction history.
          </p>
        </Card>
      )}
    </div>
  );
}
