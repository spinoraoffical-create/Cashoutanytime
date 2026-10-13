import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminToolGrid } from "@/components/admin/admin-tool-grid";
import { GlassCard } from "@/components/shared/glass-card";
import { loadAutomationHealth } from "@/lib/automation/health";
import { can, requireStaff } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Automation" };

export default async function AutomationPage() {
  const ctx = await requireStaff();
  const operator =
    ctx.isSuperAdmin ||
    ctx.roles.some((role) => role === "super_admin" || role === "admin" || role === "manager");
  if (!operator) redirect("/admin");

  const tools = [
    can(ctx, "cms.manage")
      ? { href: "/admin/ai-blog", title: "AI blog", body: "Draft and publish SEO posts from the existing blog tool." }
      : null,
    can(ctx, "support.manage")
      ? { href: "/admin/ai-bot", title: "Support chatbot", body: "Adjust how the support bot replies before a person takes over." }
      : null,
    {
      href: "/admin/analyzer",
      title: "Analyzer",
      body: "Opens the dashboard. This shortcut does not run a separate report.",
    },
  ].filter((tool): tool is { href: string; title: string; body: string } => Boolean(tool));

  if (tools.length === 0) redirect("/admin");

  const health = await loadAutomationHealth();

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Automation"
        description="What is scheduled, what last ran, and what needs a person. This page does not send messages or move money."
      />
      {health.alerts.length > 0 ? (
        <GlassCard className="mb-4 border-amber-500/40 p-4">
          <h2 className="text-sm font-semibold">Needs attention</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {health.alerts.map((alert) => (
              <li key={alert}>{alert}</li>
            ))}
          </ul>
        </GlassCard>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">No critical alert was found in the saved records.</p>
      )}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {health.jobs.map((job) => (
          <GlassCard key={job.path} className="p-4">
            <p className="text-sm font-semibold">{job.name}</p>
            <p className="mt-2 text-lg font-black">{job.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{job.detail}</p>
          </GlassCard>
        ))}
      </div>
      <GlassCard className="mb-4 p-4">
        <h2 className="text-sm font-semibold">Operational snapshot for today</h2>
        <p className="mt-1 text-xs text-muted-foreground">Counts from saved rows. This is not emailed.</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {health.summary.map((row) => (
            <div key={row.label}>
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-lg font-black tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      </GlassCard>
      <GlassCard className="mb-4 p-4">
        <h2 className="text-sm font-semibold">Provider keys</h2>
        <p className="mt-1 text-xs text-muted-foreground">Shows whether a key is present. It does not call the provider.</p>
        <ul className="mt-3 space-y-1 text-sm">
          {health.providers.map((provider) => (
            <li key={provider.name}>
              {provider.name}: {provider.configured ? "Present" : "Missing"}
            </li>
          ))}
        </ul>
      </GlassCard>
      <AdminToolGrid tools={tools} />
    </div>
  );
}
