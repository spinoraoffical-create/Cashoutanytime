import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminToolGrid } from "@/components/admin/admin-tool-grid";
import { can, requireStaff } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Rewards" };

const TOOLS = [
  { href: "/admin/promotions", title: "Promotions", body: "Turn site promotions on or off and edit the copy players see.", permission: "promotions.manage" },
  { href: "/admin/referrals", title: "Referrals", body: "See who invited whom and which referrals qualified.", permission: "referrals.manage" },
  { href: "/admin/vip", title: "VIP", body: "Edit tier names and the points needed to reach them.", permission: "vip.manage" },
  { href: "/admin/rewards", title: "Rewards", body: "Manage reward catalog items players can claim.", permission: "rewards.manage" },
  { href: "/admin/achievements", title: "Achievements", body: "Edit achievement names and how players earn them.", permission: "achievements.manage" },
  { href: "/admin/leaderboards", title: "Leaderboards", body: "Review leaderboard seasons and standings.", permission: "leaderboards.manage" },
  { href: "/admin/bonus-transactions", title: "Bonus history", body: "Look up bonus credits already applied to wallets.", permission: "rewards.manage" },
];

export default async function GrowthPage() {
  const ctx = await requireStaff();
  const offerRoles =
    ctx.isSuperAdmin || ctx.roles.includes("super_admin") || ctx.roles.includes("store_creator") || ctx.roles.includes("sub_creator");
  const tools = TOOLS.filter((tool) => can(ctx, tool.permission)).map(({ href, title, body }) => ({ href, title, body }));
  if (offerRoles) {
    const afterPromotions = tools.findIndex((tool) => tool.href === "/admin/promotions");
    tools.splice(afterPromotions + 1, 0, {
      href: "/admin/offers",
      title: "One-time offers",
      body: "Send one email and one SMS to players who agreed. A second send the same day does not go out.",
    });
  }
  if (tools.length === 0) redirect("/admin");

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Rewards"
        description="Edit promotions, send a one-time offer, and review referrals, VIP, and rewards."
      />
      <AdminToolGrid tools={tools} />
    </div>
  );
}
