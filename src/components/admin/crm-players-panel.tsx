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
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
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
        className="mb-4 inline-flex flex-wrap gap-2"
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
              "min-h-9 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-70",
              s.key === segment
                ? "border-transparent bg-gradient-to-r from-[#6d28d9] to-[#2563eb] text-white"
                : "border-white/10 text-[#9fb0d0] hover:text-white"
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

      <AdminSectionCard
        title="Players in this filter"
        description="Open a profile to see details. This list does not change a balance."
        className={cn("transition-opacity", pending && "opacity-60")}
      >
        <div className="divide-y divide-white/10 md:hidden">
          {data.rows.length === 0 ? (
            <AdminEmptyState title="No players in this filter" body="Try All players, or check back after new accounts join." />
          ) : (
            data.rows.map(({ profile: p, vip, deposits: stats }) => (
              <div key={p.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {profileDisplayName(p)}
                      {profileIsBanned(p) && (
                        <span className="ml-2"><AdminStatusBadge status="Suspended" /></span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{profileHandle(p)}</p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0 border-white/15 bg-transparent text-white">
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
                    <p className="text-xs text-[#8ea0c3]">Coins</p>
                    <p className="font-medium tabular-nums text-white">{profileNum(p.coins_balance).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8ea0c3]">Fulfilled deposits</p>
                    {stats && stats.fulfilledCount > 0 ? (
                      <p className="font-medium tabular-nums text-emerald-200">
                        ${stats.totalDeposited.toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-[#9fb0d0]">—</p>
                    )}
                  </div>
                </div>
                <p className="truncate text-xs text-[#9fb0d0]">{p.email || "No email"}</p>
                <p className="text-xs text-[#8ea0c3]">
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
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-[#8ea0c3]">Player</TableHead>
              <TableHead className="text-[#8ea0c3]">Level / VIP</TableHead>
              <TableHead className="text-right text-[#8ea0c3]">Coins</TableHead>
              <TableHead className="text-right text-[#8ea0c3]">Fulfilled deposits</TableHead>
              <TableHead className="text-[#8ea0c3]">Contact</TableHead>
              <TableHead className="text-[#8ea0c3]">Last seen</TableHead>
              <TableHead className="text-right text-[#8ea0c3]">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-4">
                  <AdminEmptyState title="No players in this filter" body="Try All players, or check back after new accounts join." />
                </TableCell>
              </TableRow>
            ) : (
              data.rows.map(({ profile: p, vip, deposits: stats }) => (
                <TableRow key={p.id} className="border-white/10">
                  <TableCell>
                    <div>
                      <p className="font-medium text-white">
                        {profileDisplayName(p)}
                        {profileIsBanned(p) && (
                          <span className="ml-2"><AdminStatusBadge status="Suspended" /></span>
                        )}
                      </p>
                      <p className="text-xs text-[#9fb0d0]">{profileHandle(p)}</p>
                      <p className="text-xs text-[#8ea0c3]">
                        Joined{" "}
                        {p.created_at
                          ? formatDistanceToNow(new Date(p.created_at), { addSuffix: true })
                          : "—"}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <AdminStatusBadge status={`Level ${profileNum(p.level, 1)}`} />
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

                  <TableCell className="text-right font-medium tabular-nums text-white">
                    {profileNum(p.coins_balance).toLocaleString()}
                  </TableCell>

                  <TableCell className="text-right">
                    {stats && stats.fulfilledCount > 0 ? (
                      <div>
                        <p className="font-medium tabular-nums text-emerald-200">
                          ${stats.totalDeposited.toLocaleString()}
                        </p>
                        <p className="text-xs text-[#9fb0d0]">
                          {stats.fulfilledCount}{" "}
                          {stats.fulfilledCount === 1 ? "deposit" : "deposits"}
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-[#9fb0d0]">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {p.email ? (
                      <span className="max-w-[140px] truncate text-xs text-[#9fb0d0]">
                        {p.email}
                      </span>
                    ) : (
                      <span className="text-sm text-[#9fb0d0]">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-sm text-[#9fb0d0]">
                    {p.last_seen_at
                      ? formatDistanceToNow(new Date(p.last_seen_at), { addSuffix: true })
                      : "Never"}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm" className="border-white/15 bg-transparent text-white">
                      <Link href={`/admin/users/${p.id}`}>Open profile</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </AdminSectionCard>

      {data.totalPages > 1 && (
        <div className="mt-4 flex flex-col gap-3 text-sm text-[#9fb0d0] sm:flex-row sm:items-center sm:justify-between">
          <p>
            Page {data.page} of {data.totalPages} &middot; {data.total.toLocaleString()} players
          </p>
          <div className="flex gap-2">
            {data.page > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="border-white/15 bg-transparent text-white"
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
                className="border-white/15 bg-transparent text-white"
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
