import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminToolGrid } from "@/components/admin/admin-tool-grid";
import { can, requireStaff } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Content" };

const TOOLS = [
  { href: "/admin/cms", title: "CMS", body: "Pages, FAQs, and banners players see in the app.", permission: "cms.manage" },
  { href: "/admin/games", title: "Games catalog", body: "Turn games on, edit names, and set download links.", permission: "cms.manage" },
  { href: "/admin/reviews", title: "Reviews", body: "Approve or hide player reviews.", permission: "cms.manage" },
  { href: "/admin/geo", title: "Location pages", body: "Edit city and state landing pages.", permission: "cms.manage" },
];

export default async function ContentPage() {
  const ctx = await requireStaff();
  const tools = TOOLS.filter((tool) => can(ctx, tool.permission));
  if (tools.length === 0) redirect("/admin");

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader title="Content" description="Site copy, games, reviews, and location pages." />
      <AdminToolGrid tools={tools} />
    </div>
  );
}
