"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Radio } from "lucide-react";

import { AdminWalletLoadsSidebarPanel } from "@/components/admin/admin-wallet-loads-sidebar-panel";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";
import { gameLoadStatusHelp } from "@/lib/admin/game-load-status";
import type { GameLoadRequest } from "@/lib/game-automation/types";

export interface AdminGameLoadRow extends GameLoadRequest {
  user?: { full_name?: string | null; email?: string } | null;
}

export interface AdminGameLoadUser {
  id: string;
  full_name: string | null;
  email: string;
  wallet_balance?: number | null;
  cashout_wallet?: number | null;
  created_at?: string;
  last_seen_at?: string | null;
}

export type GameLoadView = "attention" | "all" | "completed" | "failed";

export type GameLoadCounts = {
  pending: number | null;
  processing: number | null;
  completed: number | null;
  failed: number | null;
};

interface AdminWalletLoadsPanelsProps {
  loads: AdminGameLoadRow[];
  users: AdminGameLoadUser[];
  counts: GameLoadCounts;
  view: GameLoadView;
  showAllPlayers: boolean;
}

const PAGE_SIZE = 40;

const CARD = "overflow-hidden rounded-2xl border border-white/10 bg-[#10182e]/80";

const VIEW_LINKS: { view: GameLoadView; label: string; href: string }[] = [
  { view: "attention", label: "Needs attention", href: "/admin/game-loads" },
  { view: "all", label: "All loads", href: "/admin/game-loads?view=all" },
  { view: "completed", label: "Completed", href: "/admin/game-loads?view=completed" },
  { view: "failed", label: "Failed", href: "/admin/game-loads?status=failed" },
];

type UserLoadStats = {
  count: number;
  pending: number;
  lastAt: string | null;
  totalLoaded: number;
};

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function playerHref(href: string, showAllPlayers: boolean) {
  if (!showAllPlayers) return href;
  return href.includes("?") ? `${href}&players=all` : `${href}?players=all`;
}

function amountLabel(load: AdminGameLoadRow) {
  if (load.load_type === "redeem" && load.redeem_all) return "Redeem all";
  return `$${Number(load.amount).toFixed(2)}`;
}

