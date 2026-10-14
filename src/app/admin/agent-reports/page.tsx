import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StoreHierarchyNote } from "@/components/admin/store-hierarchy";
import { AdminQuickAction } from "@/components/admin/ui/admin-quick-action";
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
      ? "You are on the platform. Player transactions include every store."
      : scope.level === "store"
        ? `You are a store. Player transactions include your players and ${scope.subCreatorIds.length} sub-creators.`
        : "You are a sub-creator. Player transactions include players who registered with your code.";

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader title="Store reports" description={description} />
      <StoreHierarchyNote />
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminQuickAction
          href="/admin/player-transactions"
          label="Player transactions"
          detail="Deposits, loads, and cash outs for the players in your scope. This is not a commission payout."
        />
      </div>
    </div>
  );
}
