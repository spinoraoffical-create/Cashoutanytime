import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminToolGrid } from "@/components/admin/admin-tool-grid";
import { getAgentScope } from "@/lib/agents/scope";
import { can, requireStaff } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Game accounts" };

export default async function GameAccountsPage() {
  const ctx = await requireStaff();
  const scope = await getAgentScope();
  const network = scope?.level === "store" || scope?.level === "sub";
  const tools: { href: string; title: string; body: string }[] = [];

  if (can(ctx, "cms.manage")) {
    tools.push({
      href: "/admin/games",
      title: "Games catalog",
      body: "Turn games on, edit names, and set download links.",
    });
  }
  if (can(ctx, "requests.manage") && !network) {
    tools.push({
      href: "/admin/game-loads",
      title: "Wallet loads and redeems",
      body: "See each player's load and redeem queue.",
    });
  }
  if (network || can(ctx, "requests.manage")) {
    tools.push({
      href: "/admin/failed-loads",
      title: "Failed loads",
      body: "Game loads that did not finish. Retry does not credit the deposit again.",
    });
  }
  if (ctx.isSuperAdmin) {
    tools.push({
      href: "/admin/game-balances",
      title: "Live game coins",
      body: "Read the provider balance for a player. Super Admin only.",
    });
  }
  if (tools.length === 0) redirect("/admin");

  const who =
    scope?.level === "store"
      ? "Store Creator. Load tools stay limited to your players."
      : scope?.level === "sub"
        ? "Sub Creator. Load tools stay limited to your players."
        : scope?.level === "platform"
          ? "Super Admin. Game catalog and live coin reads are in this list."
          : "Existing game tools. Each page still checks who you are allowed to see.";

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader title="Game accounts" description={who} />
      <AdminToolGrid tools={tools} />
    </div>
  );
}
