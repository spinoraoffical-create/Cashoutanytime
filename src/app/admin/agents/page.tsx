import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminToolGrid } from "@/components/admin/admin-tool-grid";
import { getAgentScope } from "@/lib/agents/scope";
import { can, requireStaff } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Agents" };

function scopeLine(scope: NonNullable<Awaited<ReturnType<typeof getAgentScope>>>) {
  if (scope.level === "platform") {
    return `Super Admin. You can open every store. ${scope.subCreatorIds.length} sub creators are on file.`;
  }
  if (scope.level === "store") {
    return `Store Creator. You can manage your own players and ${scope.subCreatorIds.length} sub creators.`;
  }
  const limit = scope.approveLimit == null ? "not set" : String(scope.approveLimit);
  return `Sub Creator. You can see players who registered with your code. Deposit approval limit on file: ${limit}.`;
}

export default async function AgentsPage() {
  const ctx = await requireStaff();
  const scope = await getAgentScope();
  const tools: { href: string; title: string; body: string }[] = [];

  if (scope && scope.level !== "sub" && (ctx.isSuperAdmin || can(ctx, "users.manage") || ctx.roles.includes("store_creator"))) {
    tools.push({
      href: "/admin/sub-creators",
      title: "Store and sub creators",
      body:
        scope.level === "platform"
          ? "Create a store and review each store's sub creators."
          : "Review the sub creators under your store and the players on their codes.",
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
        title="Agents"
        description={scope ? scopeLine(scope) : "Store creators and the sub creators under them."}
      />
      <AdminToolGrid tools={tools} />
    </div>
  );
}
