import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatCard } from "@/components/admin/ui/admin-stat-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
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
import { formatNepalTime } from "@/lib/admin/nepal-time";
import { coinLabel, moneyLabel, signedMoneyLabel, TRANSACTION_STATUSES, type TransactionKind } from "@/lib/admin/player-transactions";
import { loadDailyPlayerReport, loadPlayerTransactions } from "@/lib/admin/player-transactions-data";
import { requireAgentScope } from "@/lib/agents/scope";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Player transactions" };

export default async function PlayerTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; status?: string; from?: string; to?: string; store?: string; day?: string }>;
}) {
  const scope = await requireAgentScope();
  const params = await searchParams;
  if (params.tab === "report") {
    const report = await loadDailyPlayerReport(scope, params);
    const exportHref = `/admin/player-transactions/export?${reportQueryString(report.query)}`;
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <AdminPageHeader
          title="Player transactions"
          description={scopeDescription(scope.level)}
          action={
            <Button variant="outline" asChild>
              <a href={exportHref}>Export</a>
            </Button>
          }
        />
        <RecordTabs
          current="report"
          query={{ q: "", status: "completed", from: null, to: null, storeId: report.query.storeId }}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <AdminStatCard label="Money received" value={moneyLabel(report.moneyReceived)} hint="Completed deposit money stored for this day." />
          <AdminStatCard label="Cash paid out" value={moneyLabel(report.cashPaidOut)} hint="Cash paid out on stored rows for this day." />
          <AdminStatCard label="Received minus paid out" value={signedMoneyLabel(report.profit)} hint="Money received minus cash paid out for this day. This is not a full profit statement." />
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="tab" value="report" />
          <label className="grid gap-1 text-xs text-muted-foreground">
            Day
            <Input type="date" name="day" defaultValue={report.query.day} className="w-40" />
          </label>
          {scope.level === "platform" ? (
            <label className="grid gap-1 text-xs text-muted-foreground">
              Store
              <select name="store" defaultValue={report.query.storeId ?? ""} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm">
                <option value="">Whole site</option>
                {report.stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Button type="submit">Filter</Button>
        </form>
        <AdminSectionCard title="Coins by game" description="Completed coin activity for the selected day.">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Game</TableHead>
                <TableHead className="text-right">Coins loaded</TableHead>
                <TableHead className="text-right">Coins redeemed</TableHead>
                <TableHead className="text-right">Net coins</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.games.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <AdminEmptyState title="No completed coin activity" body="Completed loads for this day will show here." />
                  </TableCell>
                </TableRow>
              ) : (
                report.games.map((game) => (
                  <TableRow key={game.game}>
                    <TableCell>{game.game}</TableCell>
                    <TableCell className="text-right">{coinLabel(game.coinsLoaded)}</TableCell>
                    <TableCell className="text-right">{coinLabel(game.coinsRedeemed)}</TableCell>
                    <TableCell className="text-right">{coinLabel(game.netCoins)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </AdminSectionCard>
        <AdminSectionCard title="Player rows" description="Completed records for the selected day. Pending rows stay out of this daily view.">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Game</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Money received</TableHead>
                <TableHead className="text-right">Coins loaded</TableHead>
                <TableHead className="text-right">Coins redeemed</TableHead>
                <TableHead className="text-right">Cash paid out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <AdminEmptyState title="No completed records" body="Completed player rows for this day will show here." />
                  </TableCell>
                </TableRow>
              ) : (
                report.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.playerName}</TableCell>
                    <TableCell>{row.game}</TableCell>
                    <TableCell>{formatReportTime(row.createdAt)}</TableCell>
                    <TableCell className="text-right">{moneyLabel(row.moneyReceived)}</TableCell>
                    <TableCell className="text-right">{coinLabel(row.coinsLoaded)}</TableCell>
                    <TableCell className="text-right">{coinLabel(row.coinsRedeemed)}</TableCell>
                    <TableCell className="text-right">{moneyLabel(row.cashPaidOut)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </AdminSectionCard>
      </div>
    );
  }
  const loaded = await loadPlayerTransactions(scope, params);
  const { query, rows, total, stores } = loaded;
  const exportHref = `/admin/player-transactions/export?${queryString(query)}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        title="Player transactions"
        description={scopeDescription(scope.level)}
        action={
          <Button variant="outline" asChild>
            <a href={exportHref}>Export</a>
          </Button>
        }
      />

      <RecordTabs current={query.kind} query={query} />

      <AdminStatCard
        label={query.kind === "recharge" ? "Credit spent" : "Redeemed"}
        value={moneyLabel(total)}
        hint={query.status === "all" ? "Rows in the current search." : `Rows marked ${query.status}. Other statuses stay in their own filter.`}
      />

      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value={query.kind} />
        <label className="grid gap-1 text-xs text-muted-foreground">
          Name or email
          <Input name="q" defaultValue={query.q} placeholder="Search" className="w-48" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Status
          <select name="status" defaultValue={query.status} className="h-9 rounded-md border border-white/10 bg-[#0b1224] px-2 text-sm text-white">
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

      <AdminSectionCard title={query.kind === "recharge" ? "Recharge records" : "Redeem records"} description="Stored rows for the current status filter.">
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
                <TableCell colSpan={query.kind === "recharge" ? 6 : 5}>
                  <AdminEmptyState title="No records in this filter" body={`No ${query.kind === "recharge" ? "recharge" : "redeem"} rows match this search and status.`} />
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
                  <TableCell><AdminStatusBadge status={row.status} /></TableCell>
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
      </AdminSectionCard>
    </div>
  );
}

function scopeDescription(level: "platform" | "store" | "sub") {
  if (level === "sub") return "Recharge and redeem records for your players. Each status filter stays separate.";
  if (level === "store") return "Recharge and redeem records for your players and your sub-creators' players. Each status filter stays separate.";
  return "Recharge and redeem records for every player. Filter by store or status. The daily received-minus-paid-out figure is not a full profit statement.";
}

function formatReportTime(iso: string) {
  return formatNepalTime(iso);
}

function reportQueryString(query: { day: string; storeId: string | null }) {
  const params = new URLSearchParams();
  params.set("tab", "report");
  params.set("day", query.day);
  if (query.storeId) params.set("store", query.storeId);
  return params.toString();
}

function RecordTabs({
  current,
  query,
}: {
  current: TransactionKind | "report";
  query: { q: string; status: string; from: string | null; to: string | null; storeId: string | null };
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <TabLink kind="recharge" current={current} query={query} label="Recharge Records" />
      <TabLink kind="redeem" current={current} query={query} label="Redeem Records" />
      <Link
        href={`/admin/player-transactions?tab=report${query.storeId ? `&store=${encodeURIComponent(query.storeId)}` : ""}`}
        className={cn(
          "inline-flex min-h-9 items-center rounded-full border px-4 py-1.5 text-sm font-semibold",
          current === "report" ? "border-transparent bg-gradient-to-r from-[#6d28d9] to-[#2563eb] text-white" : "border-white/10 text-[#9fb0d0]"
        )}
      >
        Daily report
      </Link>
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
  current: TransactionKind | "report";
  query: { q: string; status: string; from: string | null; to: string | null; storeId: string | null };
  label: string;
}) {
  const params = new URLSearchParams(queryString({ ...query, kind }));
  return (
    <Link
      href={`/admin/player-transactions?${params}`}
      className={cn(
        "inline-flex min-h-9 items-center rounded-full border px-4 py-1.5 text-sm font-semibold",
        current === kind ? "border-transparent bg-gradient-to-r from-[#6d28d9] to-[#2563eb] text-white" : "border-white/10 text-[#9fb0d0]"
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
