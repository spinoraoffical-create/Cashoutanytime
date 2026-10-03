"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { toast } from "sonner";
import { Bot, RefreshCw, Activity, Terminal, AlertCircle } from "lucide-react";
import type { BotLiveStatus } from "@/lib/data/bot-worker-status";

function formatLastCheck(seconds: number | null): string {
  if (seconds === null) return "Never";
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + " min ago";
  return Math.floor(seconds / 3600) + " hr ago";
}

function statusColor(status: BotLiveStatus["status"]): string {
  switch (status) {
    case "busy":
      return "bg-amber-500";
    case "idle":
    case "online":
      return "bg-emerald-500";
    case "offline":
      return "bg-red-500";
    default:
      return "bg-zinc-500";
  }
}

function statusLabel(status: BotLiveStatus["status"]): string {
  switch (status) {
    case "busy":
      return "Processing";
    case "idle":
      return "Idle";
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    default:
      return "Unknown";
  }
}

export function AdminBotStatusCard() {
  const [bots, setBots] = useState<BotLiveStatus[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadStatus = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/bot-heartbeat", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to load bot status");
      setBots(data.bots);
      setOnlineCount(data.onlineCount);
      if (!quiet) {
        toast.success(String(data.onlineCount) + " of " + String(data.total) + " bots online");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not fetch bot status";
      if (!quiet) toast.error(msg);
    } finally {
      setRefreshing(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadStatus(true);
    const interval = setInterval(() => void loadStatus(true), 30_000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  const allOnline = bots.length > 0 && onlineCount === bots.length;

  return (
    <GlassCard className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 mb-6 gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Bot className="h-5 w-5 text-emerald-400" />
            24/7 Game Bot Worker Control Room
          </h2>
          <p className="text-sm text-muted-foreground">
            Live heartbeats from Supabase - each bot pings every 30s when running.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            className={
              allOnline
                ? "bg-emerald-500/20 text-emerald-400 font-mono"
                : "bg-amber-500/20 text-amber-400 font-mono"
            }
          >
            {loaded ? onlineCount + " of " + (bots.length || 8) + " online" : "LOADING..."}
          </Badge>
          <Button
            size="sm"
            onClick={() => void loadStatus()}
            disabled={refreshing}
            className="bg-emerald-500 text-black hover:bg-emerald-400 font-bold gap-1.5 text-xs"
          >
            <RefreshCw className={"h-3.5 w-3.5" + (refreshing ? " animate-spin" : "")} />
            Refresh
          </Button>
        </div>
      </div>

      {!loaded && (
        <p className="text-sm text-muted-foreground mb-4">Loading bot heartbeats...</p>
      )}

      {loaded && onlineCount === 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            No bots reporting. Run <code className="font-mono text-xs">workers/start-all-advanced-free.bat</code>{" "}
            on your bot PC after setting agent credentials.
          </span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {bots.map((b) => (
          <div
            key={b.id}
            className="rounded-xl border border-border/60 bg-background/60 p-4 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/5 group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-foreground group-hover:text-emerald-300 transition-colors">
                {b.name}
              </span>
              <span className="relative flex h-2.5 w-2.5" title={statusLabel(b.status)}>
                {b.status !== "offline" && (
                  <span
                    className={
                      "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 " +
                      statusColor(b.status)
                    }
                  />
                )}
                <span
                  className={
                    "relative inline-flex rounded-full h-2.5 w-2.5 " + statusColor(b.status)
                  }
                />
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground truncate font-mono mb-1" title={b.panelUrl}>
              🌐 {b.panelUrl}
            </p>
            <p className="text-[10px] text-muted-foreground mb-3">
              {statusLabel(b.status)} · {formatLastCheck(b.secondsSincePing)}
            </p>

            <div className="flex items-center justify-between border-t border-border/40 pt-2.5 text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3 text-emerald-400" /> {b.jobsProcessed} jobs
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">{b.slug}</span>
            </div>
          </div>
        ))}
      </div>

      {bots.length === 0 && loaded && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No bot registry loaded. Check server logs.
        </p>
      )}

      <p className="mt-4 text-[11px] text-muted-foreground flex items-center gap-1">
        <Terminal className="h-3 w-3" />
        Auto-refreshes every 30s · Heartbeats stored in system_health_logs
      </p>
    </GlassCard>
  );
}
