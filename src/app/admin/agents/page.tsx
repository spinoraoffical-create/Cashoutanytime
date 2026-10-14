import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StoreHierarchyNote } from "@/components/admin/store-hierarchy";
import { AdminQuickAction } from "@/components/admin/ui/admin-quick-action";
import { getAgentScope } from "@/lib/agents/scope";
import { can, requireStaff } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Stores and agents" };

function scopeLine(scope: NonNullable<Awaited<ReturnType<typeof getAgentScope>>>) {
  if (scope.level === "platform") {
    return `You are on the platform. You can open every store. ${scope.subCreatorIds.length} sub-creators are on file.`;
  }
  if (scope.level === "store") {
    return `You are a store. You can manage your own players and ${scope.subCreatorIds.length} sub-creators under this store.`;
  }
  const limit = scope.approveLimit == null ? "not set" : `$${scope.approveLimit}`;
  return `You are a sub-creator. You can see players who registered with your code. The deposit approval limit on file is ${limit}.`;
}

export default async function AgentsPage() {
  const ctx = await requireStaff();
  const scope = await getAgentScope();
  const tools: { href: string; title: string; body: string }[] = [];

  if (scope && scope.level !== "sub" && (ctx.isSuperAdmin || can(ctx, "users.manage") || ctx.roles.includes("store_creator"))) {
    tools.push({
      href: "/admin/sub-creators",
      title: "Stores and sub-creators",
      body:
        scope.level === "platform"
          ? "Create a store and review each store's sub-creators."
          : "Review the sub-creators under your store and the players on their codes.",
    });
  }
  if (scope?.level === "store" || scope?.level === "sub") {
    tools.push({
      href: "/admin/players",
      title: "Assigned players",
      body: "Open the players in your network. A player outside that network is not listed.",
    });
    tools.push({
      href: "/admin/agent-inbox",
      title: "Player chat",
      body: "Messages from players who registered with your code.",
    });
  }
  if (tools.length === 0) redirect("/admin");

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Store center"
        description={scope ? scopeLine(scope) : "Stores, the sub-creators under them, and the players assigned to those accounts."}
      />
      <StoreHierarchyNote />
      <div className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <AdminQuickAction key={tool.href} href={tool.href} label={tool.title} detail={tool.body} />
        ))}
      </div>
    </div>
  );
}
