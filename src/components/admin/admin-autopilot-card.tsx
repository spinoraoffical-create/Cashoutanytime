"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { toast } from "sonner";
import { Bot, CheckCircle2, Play, Power, Zap } from "lucide-react";

type AutopilotStatus = {
  enabled: boolean;
  frequencyHours: number;
  lastRunTime: string | null;
  totalAutopilotPosts: number;
};

export function AdminAutopilotCard() {
  const [status, setStatus] = useState<AutopilotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/autopilot");
      if (res.ok) {
        const data = (await res.json()) as AutopilotStatus;
        setStatus(data);
      }
    } catch {
      /* keep last known status */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleToggleAutopilot() {
    if (!status) return;
    const nextState = !status.enabled;

    try {
      const res = await fetch("/api/admin/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", enable: nextState }),
      });
      const data = await res.json();

      if (!res.ok || data.ok === false) {
        toast.error(data.error || "Could not update autopilot.");
        return;
      }

      setStatus(data.status ?? { ...status, enabled: nextState });
      toast.success(nextState ? "Autopilot enabled — daily posts at 9 AM UTC cron." : "Autopilot paused.");
    } catch {
      toast.error("Network error updating autopilot.");
    }
  }

  async function handleTriggerAutopilotNow() {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger" }),
      });
      const data = await res.json();
      setRunning(false);

      if (!res.ok || data.ok === false) {
        toast.error(data.message || data.error || "Autopilot run failed.");
        return;
      }

      toast.success(data.message || "Autopilot post sent.");
      await refresh();
    } catch {
      setRunning(false);
      toast.error("Network error running autopilot.");
    }
  }

  const enabled = status?.enabled ?? false;
  const totalPosts = status?.totalAutopilotPosts ?? 0;

  return (
    <GlassCard className="p-6 border-emerald-500/40 bg-gradient-to-r from-emerald-950/30 via-background to-black">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 mb-6 gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 font-bold">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">Hands-Free Autopilot Marketing Engine</h2>
              <Badge className="bg-emerald-500 text-black font-extrabold text-[10px]">DB-BACKED</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Settings persist in Supabase. Cron runs daily via <code>/api/cron/auto-post</code> with{" "}
              <code>CRON_SECRET</code>.
            </p>
          </div>
        </div>

        <Button
          onClick={() => void handleToggleAutopilot()}
          disabled={loading}
          className={`font-bold text-xs gap-2 shrink-0 py-6 px-6 rounded-xl ${
            enabled
              ? "bg-emerald-500 text-black hover:bg-emerald-400"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          <Power className="h-4 w-4" />
          {enabled ? "Autopilot ON (click to pause)" : "Autopilot OFF (click to enable)"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 items-center">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block font-mono">Autopilot Status</span>
            <span className="text-sm font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />{" "}
              {loading ? "Loading..." : enabled ? "Running 24/7" : "Paused"}
            </span>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">EVERY 24H</Badge>
        </div>

        <div className="rounded-xl border border-border/60 bg-background/60 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block font-mono">Total Autopilot Posts</span>
            <span className="text-lg font-black text-foreground">
              {loading ? "..." : `${totalPosts} logged`}
            </span>
            {status?.lastRunTime && (
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Last: {new Date(status.lastRunTime).toLocaleString()}
              </span>
            )}
          </div>
          <Zap className="h-5 w-5 text-amber-400" />
        </div>

        <Button
          onClick={() => void handleTriggerAutopilotNow()}
          disabled={running || loading}
          variant="outline"
          className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 font-bold py-6 text-xs gap-2 rounded-xl"
        >
          <Play className="h-4 w-4" />
          {running ? "Posting..." : "Test Run Now"}
        </Button>
      </div>
    </GlassCard>
  );
}
