"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GameLoadActions } from "@/components/admin/game-load-actions";
import { createClient } from "@/lib/supabase/client";
import { searchAdminTransactionUsers } from "@/lib/actions/wallet";
import { formatDate, formatRelativeTime, cn } from "@/lib/utils";
import type { GameLoadRequest, GameLoadStatus } from "@/lib/game-automation/types";
import { Search, Radio, User, X, Wallet, Loader2 } from "lucide-react";

export interface AdminGameLoadRow extends GameLoadRequest {
  user?: { full_name?: string | null; email?: string } | null;
}

export interface AdminGameLoadUser {
  id: string;
  full_name: string | null;
  email: string;
}

const statusVariant: Record<GameLoadStatus, "default" | "warning" | "success" | "destructive"> = {
  pending: "warning",
  processing: "default",
  completed: "success",
  failed: "destructive",
  cancelled: "destructive",
};

function loadSummary(load: AdminGameLoadRow): string {
  if (load.load_type === "redeem") {
    if (load.redeem_all) return `Redeem all → ${load.wallet_type === "bonus" ? "Bonus Redeem" : "Deposit Redeem"}`;
    return `$${Number(load.amount).toFixed(2)} redeem`;
  }
  return `$${Number(load.amount).toFixed(2)} load to ${load.game_name}`;
}

function LoadEntry({ load }: { load: AdminGameLoadRow }) {
  const user = load.user;
  const isRedeem = load.load_type === "redeem";

  return (
    <Card className="border-border/80">
      <CardContent className="p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="font-semibold text-sm">{load.game_name}</span>
              <Badge variant={statusVariant[load.status]} className="text-[10px]">
                {load.status}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {isRedeem ? "redeem" : "load"}
              </Badge>
            </div>
            {user && (
              <p className="text-xs text-muted-foreground truncate">
                {user.full_name || "Unnamed"} ({user.email})
              </p>
            )}
            <p
              className={cn(
                "text-sm font-bold mt-1",
                isRedeem ? "text-sky-400" : "text-emerald-400"
              )}
            >
              {loadSummary(load)}
            </p>
            {load.game_username && (
              <p className="text-xs mt-1">Game login: {load.game_username}</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              {formatDate(load.created_at)} · {formatRelativeTime(load.created_at)}
            </p>
          </div>
          <GameLoadActions load={load} />
        </div>
      </CardContent>
    </Card>
  );
}

function LoadsPanel({
  title,
  icon: Icon,
  loads,
  emptyHint,
  accentClass,
}: {
  title: string;
  icon: typeof Wallet;
  loads: AdminGameLoadRow[];
  emptyHint: string;
  accentClass?: string;
}) {
  const pending = loads.filter((l) => l.status === "pending" || l.status === "processing").length;

  return (
    <Card className={cn("flex flex-col min-h-[360px] border-2", accentClass)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {loads.length} load/redeem{loads.length === 1 ? "" : "s"}
          {pending > 0 ? ` · ${pending} waiting for bot` : ""}
        </p>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto max-h-[640px] space-y-2 pt-0">
        {loads.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{emptyHint}</p>
        ) : (
          loads.map((load) => <LoadEntry key={load.id} load={load} />)
        )}
      </CardContent>
    </Card>
  );
}

interface AdminWalletLoadsPanelsProps {
  loads: AdminGameLoadRow[];
  users?: AdminGameLoadUser[];
  /** Search users on demand instead of prefetching thousands of profiles. */
  lazyUsers?: boolean;
}

export function AdminWalletLoadsPanels({
  loads: initialLoads,
  users: initialUsers = [],
  lazyUsers = false,
}: AdminWalletLoadsPanelsProps) {
  const router = useRouter();
  const [loads, setLoads] = useState(initialLoads);
  const [users, setUsers] = useState<AdminGameLoadUser[]>(initialUsers);
  const [userQuery, setUserQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [searchPending, startSearch] = useTransition();

  useEffect(() => {
    setLoads(initialLoads);
  }, [initialLoads]);

  useEffect(() => {
    if (!lazyUsers) return;
    const timer = window.setTimeout(() => setDebouncedQuery(userQuery), 300);
    return () => window.clearTimeout(timer);
  }, [lazyUsers, userQuery]);

  useEffect(() => {
    if (!lazyUsers) return;
    startSearch(async () => {
      const result = await searchAdminTransactionUsers(debouncedQuery, 10);
      if ("users" in result) setUsers(result.users);
    });
  }, [lazyUsers, debouncedQuery]);

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

  const matchingUsers = useMemo(() => {
    if (lazyUsers) return users;
    const q = userQuery.trim().toLowerCase();
    if (!q) return users.slice(0, 10);
    return users
      .filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [users, userQuery, lazyUsers]);

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;

  const filteredLoads = useMemo(() => {
    if (!selectedUserId) return loads;
    return loads.filter((l) => l.user_id === selectedUserId);
  }, [loads, selectedUserId]);

  const depositLoads = useMemo(
    () =>
      filteredLoads.filter(
        (l) => l.wallet_type === "current" && ["load", "reload", "redeem"].includes(l.load_type)
      ),
    [filteredLoads]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="relative max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Filter by user name or email (optional)…"
            className="pl-9"
          />
          {lazyUsers && searchPending && (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {selectedUser ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1 py-1.5 px-3">
              <User className="h-3 w-3" />
              {selectedUser.full_name || selectedUser.email}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedUserId(null);
                setUserQuery("");
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Show all users
            </Button>
            {live && (
              <span className="text-xs text-emerald-400 inline-flex items-center gap-1">
                <Radio className="h-3 w-3 animate-pulse" />
                Live
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {matchingUsers.map((u) => (
              <Button
                key={u.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto py-1.5 px-2.5 text-left flex-col items-start gap-0"
                onClick={() => {
                  setSelectedUserId(u.id);
                  setUserQuery(u.full_name || u.email);
                }}
              >
                <span className="text-xs font-medium">{u.full_name || "Unnamed"}</span>
                <span className="text-[10px] text-muted-foreground font-normal">{u.email}</span>
              </Button>
            ))}
          </div>
        )}
      </div>

      <LoadsPanel
        title="Total Deposit — loads & redeems"
        icon={Wallet}
        loads={depositLoads}
        emptyHint="No deposit wallet loads or redeems yet."
        accentClass="border-emerald-500/30"
      />
    </div>
  );
}
