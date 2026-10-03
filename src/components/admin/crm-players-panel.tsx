"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

import { fetchCrmPlayersAction } from "@/lib/actions/admin/crm";
import {
  profileDisplayName,
  profileHandle,
  profileIsBanned,
  profileNum,
} from "@/lib/admin/spinora-profile";
import type { CrmPlayersPage, CrmSegment } from "@/lib/data/admin-crm";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const SEGMENTS: { key: CrmSegment; label: string }[] = [
  { key: "all", label: "All Players" },
  { key: "new", label: "New (7d)" },
  { key: "active", label: "Active (7d)" },
  { key: "vip", label: "VIP" },
  { key: "banned", label: "Banned" },
];

function syncUrl(segment: CrmSegment, page: number) {
  const url = `/admin/crm?segment=${segment}&page=${page}`;
  window.history.replaceState(null, "", url);
}

export function CrmPlayersPanel({
  initialSegment,
  initialPage,
  initialData,
}: {
  initialSegment: CrmSegment;
  initialPage: number;
  initialData: CrmPlayersPage;
}) {
  const [segment, setSegment] = useState(initialSegment);
  const [page, setPage] = useState(initialPage);
  const [data, setData] = useState(initialData);
  const [pending, startTransition] = useTransition();

  const load = useCallback((nextSegment: CrmSegment, nextPage: number) => {
    startTransition(async () => {
      const result = await fetchCrmPlayersAction({ segment: nextSegment, page: nextPage });
      if (!result.ok) return;
      setSegment(nextSegment);
      setPage(nextPage);
      setData(result.data);
      syncUrl(nextSegment, nextPage);
    });
  }, []);

  function changeSegment(key: CrmSegment) {
    if (key === segment && page === 1) return;
    load(key, 1);
  }

  function changePage(nextPage: number) {
    if (nextPage === page) return;
    load(segment, nextPage);
  }

  return (
    <>
      <div
        role="tablist"
        aria-label="Player segments"
        className="glass mb-4 inline-flex flex-wrap gap-1 rounded-full p-1"
      >
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={s.key === segment}
            disabled={pending}
            onClick={() => changeSegment(s.key)}
            className={cn(
              "min-h-9 rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-70",
              s.key === segment
                ? "bg-emerald-500 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
        {pending ? (
          <span className="flex items-center px-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
          </span>
        ) : null}
      </div>

      <GlassCard className={cn("overflow-hidden p-0 transition-opacity", pending && "opacity-60")}>
        {/* Mobile cards */}
        <div className="divide-y divide-foreground/8 md:hidden">
          {data.rows.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">No players in this segment.</p>
          ) : (
            data.rows.map(({ profile: p, vip, deposits: stats }) => (
              <div key={p.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {profileDisplayName(p)}
                      {profileIsBanned(p) && (
                        <Badge className="ml-2 bg-ws-danger/20 text-ws-danger text-xs">
                          Suspended
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{profileHandle(p)}</p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <Link href={`/admin/users/${p.id}`}>View</Link>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-foreground/8 text-xs">Lv {profileNum(p.level, 1)}</Badge>
                  {vip && (
                    <Badge
                      className="text-xs"
                      style={{ backgroundColor: `${vip.color}22`, color: vip.color }}
                    >
                      {vip.name}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Coins</p>
                    <p className="tnum font-medium">{profileNum(p.coins_balance).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Deposits</p>
                    {stats && stats.fulfilledCount > 0 ? (
                      <p className="tnum font-medium text-ws-emerald">
                        ${stats.totalDeposited.toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">—</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground truncate">{p.email || "No email"}</p>
                <p className="text-xs text-ws-text-faint">
                  Last seen{" "}
                  {p.last_seen_at
                    ? formatDistanceToNow(new Date(p.last_seen_at), { addSuffix: true })
                    : "never"}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-foreground/8 hover:bg-transparent">
              <TableHead>Player</TableHead>
              <TableHead>Level / VIP</TableHead>
              <TableHead className="text-right">Coins</TableHead>
              <TableHead className="text-right">Deposits</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No players in this segment.
                </TableCell>
              </TableRow>
            ) : (
              data.rows.map(({ profile: p, vip, deposits: stats }) => (
                <TableRow key={p.id} className="border-foreground/8">
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {profileDisplayName(p)}
                        {profileIsBanned(p) && (
                          <Badge className="ml-2 bg-ws-danger/20 text-ws-danger text-xs">
                            Suspended
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{profileHandle(p)}</p>
                      <p className="text-xs text-ws-text-faint">
                        Joined{" "}
                        {p.created_at
                          ? formatDistanceToNow(new Date(p.created_at), { addSuffix: true })
                          : "—"}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge className="w-fit bg-foreground/8 text-xs">
                        Lv {profileNum(p.level, 1)}
                      </Badge>
                      {vip && (
                        <Badge
                          className="w-fit text-xs"
                          style={{
                            backgroundColor: `${vip.color}22`,
                            color: vip.color,
                          }}
                        >
                          {vip.name}
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-right tnum font-medium">
                    {profileNum(p.coins_balance).toLocaleString()}
                  </TableCell>

                  <TableCell className="text-right">
                    {stats && stats.fulfilledCount > 0 ? (
                      <div>
                        <p className="tnum font-medium text-ws-emerald">
                          ${stats.totalDeposited.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {stats.fulfilledCount}{" "}
                          {stats.fulfilledCount === 1 ? "deposit" : "deposits"}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {p.email ? (
                      <span className="max-w-[140px] truncate text-xs text-muted-foreground">
                        {p.email}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {p.last_seen_at
                      ? formatDistanceToNow(new Date(p.last_seen_at), { addSuffix: true })
                      : "Never"}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/users/${p.id}`}>View Profile</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </GlassCard>

      {data.totalPages > 1 && (
        <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            Page {data.page} of {data.totalPages} &middot; {data.total.toLocaleString()} players
          </p>
          <div className="flex gap-2">
            {data.page > 1 && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => changePage(data.page - 1)}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Prev
              </Button>
            )}
            {data.page < data.totalPages && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => changePage(data.page + 1)}
              >
                Next
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
