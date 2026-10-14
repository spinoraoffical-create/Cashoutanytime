import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
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
  if (scope.level !== "sub" && scope.level !== "store") {
    return (
      <div className="mx-auto max-w-3xl">
        <AdminPageHeader title="Player chat" description="Live chat stays with the creator on the player's account. Tickets stay with Super Admin." />
      </div>
    );
  }
  const params = await searchParams;
  const db = adminDb();
  const { data: threadRows } = await db
    .from("agent_messages")
    .select("player_id")
    .eq("agent_id", scope.userId)
    .order("created_at", { ascending: false })
    .limit(200);
  const playerIds = [
    ...new Set(((threadRows ?? []) as { player_id: string }[]).map((row) => row.player_id)),
  ];
  const { data } = playerIds.length
    ? await db
        .from("profiles")
        .select("id, full_name, email")
        .in("id", playerIds)
        .eq("parent_agent_id", scope.userId)
    : { data: [] };
  const players = (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
  const current = players.find((row) => row.id === params.player) ?? players[0] ?? null;

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[16rem_1fr]">
      <div>
        <AdminPageHeader title="Player chat" description="Only players assigned to this store or sub-creator. A player outside this account is not listed." />
        {players.length === 0 ? (
          <AdminEmptyState title="No chats yet" body="Messages appear here after a player assigned to this account writes in." />
        ) : (
          <ul className="space-y-1">
            {players.map((player) => (
              <li key={player.id}>
                <Link
                  href={`/admin/agent-inbox?player=${player.id}`}
                  className={
                    current?.id === player.id
                      ? "block rounded-xl bg-gradient-to-r from-[#6d28d9] to-[#2563eb] px-3 py-2 text-sm font-semibold text-white"
                      : "block rounded-xl px-3 py-2 text-sm text-[#d5def2] hover:bg-white/5"
                  }
                >
                  {player.full_name?.trim() || player.email || "Player"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {current ? (
        <AgentThread playerId={current.id} agentId={scope.userId} selfId={scope.userId} />
      ) : null}
    </div>
  );
}
