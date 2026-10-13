import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminToolGrid } from "@/components/admin/admin-tool-grid";
import { can, requireStaff } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Marketing" };

export default async function MarketingCenterPage() {
  const ctx = await requireStaff();

  const tools = [
    can(ctx, "newsletters.manage")
      ? {
          href: "/admin/newsletters",
          title: "Email campaigns",
          body: "Write, test, and schedule email. A player who turns notices off is skipped before the next send.",
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
          body: "Post to the Telegram channel. This does not message each player.",
        }
      : null,
    can(ctx, "notifications.broadcast")
      ? {
          href: "/admin/notifications",
          title: "In-app notices",
          body: "Send a notice inside the site to a VIP group.",
        }
      : null,
  ].filter((tool): tool is { href: string; title: string; body: string } => Boolean(tool));

  if (tools.length === 0) redirect("/admin");

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Marketing"
        description="Send an email campaign, text one player, post to Telegram, or send an in-app notice."
      />
      <AdminToolGrid tools={tools} />
    </div>
  );
}
