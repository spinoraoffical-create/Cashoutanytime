"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { toast } from "sonner";
import { Ticket, Sparkles, Copy, CheckCircle2, Zap } from "lucide-react";

interface PromoPreset {
  name: string;
  code: string;
  bonusAmount: number;
  rolloverMultiplier: number;
  maxCashout: number;
}

const PRESET_PROMOS: PromoPreset[] = [
  { name: "100% Deposit Match", code: "ROYALE100", bonusAmount: 100, rolloverMultiplier: 40, maxCashout: 50 },
  { name: "Juwa Freeplay $20", code: "JUWA20", bonusAmount: 20, rolloverMultiplier: 35, maxCashout: 20 },
  { name: "Orion Stars Bonus $50", code: "ORION50", bonusAmount: 50, rolloverMultiplier: 40, maxCashout: 30 },
  { name: "Game Vault VIP Match", code: "VAULTVIP", bonusAmount: 100, rolloverMultiplier: 50, maxCashout: 100 },
  { name: "Weekend Super Reload", code: "WEEKEND50", bonusAmount: 50, rolloverMultiplier: 30, maxCashout: 40 },
];

export function AdminPromoGeneratorCard() {
  const [code, setCode] = useState("");
  const [bonusAmount, setBonusAmount] = useState(50);
  const [rollover, setRollover] = useState(40);
  const [maxCashout, setMaxCashout] = useState(20);
  const [createdPromos, setCreatedPromos] = useState<PromoPreset[]>(PRESET_PROMOS);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  function applyPreset(preset: PromoPreset) {
    setCode(preset.code);
    setBonusAmount(preset.bonusAmount);
    setRollover(preset.rolloverMultiplier);
    setMaxCashout(preset.maxCashout);
    toast.info(`Preset Loaded: "${preset.name}"`);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Please enter a promo code or select a 1-click preset.");
      return;
    }

    const newPromo: PromoPreset = {
      name: `${code.toUpperCase()} Code`,
      code: code.toUpperCase().trim(),
      bonusAmount,
      rolloverMultiplier: rollover,
      maxCashout,
    };

    setCreatedPromos((prev) => [newPromo, ...prev]);
    toast.success(`Promo Code "${newPromo.code}" is now LIVE on your website!`);
    setCode("");
  }

  function copyCode(c: string) {
    navigator.clipboard.writeText(c);
    setCopiedCode(c);
    toast.success(`Copied "${c}" to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  return (
    <GlassCard className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 mb-6 gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Ticket className="h-5 w-5 text-amber-400" />
            1-Click Marketing Promo Code Generator
          </h2>
          <p className="text-sm text-muted-foreground">
            Create instant promotional codes with custom deposit matches, rollover locks, and cashout caps for your players.
          </p>
        </div>
        <Badge className="bg-amber-500/20 text-amber-400 shrink-0 font-mono">NON-CODER MARKETING</Badge>
      </div>

      {/* 1-Touch Non-Coder Presets */}
      <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2.5 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> 1-Touch Promo Presets (Click to Auto-Fill)
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESET_PROMOS.map((p) => (
            <button
              key={p.code}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-lg border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-amber-500/20 hover:border-amber-500/50 transition-all flex items-center gap-1"
            >
              🎟️ {p.name} (<span className="font-mono text-amber-300">{p.code}</span>)
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleCreate} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-bold uppercase text-foreground mb-1">Promo Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. ROYALE100"
              className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-foreground mb-1">Bonus Match ($ / %)</label>
            <input
              type="number"
              value={bonusAmount}
              onChange={(e) => setBonusAmount(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-foreground mb-1">Rollover Multiplier</label>
            <select
              value={rollover}
              onChange={(e) => setRollover(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
            >
              <option value={30}>30x Rollover</option>
              <option value={40}>40x Rollover (Recommended)</option>
              <option value={50}>50x Rollover (Max Protection)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-foreground mb-1">Max Cashout Cap ($)</label>
            <input
              type="number"
              value={maxCashout}
              onChange={(e) => setMaxCashout(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" className="bg-amber-500 text-black hover:bg-amber-400 font-bold gap-1.5">
            <Sparkles className="h-4 w-4" /> Activate Promo Code Now
          </Button>
        </div>
      </form>

      {/* Active Promos Table */}
      <div className="mt-6 border-t border-border/50 pt-4">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Active Website Promo Codes ({createdPromos.length})
        </h3>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {createdPromos.map((p) => (
            <div
              key={p.code}
              className="rounded-xl border border-border/60 bg-background/60 p-3 flex items-center justify-between group hover:border-amber-500/40"
            >
              <div>
                <span className="font-mono text-sm font-bold text-amber-300 tracking-wider">
                  {p.code}
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  ${p.bonusAmount} Bonus • {p.rolloverMultiplier}x Rollover • ${p.maxCashout} Cap
                </p>
              </div>

              <button
                onClick={() => copyCode(p.code)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
                title="Copy code"
              >
                {copiedCode === p.code ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
