"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { generateBlogArticleAction } from "@/lib/actions/admin/ai-blog-actions";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle2, Zap } from "lucide-react";

const BLOG_PRESETS = [
  {
    name: "Juwa 777 Guide",
    topic: "Juwa 777 Download & Free Credits Strategy Guide 2026",
    keywords: "juwa 777, juwa free credits, juwa login, spinora juwa",
  },
  {
    name: "Orion Stars Tips",
    topic: "Orion Stars Online Play & Secret Winning Strategies",
    keywords: "orion stars, orion stars bonus, fish table tips, spinora gaming",
  },
  {
    name: "Fire Kirin Cashout",
    topic: "Fire Kirin Fast Deposit & Payout Walkthrough",
    keywords: "fire kirin, fire kirin deposit, fire kirin app, spinora bonus",
  },
  {
    name: "Game Vault VIP",
    topic: "Game Vault VIP Unlock Code & Bonus Rules",
    keywords: "game vault, game vault 999, game vault login, spinora VIP",
  },
  {
    name: "Fish Table Bosses",
    topic: "Top 5 Fish Table Games with Highest Payout Multipliers",
    keywords: "fish table games, ocean king, fish game strategy, spinora slots",
  },
  {
    name: "Spinora Cashout",
    topic: "Spinora Instant Cashout & Daily Wheel Rewards Guide",
    keywords: "spinora gaming, spinora cashout, spinora bonus wheel, fast payouts",
  },
];

export function AIBlogGeneratorCard() {
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<{ title: string; slug: string } | null>(null);

  function applyPreset(preset: (typeof BLOG_PRESETS)[0]) {
    setTopic(preset.topic);
    setKeywords(preset.keywords);
    toast.info(`Preset Loaded: "${preset.name}"`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setLastGenerated(null);

    const kwArray = keywords.trim() ? keywords.split(",").map((k) => k.trim()) : undefined;
    const res = await generateBlogArticleAction(topic.trim() || undefined, kwArray);

    setLoading(false);

    if (!res.ok) {
      toast.error(res.error || "Failed to generate blog article.");
      return;
    }

    if (res.post) {
      setLastGenerated({ title: res.post.title, slug: res.post.slug });
      toast.success(`Published: "${res.post.title}"`);
    } else {
      toast.success("Blog post generated and published successfully!");
    }

    setTopic("");
    setKeywords("");
  }

  return (
    <GlassCard className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 mb-6 gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-ws-green" />
            Generate AI Blog Article
          </h2>
          <p className="text-sm text-muted-foreground">
            Instant generation mode. Pick a 1-touch preset below or leave empty for autonomous AI topic selection.
          </p>
        </div>
        <Badge className="bg-ws-green/20 text-ws-green font-mono shrink-0">
          CRON ROUTE: /api/cron/auto-blog
        </Badge>
      </div>

      {/* 1-Click Non-Coder Presets */}
      <div className="mb-6 rounded-xl border border-ws-green/30 bg-ws-green/5 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-ws-green mb-2.5 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> 1-Touch Non-Coder Blog Presets (Click to Auto-Fill)
        </p>
        <div className="flex flex-wrap gap-2">
          {BLOG_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded-lg border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-ws-green/20 hover:border-ws-green/50 transition-all"
            >
              🎯 {preset.name}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Target Article Topic (Optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Orion Stars Free Credits & Win Strategies 2026"
              className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ws-green"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Target Keywords (Comma Separated)
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g. orion stars, spinora bonus code, fish table tips"
              className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ws-green"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          {lastGenerated ? (
            <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                Published!{" "}
                <a
                  href={`/blog/${lastGenerated.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-emerald-300"
                >
                  View Post
                </a>
              </span>
            </div>
          ) : (
            <div />
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto bg-ws-green text-black hover:bg-ws-green/90 font-bold gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Writing & Publishing Article...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate & Publish Article Now
              </>
            )}
          </Button>
        </div>
      </form>
    </GlassCard>
  );
}
