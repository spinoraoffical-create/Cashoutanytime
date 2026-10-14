import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminQuickAction } from "@/components/admin/ui/admin-quick-action";
import { getAgentScope } from "@/lib/agents/scope";
import { can, requireStaff } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Games" };

export default async function GameAccountsPage() {
  const ctx = await requireStaff();
  const scope = await getAgentScope();
  const network = scope?.level === "store" || scope?.level === "sub";
  const tools: { href: string; title: string; body: string }[] = [];

  if (can(ctx, "cms.manage")) {
    tools.push({
      href: "/admin/games",
      title: "Games catalog",
      body: "Turn games on, edit names, and set download links. Saved provider passwords stay hidden.",
    });
  }
  if (can(ctx, "requests.manage") && !network) {
    tools.push({
      href: "/admin/game-loads",
      title: "Wallet loads and redeems",
      body: "See each player's load and redeem queue. Complete and Failed can change a wallet.",
    });
  }
  if (network || can(ctx, "requests.manage")) {
    tools.push({
      href: "/admin/failed-loads",
      title: "Failed loads",
      body: "Game loads marked failed. A retry does not credit the deposit again.",
    });
  }
  if (ctx.isSuperAdmin) {
    tools.push({
      href: "/admin/game-balances",
      title: "Live game coins",
      body: "Read the provider balance for a player. Super Admin only. A read error is not proof a transaction failed.",
    });
  }
  if (tools.length === 0) redirect("/admin");

  const who =
    scope?.level === "store"
      ? "You are a store. Load tools stay limited to your players."
      : scope?.level === "sub"
        ? "You are a sub-creator. Load tools stay limited to your players."
        : scope?.level === "platform"
          ? "You are on the platform. The game catalog and live coin reads are in this list."
          : "Each page still checks who you are allowed to see.";

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader title="Game center" description={who} />
      <div className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <AdminQuickAction key={tool.href} href={tool.href} label={tool.title} detail={tool.body} />
        ))}
      </div>
    </div>
  );
}
