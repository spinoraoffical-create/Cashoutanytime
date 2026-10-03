import type { Metadata } from "next";
import { revalidatePath } from "next/cache";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/data/admin";
import { runSystemSelfAnalysis } from "@/lib/ai/self-analyzer";

export const metadata: Metadata = { title: "AI Self-Analyzer" };

async function triggerManualSelfAnalysisAction() {
  "use server";
  await runSystemSelfAnalysis();
  revalidatePath("/admin/analyzer");
}

export default async function AdminAnalyzerPage() {
  await requirePermission("analytics.read");

  const report = await runSystemSelfAnalysis();

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (score >= 70) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    return "text-red-400 border-red-500/30 bg-red-500/10";
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader
        title="Autonomous AI System Self-Analyzer"
        description="Self-diagnostic engine analyzing SEO coverage, site health, user growth, environment integrity, and automated fix recommendations."
      />

      {/* Main Health Score Banner */}
      <GlassCard className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className={`flex size-24 shrink-0 items-center justify-center rounded-2xl border-2 text-4xl font-extrabold ${getScoreColor(report.healthScore)}`}>
              {report.healthScore}%
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-foreground">System Health Score</h2>
                <Badge className="bg-ws-green/15 text-ws-green">Autonomous AI Scan</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Last Diagnostic Check: {new Date(report.timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          <form action={triggerManualSelfAnalysisAction}>
            <Button type="submit" className="bg-ws-green text-black hover:bg-ws-green/90 font-bold w-full md:w-auto">
              🔄 Run Autonomous Analysis Now
            </Button>
          </form>
        </div>
      </GlassCard>

      {/* Metric Breakdown Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-5">
          <p className="hud-label text-xs text-muted-foreground">Published SEO Posts</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-foreground">{report.seoMetrics.publishedPostsCount}</span>
            <Badge variant="outline">Target: 10+</Badge>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="hud-label text-xs text-muted-foreground">Indexed Geo Pages</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-foreground">{report.seoMetrics.geoPagesCount}</span>
            <Badge className="bg-emerald-500/15 text-emerald-400">Active</Badge>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="hud-label text-xs text-muted-foreground">Total Platform Users</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-foreground">{report.activityMetrics.totalUsers}</span>
            <Badge variant="outline">Registered</Badge>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="hud-label text-xs text-muted-foreground">Environment Health</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-xl font-bold ${report.environmentMetrics.isTelegramConfigured ? "text-emerald-400" : "text-amber-400"}`}>
              {report.environmentMetrics.isTelegramConfigured ? "100% Ready" : "Warnings"}
            </span>
            <Badge variant="outline">Config Check</Badge>
          </div>
        </GlassCard>
      </div>

      {/* Recommendations List */}
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">🔍 AI Action Items & Optimization Advice</h2>

        <div className="space-y-3">
          {report.recommendations.map((rec) => (
            <div
              key={rec.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border/60 bg-background/40 gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      rec.type === "warning"
                        ? "destructive"
                        : rec.type === "success"
                          ? "default"
                          : "outline"
                    }
                  >
                    {rec.type.toUpperCase()}
                  </Badge>
                  <h3 className="font-semibold text-foreground text-sm">{rec.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
              </div>

              {rec.actionHref && (
                <a
                  href={rec.actionHref}
                  className="inline-flex items-center justify-center rounded-md text-xs font-bold bg-ws-green/20 text-ws-green-deep dark:text-ws-green px-3 py-1.5 hover:bg-ws-green/30 transition-colors shrink-0"
                >
                  {rec.actionLabel || "Fix Issue"} →
                </a>
              )}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
