import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminToolGrid } from "@/components/admin/admin-tool-grid";
import { getAgentScope } from "@/lib/agents/scope";
import { requireStaff } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Agent reports" };

export default async function AgentReportsPage() {
  await requireStaff();
  const scope = await getAgentScope();
  const allowed = scope?.level === "platform" || scope?.level === "store" || scope?.level === "sub";
  if (!allowed || !scope) redirect("/admin");

  const description =
    scope.level === "platform"
      ? "Super Admin. Player transactions include every store."
      : scope.level === "store"
        ? `Store Creator. Player transactions include your players and ${scope.subCreatorIds.length} sub creators.`
        : "Sub Creator. Player transactions include players who registered with your code.";

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader title="Agent reports" description={description} />
      <AdminToolGrid
        tools={[
          {
            href: "/admin/player-transactions",
            title: "Player transactions",
            body: "Deposits, loads, and cash outs for the players in your scope. This is not a commission payout.",
          },
        ]}
      />
    </div>
  );
}
