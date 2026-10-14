import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminQuickAction } from "@/components/admin/ui/admin-quick-action";
import { can, requireStaff } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Marketing" };

export default async function MarketingCenterPage() {
  const ctx = await requireStaff();

  const tools = [
    can(ctx, "newsletters.manage")
      ? {
          href: "/admin/newsletters",
          title: "Email campaigns",
          body: "Write, test, and schedule email. A player who turns notices off is skipped before the next send. Opening the list does not send.",
        }
      : null,
    can(ctx, "cms.manage")
      ? {
          href: "/admin/marketing",
          title: "Text one player",
          body: "Copy one text or open one WhatsApp chat. This does not send bulk SMS or WhatsApp.",
        }
      : null,
    can(ctx, "cms.manage")
      ? {
          href: "/admin/telegram",
          title: "Telegram channel",
          body: "Post to the Telegram channel when you use the existing send buttons. Opening the page does not post.",
        }
      : null,
    can(ctx, "notifications.broadcast")
      ? {
          href: "/admin/notifications",
          title: "In-app notices",
          body: "Send a notice inside the site to a VIP group. The history list is view only.",
        }
      : null,
    can(ctx, "promotions.manage")
      ? {
          href: "/admin/promotions",
          title: "Promotions",
          body: "Turn site promotions on or off and edit the copy players see. This screen does not send email or SMS.",
        }
      : null,
    ctx.isSuperAdmin || ctx.roles.includes("store_creator") || ctx.roles.includes("sub_creator")
      ? {
          href: "/admin/offers",
          title: "One-time offers",
          body: "Send one email and one SMS to players who agreed. This does not send bulk WhatsApp.",
        }
      : null,
  ].filter((tool): tool is { href: string; title: string; body: string } => Boolean(tool));

  if (tools.length === 0) redirect("/admin");

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Marketing center"
        description="Email, one player text, Telegram, in-app notices, and promotions. Each tool still checks permission before it opens. Text one player does not send bulk SMS or WhatsApp."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <AdminQuickAction key={tool.href} href={tool.href} label={tool.title} detail={tool.body} />
        ))}
      </div>
    </div>
  );
}
