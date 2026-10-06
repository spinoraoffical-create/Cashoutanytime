"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Search, Radio } from "lucide-react";

import { AdminWalletLoadsSidebarPanel } from "@/components/admin/admin-wallet-loads-sidebar-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn, formatRelativeTime } from "@/lib/utils";
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

interface AdminWalletLoadsPanelsProps {
  loads: AdminGameLoadRow[];
  users: AdminGameLoadUser[];
}

const PAGE_SIZE = 40;

const CARD =
  "overflow-hidden rounded-2xl border border-violet-400/25 bg-[rgba(18,14,34,0.72)] backdrop-blur-xl";

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

function loadLabel(load: AdminGameLoadRow): string {
  if (load.load_type === "redeem") {
    return load.redeem_all ? "Redeem all" : `Redeem $${Number(load.amount).toFixed(2)}`;
  }
  return `Load $${Number(load.amount).toFixed(2)} → ${load.game_name}`;
}

export function AdminWalletLoadsPanels({ loads: initialLoads, users }: AdminWalletLoadsPanelsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loads, setLoads] = useState(initialLoads);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    setLoads(initialLoads);
  }, [initialLoads]);

  useEffect(() => {
    const userId = searchParams.get("userId");
    if (userId && users.some((user) => user.id === userId)) {
      setSelectedUserId(userId);
    }
  }, [searchParams, users]);

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

  const depositLoads = useMemo(
    () =>
      loads.filter(
        (l) => l.wallet_type === "current" && ["load", "reload", "redeem"].includes(l.load_type)
      ),
    [loads]
  );

  const loadStatsByUser = useMemo(() => {
    const map = new Map<string, UserLoadStats>();
    for (const load of depositLoads) {
      const userId = load.user_id;
      const existing = map.get(userId) ?? { count: 0, pending: 0, lastAt: null, totalLoaded: 0 };
      existing.count += 1;
      if (load.status === "pending" || load.status === "processing") {
        existing.pending += 1;
      }
      if (!existing.lastAt || load.created_at > existing.lastAt) {
        existing.lastAt = load.created_at;
      }
      if (
        load.status === "completed" &&
        (load.load_type === "load" || load.load_type === "reload")
      ) {
        existing.totalLoaded += Number(load.amount);
      }
      map.set(userId, existing);
    }
    return map;
  }, [depositLoads]);

  const pendingLoads = useMemo(
    () =>
      depositLoads.filter((l) => l.status === "pending" || l.status === "processing").slice(0, 10),
    [depositLoads]
  );

  const recentActivity = useMemo(() => depositLoads.slice(0, 8), [depositLoads]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? users.filter(
          (user) =>
            user.full_name?.toLowerCase().includes(q) || user.email.toLowerCase().includes(q)
        )
      : users;

    return [...list].sort((a, b) => {
      const aStats = loadStatsByUser.get(a.id);
      const bStats = loadStatsByUser.get(b.id);
      if ((aStats?.pending ?? 0) !== (bStats?.pending ?? 0)) {
        return (bStats?.pending ?? 0) - (aStats?.pending ?? 0);
      }
      const aTime = aStats?.lastAt ?? a.created_at ?? "";
      const bTime = bStats?.lastAt ?? b.created_at ?? "";
      return bTime.localeCompare(aTime);
    });
  }, [users, query, loadStatsByUser]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;

  const selectedUserLoads = useMemo(() => {
    if (!selectedUserId) return [];
    return depositLoads.filter((l) => l.user_id === selectedUserId);
  }, [depositLoads, selectedUserId]);

  return (
    <div className="space-y-6">
      {pendingLoads.length > 0 && (
        <div className={cn(CARD, "border-amber-400/30")}>
          <div className="flex items-center justify-between border-b border-amber-400/20 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              Pending loads — needs action ({pendingLoads.length})
            </p>
            {live && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                <Radio className="h-3 w-3 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <div className="divide-y divide-white/[0.04]">
            {pendingLoads.map((load) => (
              <button
                key={load.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-amber-400/10"
                onClick={() => setSelectedUserId(load.user_id)}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {load.user?.full_name || load.user?.email || "Unknown user"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {loadLabel(load)} · {formatRelativeTime(load.created_at)}
                  </p>
                </div>
                <Badge variant="warning" className="shrink-0 text-[10px]">{load.status}</Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={CARD}>
        <div className="border-b border-violet-500/20 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-300/70">
            Recent loads (all users)
          </p>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {recentActivity.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No loads yet.</p>
          ) : (
            recentActivity.map((load) => (
              <button
                key={load.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-violet-500/10"
                onClick={() => setSelectedUserId(load.user_id)}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {load.user?.full_name || load.user?.email || "Unknown user"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {loadLabel(load)} · {formatRelativeTime(load.created_at)}
                  </p>
                </div>
                <Badge
                  variant={
                    load.status === "completed"
                      ? "success"
                      : load.status === "pending" || load.status === "processing"
                        ? "warning"
                        : "destructive"
                  }
                  className="shrink-0 text-[10px]"
                >
                  {load.status}
                </Badge>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          placeholder="Filter players by name or email..."
          className="border-violet-400/20 bg-[rgba(18,14,34,0.5)] pl-9"
        />
      </div>

      <p className="text-sm text-slate-400">
        {filtered.length} player{filtered.length === 1 ? "" : "s"} · pending loads shown first
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
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    No players match your filter.
                  </td>
                </tr>
              ) : (
                visible.map((user) => {
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
                        {(stats?.totalLoaded ?? 0) > 0 && (
                          <p className="text-xs text-emerald-400">
                            ${stats!.totalLoaded.toFixed(0)} loaded
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(stats?.pending ?? 0) > 0 ? (
                          <Badge variant="warning" className="text-[10px]">
                            {stats!.pending}
                          </Badge>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {stats?.lastAt
                          ? relativeTime(stats.lastAt)
                          : user.last_seen_at
                            ? relativeTime(user.last_seen_at)
                            : "No activity"}
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

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
            Load more ({filtered.length - visibleCount} remaining)
          </Button>
        </div>
      )}

      {selectedUser && (
        <AdminWalletLoadsSidebarPanel
          user={selectedUser}
          loads={selectedUserLoads}
          open={!!selectedUserId}
          live={live}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
