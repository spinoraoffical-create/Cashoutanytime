import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminToolGrid } from "@/components/admin/admin-tool-grid";
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
    can(ctx, "cms.manage")
      ? { href: "/admin/telegram", title: "Telegram", body: "Control the Telegram bot and send a channel post." }
      : null,
    can(ctx, "support.manage")
      ? { href: "/admin/ai-bot", title: "AI chatbot", body: "Adjust how the support bot replies before a person takes over." }
      : null,
  ].filter((tool): tool is { href: string; title: string; body: string } => Boolean(tool));

  if (tools.length === 0) redirect("/admin");

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Automation"
        description="Blog, Telegram, and the support chatbot. Hidden from support agents."
      />
      <AdminToolGrid tools={tools} />
    </div>
  );
}