export function AdminWalletLoadsPanels({
  loads: initialLoads,
  users,
  counts,
  view,
  showAllPlayers,
}: AdminWalletLoadsPanelsProps) {
  const router = useRouter();
  const [loads, setLoads] = useState(initialLoads);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [visiblePlayers, setVisiblePlayers] = useState(PAGE_SIZE);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    setLoads(initialLoads);
    setVisibleCount(PAGE_SIZE);
  }, [initialLoads]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel("admin-game-loads-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_load_requests" },
        () => {
          router.refresh();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLive(true);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const loadStatsByUser = useMemo(() => {
    const map = new Map<string, UserLoadStats>();
    for (const load of loads) {
      const existing = map.get(load.user_id) ?? { count: 0, pending: 0, lastAt: null, totalLoaded: 0 };
      existing.count += 1;
      if (load.status === "pending" || load.status === "processing") existing.pending += 1;
      if (!existing.lastAt || load.created_at > existing.lastAt) existing.lastAt = load.created_at;
      if (load.status === "completed" && load.load_type !== "redeem") existing.totalLoaded += Number(load.amount);
      map.set(load.user_id, existing);
    }
    return map;
  }, [loads]);

  const needle = query.trim().toLowerCase();
  const viewLoads = useMemo(() => {
    if (view === "attention") return loads.filter((load) => load.status === "pending" || load.status === "processing");
    if (view === "completed") return loads.filter((load) => load.status === "completed");
    if (view === "failed") return loads.filter((load) => load.status === "failed");
    return loads;
  }, [loads, view]);

  const activeUsers = useMemo(() => {
    const byId = new Map(users.map((user) => [user.id, user]));
    const rows: AdminGameLoadUser[] = [];
    const seen = new Set<string>();
    for (const load of viewLoads) {
      if (seen.has(load.user_id)) continue;
      seen.add(load.user_id);
      rows.push(
        byId.get(load.user_id) ?? {
          id: load.user_id,
          full_name: load.user?.full_name ?? null,
          email: load.user?.email ?? "",
        }
      );
    }
    return rows;
  }, [viewLoads, users]);
  const visibleRequests = useMemo(() => {
    if (!needle) return viewLoads;
    return viewLoads.filter((load) => {
      const name = load.user?.full_name?.toLowerCase() ?? "";
      const email = load.user?.email?.toLowerCase() ?? "";
      return name.includes(needle) || email.includes(needle) || load.game_name.toLowerCase().includes(needle);
    });
  }, [viewLoads, needle]);

  const filteredPlayers = useMemo(() => {
    const source = showAllPlayers ? users : activeUsers;
    const list = source.filter((user) => {
      if (!needle) return true;
      return user.full_name?.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle);
    });
    return [...list].sort((a, b) => {
      const aStats = loadStatsByUser.get(a.id);
      const bStats = loadStatsByUser.get(b.id);
      if ((aStats?.pending ?? 0) !== (bStats?.pending ?? 0)) return (bStats?.pending ?? 0) - (aStats?.pending ?? 0);
      const aTime = aStats?.lastAt ?? a.created_at ?? "";
      const bTime = bStats?.lastAt ?? b.created_at ?? "";
      return bTime.localeCompare(aTime);
    });
  }, [showAllPlayers, users, activeUsers, needle, loadStatsByUser]);

  const requestRows = visibleRequests.slice(0, visibleCount);
  const playerRows = filteredPlayers.slice(0, visiblePlayers);
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? activeUsers.find((user) => user.id === selectedUserId) ?? null;
  const selectedUserLoads = useMemo(
    () => (selectedUserId ? loads.filter((load) => load.user_id === selectedUserId) : []),
    [loads, selectedUserId]
  );
  const openCount = (counts.pending ?? 0) + (counts.processing ?? 0);
  const listTruncated =
    (view === "attention" && counts.pending != null && counts.processing != null && viewLoads.length < openCount) ||
    (view === "completed" && counts.completed != null && viewLoads.length < counts.completed) ||
    (view === "failed" && counts.failed != null && viewLoads.length < counts.failed);

  const emptyCopy =
    view === "attention"
      ? "No game loads are pending or processing."
      : view === "completed"
        ? "No completed game loads in this list."
        : view === "failed"
          ? "No failed game loads in this list."
          : "No game loads in this list.";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {VIEW_LINKS.map((item) => (
          <Button
            key={item.view}
            variant="outline"
            size="sm"
            asChild
            className={view === item.view ? "border-transparent bg-gradient-to-r from-[#6d28d9] to-[#2563eb] text-white" : "border-white/15 bg-transparent text-white"}
          >
            <Link href={playerHref(item.href, showAllPlayers)}>{item.label}</Link>
          </Button>
        ))}
        {live ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <Radio className="h-3 w-3 animate-pulse" />
            Live
          </span>
        ) : null}
      </div>

      <div className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#c4b5fd]">
            {view === "attention" ? "Requests that need attention" : view === "all" ? "Game loads" : view === "completed" ? "Completed game loads" : "Failed game loads"}
          </p>
          <p className="text-xs text-[#9fb0d0]">{visibleRequests.length.toLocaleString()} shown</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-[#b7c3e4]">
              <tr>
                <th className="px-4 py-3 font-bold">Player</th>
                <th className="px-4 py-3 font-bold">Game</th>
                <th className="px-4 py-3 text-right font-bold">Amount</th>
                <th className="px-4 py-3 font-bold">Date</th>
                <th className="px-4 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {requestRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    {needle ? "No requests match your search." : emptyCopy}
                  </td>
                </tr>
              ) : (
                requestRows.map((load) => (
                  <tr key={load.id} className="border-b border-white/[0.04]">
                    <td className="px-4 py-3">
                      <button type="button" className="text-left" onClick={() => setSelectedUserId(load.user_id)}>
                        <p className="font-medium text-white">{load.user?.full_name || "Unnamed"}</p>
                        <p className="max-w-[220px] truncate text-xs text-slate-500">{load.user?.email}</p>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-white">{load.game_name}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-300">{amountLabel(load)}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      <p>{formatDate(load.created_at)}</p>
                      <p className="text-slate-500">{formatRelativeTime(load.created_at)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span title={gameLoadStatusHelp(load.status)}>
                        <AdminStatusBadge status={load.status} />
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {visibleCount < visibleRequests.length ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
            Load more requests ({visibleRequests.length - visibleCount} remaining)
          </Button>
        </div>
      ) : null}

      {listTruncated ? (
        <p className="text-sm text-[#9fb0d0]">The counts above include every stored request. This list shows the latest matching rows.</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          asChild
          className={showAllPlayers ? "border-white/15 bg-transparent text-white" : "border-transparent bg-gradient-to-r from-[#6d28d9] to-[#2563eb] text-white"}
        >
          <Link href={VIEW_LINKS.find((item) => item.view === view)?.href ?? "/admin/game-loads"}>Players in this list</Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          asChild
          className={showAllPlayers ? "border-transparent bg-gradient-to-r from-[#6d28d9] to-[#2563eb] text-white" : "border-white/15 bg-transparent text-white"}
        >
          <Link href={playerHref(VIEW_LINKS.find((item) => item.view === view)?.href ?? "/admin/game-loads", true)}>All players</Link>
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setVisibleCount(PAGE_SIZE);
            setVisiblePlayers(PAGE_SIZE);
          }}
          placeholder="Search by player or game..."
          className="border-white/10 bg-[#0b1224] pl-9 text-white placeholder:text-[#8ea0c3]"
        />
      </div>

      <p className="text-sm text-slate-400">
        {filteredPlayers.length.toLocaleString()} player{filteredPlayers.length === 1 ? "" : "s"}
        {showAllPlayers ? " · all players" : " · players with a request in this list"}
      </p>

      <div className={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-violet-500/20 text-[11px] uppercase tracking-wider text-violet-300/70">
              <tr>
                <th className="px-4 py-3 font-bold">Player</th>
                <th className="px-4 py-3 text-right font-bold">Wallet</th>
                <th className="px-4 py-3 text-right font-bold">Loads</th>
                <th className="px-4 py-3 text-right font-bold">Pending</th>
                <th className="px-4 py-3 font-bold">Last activity</th>
                <th className="px-4 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {playerRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    {showAllPlayers ? "No players match your search." : "No players have a request in this list."}
                  </td>
                </tr>
              ) : (
                playerRows.map((user) => {
                  const stats = loadStatsByUser.get(user.id);
                  return (
                    <tr
                      key={user.id}
                      className={cn(
                        "border-b border-white/[0.04] transition-colors",
                        selectedUserId === user.id && "bg-violet-500/10",
                        (stats?.pending ?? 0) > 0 && "bg-amber-400/5"
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{user.full_name || "Unnamed"}</p>
                        <p className="max-w-[200px] truncate text-xs text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-300">
                        ${Number(user.wallet_balance ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold text-white">{stats?.count ?? 0}</p>
                        {(stats?.totalLoaded ?? 0) > 0 ? (
                          <p className="text-xs text-emerald-400">${stats!.totalLoaded.toFixed(0)} loaded</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(stats?.pending ?? 0) > 0 ? (
                          <span className="inline-flex rounded-full bg-amber-300/15 px-2.5 py-1 text-[10px] font-semibold text-amber-100">
                            {stats!.pending}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {stats?.lastAt ? relativeTime(stats.lastAt) : user.last_seen_at ? relativeTime(user.last_seen_at) : "No activity"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-cyan-400/40 text-cyan-300 hover:bg-cyan-400/10 hover:text-cyan-200"
                          onClick={() => setSelectedUserId(user.id)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {visiblePlayers < filteredPlayers.length ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setVisiblePlayers((count) => count + PAGE_SIZE)}>
            Load more players ({filteredPlayers.length - visiblePlayers} remaining)
          </Button>
        </div>
      ) : null}

      {selectedUser ? (
        <AdminWalletLoadsSidebarPanel
          user={selectedUser}
          loads={selectedUserLoads}
          open={!!selectedUserId}
          live={live}
          onClose={() => setSelectedUserId(null)}
        />
      ) : null}
    </div>
  );
}
