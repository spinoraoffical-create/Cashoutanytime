import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminToolGrid } from "@/components/admin/admin-tool-grid";
import { can, requireStaff } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Content" };

const TOOLS = [
  { href: "/admin/cms", title: "CMS", body: "Pages, FAQs, and banners players see in the app.", permission: "cms.manage" },
  { href: "/admin/games", title: "Games catalog", body: "Turn games on, edit names, and set download links.", permission: "cms.manage" },
  { href: "/admin/notifications", title: "Broadcasts", body: "Send an in-app notice to players.", permission: "notifications.broadcast" },
  { href: "/admin/newsletters", title: "Newsletters", body: "Email players who opted in. Test before you send.", permission: "newsletters.manage" },
  { href: "/admin/reviews", title: "Reviews", body: "Approve or hide player reviews.", permission: "cms.manage" },
  { href: "/admin/marketing", title: "Phone outreach", body: "See who can receive SMS or WhatsApp. No bulk texting.", permission: "cms.manage" },
  { href: "/admin/geo", title: "Location pages", body: "Edit city and state landing pages.", permission: "cms.manage" },
];

export default async function ContentPage() {
  const ctx = await requireStaff();
  const tools = TOOLS.filter((tool) => can(ctx, tool.permission));
  if (tools.length === 0) redirect("/admin");

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader title="Content" description="Site copy, games, broadcasts, newsletters, and reviews." />
      <AdminToolGrid tools={tools} />
    </div>
  );
}
