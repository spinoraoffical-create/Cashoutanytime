import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminToolGrid } from "@/components/admin/admin-tool-grid";
import { can, requireStaff } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Growth" };

const TOOLS = [
  { href: "/admin/referrals", title: "Referrals", body: "See who invited whom and which referrals qualified.", permission: "referrals.manage" },
  { href: "/admin/vip", title: "VIP tiers", body: "Edit tier names and the points needed to reach them.", permission: "vip.manage" },
  { href: "/admin/rewards", title: "Rewards", body: "Manage reward catalog items players can claim.", permission: "rewards.manage" },
  { href: "/admin/achievements", title: "Achievements", body: "Edit achievement names and how players earn them.", permission: "achievements.manage" },
  { href: "/admin/leaderboards", title: "Leaderboards", body: "Review leaderboard seasons and standings.", permission: "leaderboards.manage" },
  { href: "/admin/bonus-transactions", title: "Bonus history", body: "Look up bonus credits already applied to wallets.", permission: "rewards.manage" },
];

export default async function GrowthPage() {
  const ctx = await requireStaff();
  const tools = TOOLS.filter((tool) => can(ctx, tool.permission)).map(({ href, title, body }) => ({ href, title, body }));
  if (tools.length === 0) redirect("/admin");

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Growth"
        description="Referrals, VIP, and rewards. Promotions and offers are in Marketing."
      />
      <AdminToolGrid tools={tools} />
    </div>
  );
}
