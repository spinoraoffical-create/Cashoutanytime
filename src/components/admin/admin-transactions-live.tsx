"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminTransactionRow } from "@/lib/actions/wallet";
import {
  AdminUserTransactionHub,
  type AdminTransactionUser,
} from "@/components/admin/admin-user-transaction-hub";

interface AdminTransactionsLiveProps {
  users?: AdminTransactionUser[];
  initialTransactions?: AdminTransactionRow[];
  /** Skip heavy upfront fetch — search users and load txs on demand. */
  lazy?: boolean;
}

export function AdminTransactionsLive({
  users = [],
  initialTransactions = [],
  lazy = false,
}: AdminTransactionsLiveProps) {
  if (lazy) {
    return <AdminUserTransactionHub lazy live />;
  }

  return (
    <AdminTransactionsLiveEager users={users} initialTransactions={initialTransactions} />
  );
}

function AdminTransactionsLiveEager({
  users,
  initialTransactions,
}: {
  users: AdminTransactionUser[];
  initialTransactions: AdminTransactionRow[];
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [live, setLive] = useState(false);

  useEffect(() => {
    setTransactions(initialTransactions);
  }, [initialTransactions]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;

      channel = supabase
        .channel("admin-wallet-transactions-live")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "wallet_transactions" },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            const userId = String(row.user_id ?? "");

            void (async () => {
              let user: AdminTransactionRow["user"] = null;
              if (userId) {
                const { data: profile } = await supabase
                  .from("profiles")
                  .select("id, full_name, email")
                  .eq("id", userId)
                  .maybeSingle();
                user = profile ?? null;
              }

              const entry: AdminTransactionRow = {
                id: String(row.id),
                amount: Number(row.amount),
                wallet_type: String(row.wallet_type),
                transaction_type: String(row.transaction_type),
                source: String(row.source),
                description: (row.description as string | null) ?? null,
                created_at: String(row.created_at),
                user,
              };

              setTransactions((prev) => {
                if (prev.some((t) => t.id === entry.id)) return prev;
                return [entry, ...prev];
              });
            })();
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") setLive(true);
        });
    });

    return () => {
      cancelled = true;
      setLive(false);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <AdminUserTransactionHub users={users} transactions={transactions} live={live} />
  );
}
