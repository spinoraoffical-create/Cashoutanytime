"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { toast } from "sonner";
import { DollarSign, TrendingUp, Users, ShieldCheck, Download, BarChart3, Flame, Zap } from "lucide-react";

export function AdminRevenueAnalytics() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");

  function handleExport() {
    toast.success("Exported Daily Financial & Bot Volume Report (CSV)!");
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector & Export Button */}
      <GlassCard className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-amber-400" />
          <div>
            <h2 className="text-sm font-bold text-foreground">Analytics Range</h2>
            <p className="text-xs text-muted-foreground">Select reporting window for revenue, deposits, and bot volume.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border/60 bg-background/60 p-1">
            {(["24h", "7d", "30d"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  timeRange === range
                    ? "bg-amber-500 text-black shadow-sm"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            onClick={handleExport}
            variant="outline"
            className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 font-bold gap-1 text-xs"
          >
            <Download className="h-3.5 w-3.5" /> Export Report
          </Button>
        </div>
      </GlassCard>

      {/* Advanced Metric Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Estimated Deposit Volume"
          value={timeRange === "24h" ? "$1,450.00" : timeRange === "7d" ? "$9,820.00" : "$42,600.00"}
          delta={+18.4}
          deltaLabel="vs previous period"
          icon={<DollarSign />}
          accent="gold"
        />
        <StatCard
          label="Bot Fulfillment Rate"
          value="99.6%"
          delta={+0.4}
          deltaLabel="cdp stability"
          icon={<ShieldCheck />}
          accent="emerald"
        />
        <StatCard
          label="Active Daily Players"
          value={timeRange === "24h" ? "142" : timeRange === "7d" ? "680" : "2,450"}
          delta={+24}
          deltaLabel="new signups"
          icon={<Users />}
          accent="purple"
        />
        <StatCard
          label="Avg Payout Process Speed"
          value="5.8 mins"
          delta={-1.2}
          deltaLabel="faster response"
          icon={<Zap />}
          accent="cyan"
        />
      </div>

      {/* Game Performance Ranking & VIP Tier Split */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Game Volumes */}
        <GlassCard className="p-6">
          <h3 className="text-md font-bold text-foreground mb-4 flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-400" /> Top Game Request Share ({timeRange})
          </h3>

          <div className="space-y-3">
            {[
              { name: "Juwa 777", share: "38%", volume: "$550.00", color: "bg-amber-500" },
              { name: "Game Vault 999", share: "24%", volume: "$350.00", color: "bg-emerald-500" },
              { name: "Fire Kirin", share: "18%", volume: "$260.00", color: "bg-sky-500" },
              { name: "Orion Stars", share: "12%", volume: "$180.00", color: "bg-purple-500" },
              { name: "Vegas Sweeps & Others", share: "8%", volume: "$110.00", color: "bg-rose-500" },
            ].map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground">{item.name}</span>
                  <span className="font-mono text-muted-foreground">{item.volume} ({item.share})</span>
                </div>
                <div className="h-2 w-full rounded-full bg-background/80 overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: item.share }} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Player Retention & VIP Tier Breakdown */}
        <GlassCard className="p-6">
          <h3 className="text-md font-bold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" /> Player VIP Tier Distribution
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-3.5">
              <span className="text-xs font-bold text-amber-400 uppercase">Bronze Tiers</span>
              <p className="text-2xl font-extrabold text-foreground mt-1">64%</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">New signups & casuals</p>
            </div>

            <div className="rounded-xl border border-slate-400/40 bg-slate-900/40 p-3.5">
              <span className="text-xs font-bold text-slate-300 uppercase">Silver Tiers</span>
              <p className="text-2xl font-extrabold text-foreground mt-1">21%</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Active weekly reloaders</p>
            </div>

            <div className="rounded-xl border border-yellow-500/40 bg-yellow-950/20 p-3.5">
              <span className="text-xs font-bold text-yellow-400 uppercase">Gold Tiers</span>
              <p className="text-2xl font-extrabold text-foreground mt-1">11%</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">High deposit players</p>
            </div>

            <div className="rounded-xl border border-purple-400/40 bg-purple-950/20 p-3.5">
              <span className="text-xs font-bold text-purple-400 uppercase">Platinum VIPs</span>
              <p className="text-2xl font-extrabold text-foreground mt-1">4%</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Top-tier high rollers</p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
