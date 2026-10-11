import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { moneyLabel, TRANSACTION_STATUSES, type TransactionKind } from "@/lib/admin/player-transactions";
import { loadPlayerTransactions } from "@/lib/admin/player-transactions-data";
import { requireAgentScope } from "@/lib/agents/scope";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Player transactions" };

export default async function PlayerTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; status?: string; from?: string; to?: string; store?: string }>;
}) {
  const scope = await requireAgentScope();
  const params = await searchParams;
  const loaded = await loadPlayerTransactions(scope, params);
  const { query, rows, total, stores } = loaded;
  const exportHref = `/admin/player-transactions/export?${queryString(query)}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        title="Player transactions"
        description={
          scope.level === "sub"
            ? "Recharge and redeem records for your players."
            : scope.level === "store"
              ? "Recharge and redeem records for your players and your sub-creators' players."
              : "Recharge and redeem records for every player. Filter by store to see one creator's players."
        }
        action={
          <Button variant="outline" asChild>
            <a href={exportHref}>Export</a>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <TabLink kind="recharge" current={query.kind} query={query} label="Recharge Records" />
        <TabLink kind="redeem" current={query.kind} query={query} label="Redeem Records" />
      </div>

      <GlassCard className="px-6 py-4">
        <p className="text-sm text-muted-foreground">{query.kind === "recharge" ? "Credit spent" : "Redeemed"}</p>
        <p className="text-2xl font-bold">{moneyLabel(total)}</p>
      </GlassCard>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value={query.kind} />
        <label className="grid gap-1 text-xs text-muted-foreground">
          Name or email
          <Input name="q" defaultValue={query.q} placeholder="Search" className="w-48" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Status
          <select name="status" defaultValue={query.status} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm">
            {TRANSACTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All" : status}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          From
          <Input type="date" name="from" defaultValue={query.from ?? ""} className="w-40" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          To
          <Input type="date" name="to" defaultValue={query.to ?? ""} className="w-40" />
        </label>
        {scope.level === "platform" ? (
          <label className="grid gap-1 text-xs text-muted-foreground">
            Store
            <select name="store" defaultValue={query.storeId ?? ""} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm">
              <option value="">All stores</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Button type="submit">Filter</Button>
      </form>

      <GlassCard className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Game</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              {query.kind === "recharge" ? (
                <>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Credit spent</TableHead>
                </>
              ) : (
                <TableHead className="text-right">Amount</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={query.kind === "recharge" ? 6 : 5} className="text-muted-foreground">
                  No {query.kind === "recharge" ? "recharge" : "redeem"} records.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <p className="font-medium">{row.playerName}</p>
                    {row.email ? <p className="text-xs text-muted-foreground">{row.email}</p> : null}
                  </TableCell>
                  <TableCell>{row.game}</TableCell>
                  <TableCell>{formatDate(row.createdAt)}</TableCell>
                  <TableCell className="capitalize">{row.status}</TableCell>
                  {query.kind === "recharge" ? (
                    <>
                      <TableCell className="text-right">{moneyLabel(row.collected)}</TableCell>
                      <TableCell className="text-right">{moneyLabel(row.creditSpent)}</TableCell>
                    </>
                  ) : (
                    <TableCell className="text-right">{moneyLabel(row.redeemAmount)}</TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </GlassCard>
    </div>
  );
}

function TabLink({
  kind,
  current,
  query,
  label,
}: {
  kind: TransactionKind;
  current: TransactionKind;
  query: { q: string; status: string; from: string | null; to: string | null; storeId: string | null };
  label: string;
}) {
  const params = new URLSearchParams(queryString({ ...query, kind }));
  return (
    <Link
      href={`/admin/player-transactions?${params}`}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-sm",
        current === kind ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
      )}
    >
      {label}
    </Link>
  );
}

function queryString(query: {
  kind: TransactionKind;
  q: string;
  status: string;
  from: string | null;
  to: string | null;
  storeId: string | null;
}) {
  const params = new URLSearchParams();
  params.set("tab", query.kind);
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.storeId) params.set("store", query.storeId);
  return params.toString();
}
