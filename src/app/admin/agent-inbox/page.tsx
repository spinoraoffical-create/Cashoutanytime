import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AgentThread } from "@/components/agents/agent-thread";
import { adminDb } from "@/lib/actions/admin/core";
import { requireAgentScope } from "@/lib/agents/scope";

export const metadata: Metadata = { title: "Player chat" };

export default async function AgentInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ player?: string }>;
}) {
  const scope = await requireAgentScope();
  if (scope.level !== "sub") {
    return (
      <div className="mx-auto max-w-3xl">
        <AdminPageHeader title="Player chat" description="Players message the sub-creator on their account, not the store." />
      </div>
    );
  }
  const params = await searchParams;
  const db = adminDb();
  const { data } = await db
    .from("profiles")
    .select("id, full_name, email")
    .eq("parent_agent_id", scope.userId)
    .order("created_at", { ascending: false })
    .limit(100);
  const players = (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
  const current = players.find((row) => row.id === params.player) ?? players[0];

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[16rem_1fr]">
      <div>
        <AdminPageHeader title="Player chat" description="Only your players." />
        <ul className="space-y-1">
          {players.length === 0 ? <li className="text-sm text-muted-foreground">No players yet.</li> : null}
          {players.map((player) => (
            <li key={player.id}>
              <Link
                href={`/admin/agent-inbox?player=${player.id}`}
                className="block rounded-xl px-3 py-2 text-sm hover:bg-muted"
              >
                {player.full_name?.trim() || player.email || "Player"}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {current ? (
        <AgentThread playerId={current.id} agentId={scope.userId} selfId={scope.userId} />
      ) : null}
    </div>
  );
}
