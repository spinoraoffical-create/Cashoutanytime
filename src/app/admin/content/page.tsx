import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminToolGrid } from "@/components/admin/admin-tool-grid";
import { can, requireStaff } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Website" };

const TOOLS = [
  { href: "/admin/cms", title: "Pages, FAQ, banners, blog", body: "Edit the pages, FAQs, banners, and blog posts players see.", permission: "cms.manage" },
  { href: "/admin/games", title: "Games list", body: "Turn games on, edit names, and set download links.", permission: "cms.manage" },
  { href: "/admin/reviews", title: "Reviews", body: "Approve or hide player reviews.", permission: "cms.manage" },
  { href: "/admin/geo", title: "City pages", body: "Edit city and state landing pages.", permission: "cms.manage" },
];

export default async function ContentPage() {
  const ctx = await requireStaff();
  const tools = TOOLS.filter((tool) => can(ctx, tool.permission));
  if (tools.length === 0) redirect("/admin");

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader title="Website" description="Edit pages, the games list, reviews, and city pages." />
      <AdminToolGrid tools={tools} />
    </div>
  );
}
