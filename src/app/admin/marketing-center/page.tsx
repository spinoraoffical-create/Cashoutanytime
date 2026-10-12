import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminToolGrid } from "@/components/admin/admin-tool-grid";
import { can, requireStaff } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Marketing" };

export default async function MarketingCenterPage() {
  const ctx = await requireStaff();
  const offerRoles =
    ctx.isSuperAdmin || ctx.roles.includes("sub_creator") || ctx.roles.includes("store_creator");

  const tools = [
    can(ctx, "newsletters.manage")
      ? {
          href: "/admin/newsletters",
          title: "Email campaigns",
          body: "Write, test, and schedule email. A player who turns notices off is skipped before the next send.",
        }
      : null,
    offerRoles
      ? {
          href: "/admin/offers",
          title: "Email and SMS offers",
          body: "Send one email and one SMS to players who agreed. A second send the same day does not go out.",
        }
      : null,
    can(ctx, "cms.manage")
      ? {
          href: "/admin/marketing",
          title: "Phone and WhatsApp, one person at a time",
          body: "Copy one text or open one WhatsApp chat. This does not send in bulk.",
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
    can(ctx, "promotions.manage")
      ? {
          href: "/admin/promotions",
          title: "Promotions",
          body: "Turn offers on or off and edit the copy players see.",
        }
      : null,
    can(ctx, "analytics.read")
      ? {
          href: "/admin/analytics",
          title: "Send reports",
          body: "See how many campaigns and offer sends are saved. This is not a revenue report.",
        }
      : null,
  ].filter((tool): tool is { href: string; title: string; body: string } => Boolean(tool));

  if (tools.length === 0) redirect("/admin");

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Marketing"
        description="The tools you already have, in one place. Nothing here sends on its own."
      />
      <AdminToolGrid tools={tools} />
    </div>
  );
}
