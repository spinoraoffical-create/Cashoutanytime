import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatCard } from "@/components/admin/ui/admin-stat-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { AdminQuickAction } from "@/components/admin/ui/admin-quick-action";
import { AdminErrorState } from "@/components/admin/ui/admin-error-state";
import { loadAutomationHealth } from "@/lib/automation/health";
import { automationJobHelp } from "@/lib/admin/marketing-status";
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
      ? { href: "/admin/ai-blog", title: "AI blog", body: "Draft and publish SEO posts from the existing blog tool. Opening that page does not generate a post." }
      : null,
    can(ctx, "support.manage")
      ? { href: "/admin/ai-bot", title: "Support chatbot", body: "Adjust how the support bot replies before a person takes over. This link does not send a chat." }
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
    <div className="mx-auto max-w-6xl space-y-4">
      <AdminPageHeader
        title="Automation center"
        description="Saved job states and today's counts. The states on file are switch off, not scheduled, unknown, stale, and ok. This page does not send messages, run a job, or move money."
      />
      {health.alerts.length > 0 ? (
        <AdminErrorState title="Needs attention" body={health.alerts.join(" ")} />
      ) : (
        <p className="text-sm text-[#9fb0d0]">No critical alert was found in the saved records.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {health.jobs.map((job) => (
          <AdminSectionCard key={job.path} title={job.name} description={job.detail}>
            <AdminStatusBadge status={job.health.replaceAll("_", " ")} />
            <p className="mt-2 text-sm text-white">{job.label}</p>
            <p className="mt-1 text-xs leading-5 text-[#9fb0d0]">{automationJobHelp(job.health)}</p>
          </AdminSectionCard>
        ))}
      </div>
      <AdminSectionCard title="Operational snapshot for today" description="Counts from saved rows. This is not emailed. These counts are not a job running or failed status.">
        <div className="grid gap-3 sm:grid-cols-2">
          {health.summary.map((row) => (
            <AdminStatCard key={row.label} label={row.label} value={row.value} />
          ))}
        </div>
      </AdminSectionCard>
      <AdminSectionCard title="Provider keys" description="Shows whether a key is present. The value stays hidden. This page does not call the provider.">
        <ul className="space-y-2 text-sm">
          {health.providers.map((provider) => (
            <li key={provider.name} className="flex items-center justify-between gap-3 border-b border-white/5 py-2 last:border-0">
              <span className="text-white">{provider.name}</span>
              <AdminStatusBadge status={provider.configured ? "Present" : "Missing"} />
            </li>
          ))}
        </ul>
      </AdminSectionCard>
      <div className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <AdminQuickAction key={tool.href} href={tool.href} label={tool.title} detail={tool.body} />
        ))}
      </div>
    </div>
  );
}
