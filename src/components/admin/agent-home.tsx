import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StoreHierarchyNote } from "@/components/admin/store-hierarchy";
import { AdminQuickAction } from "@/components/admin/ui/admin-quick-action";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatCard } from "@/components/admin/ui/admin-stat-card";
import { adminDb } from "@/lib/actions/admin/core";
import type { AgentScope } from "@/lib/agents/scope";

function showNetworkCount(count: number | null) {
  return count == null ? "Unavailable" : count.toLocaleString();
}

async function networkIds(parents: string[]) {
  if (!parents.length) return [] as string[];
  const db = adminDb();
  const ids: string[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await db
      .from("profiles")
      .select("id")
      .in("parent_agent_id", parents)
      .order("id")
      .range(from, from + 999);
    if (error) return null;
    const rows = (data ?? []) as { id: string }[];
    ids.push(...rows.map((row) => row.id));
    if (rows.length < 1000) return ids;
  }
  return null;
}

async function countForUsers(
  table: "game_load_requests" | "deposit_requests",
  userIds: string[] | null,
  statuses: string[]
) {
  if (userIds == null) return null;
  if (!userIds.length) return 0;
  const db = adminDb();
  let total = 0;
  for (let index = 0; index < userIds.length; index += 150) {
    const chunk = userIds.slice(index, index + 150);
    const { count, error } = await db
      .from(table)
      .select("id", { count: "exact", head: true })
      .in("user_id", chunk)
      .in("status", statuses);
    if (error) return null;
    total += count ?? 0;
  }
  return total;
}

export async function AgentHome({ scope }: { scope: AgentScope }) {
  const db = adminDb();
  const parents = scope.parentIds;
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const listQuery = parents.length
    ? await db
        .from("profiles")
        .select("id, full_name, email, created_at, wallet_balance")
        .in("parent_agent_id", parents)
        .order("created_at", { ascending: false })
        .limit(8)
    : { data: [], error: null };
  const list = ((listQuery.data ?? []) as {
    id: string;
    full_name: string | null;
    email: string | null;
    created_at: string;
    wallet_balance: number | null;
  }[]);
  const playerCount = parents.length
    ? await db.from("profiles").select("id", { count: "exact", head: true }).in("parent_agent_id", parents)
    : { count: 0, error: null };
  const newPlayerCount = parents.length
    ? await db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("parent_agent_id", parents)
        .gte("created_at", weekAgo)
    : { count: 0, error: null };
  const ids = await networkIds(parents);
  const pendingLoads = await countForUsers("game_load_requests", ids, ["pending", "processing"]);
  const failedLoads = await countForUsers("game_load_requests", ids, ["failed"]);
  const pending = await countForUsers("deposit_requests", ids, ["pending", "processing"]);
  let commission: number | null = 0;
  if (parents.length) {
    const agentIds = scope.level === "sub" ? [scope.userId] : parents;
    let total = 0;
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await db
        .from("agent_commissions")
        .select("commission_amount")
        .in("agent_id", agentIds)
        .order("id")
        .range(from, from + 999);
      if (error) {
        commission = null;
        break;
      }
      const rows = (data ?? []) as { commission_amount: number }[];
      total += rows.reduce((sum, row) => sum + Number(row.commission_amount || 0), 0);
      commission = total;
      if (rows.length < 1000) break;
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title={scope.level === "store" ? "Store dashboard" : "Your players"}
        description={
          scope.level === "store"
            ? "Your sub-creators, their players, and deposits waiting on your network."
            : "Only players who registered with your code."
        }
      />
      <StoreHierarchyNote />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard label="Players" value={showNetworkCount(playerCount.error ? null : playerCount.count ?? 0)} hint="Players assigned in this network." />
        <AdminStatCard label="New players, 7 days" value={showNetworkCount(newPlayerCount.error ? null : newPlayerCount.count ?? 0)} hint="Players created in the last 7 days in this network." />
        <AdminStatCard label="Pending loads" value={showNetworkCount(pendingLoads)} hint="Game loads still marked pending or processing, counted for the whole network." />
        <AdminStatCard label="Failed loads" value={showNetworkCount(failedLoads)} hint="Game loads marked failed, counted for the whole network." />
        <AdminStatCard label="Sub-creators" value={scope.subCreatorIds.length.toLocaleString()} hint="Sub-creators on file for this account." />
        <AdminStatCard label="Pending deposits" value={showNetworkCount(pending)} hint="Deposit records still marked pending or processing, counted for the whole network." />
        <AdminStatCard label="Commission" value={commission == null ? "Unavailable" : `$${commission.toFixed(2)}`} hint="Sum of stored commission records. This screen does not pay commission." />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <AdminQuickAction href="/admin/players" label="View players" detail="Open the players assigned in this network." />
        <AdminQuickAction href="/admin/failed-loads" label="Failed loads" detail="Open game loads marked failed." />
        {scope.level === "store" ? (
          <AdminQuickAction href="/admin/sub-creators" label="Sub-creators" detail="Open the sub-creators under this store." />
        ) : null}
        <AdminQuickAction href="/admin/agent-inbox" label="Player chat" detail="Open messages from players on this account." />
      </div>
      <div className="mt-6">
      <AdminSectionCard title="Newest players" description="Stored wallet balance for each player. Opening a player does not change that balance.">
        <ul className="divide-y divide-white/10">
          {listQuery.error ? (
            <li className="py-3 text-sm text-[#9fb0d0]">The player list could not be loaded.</li>
          ) : list.length === 0 ? (
            <li className="py-3 text-sm text-[#9fb0d0]">No players yet. Share your signup code from Stores and sub-creators.</li>
          ) : (
            list.map((row) => (
              <li key={row.id} className="flex items-center justify-between py-3 text-sm">
                <Link href={`/admin/users/${row.id}`} className="font-semibold text-white">
                  {row.full_name?.trim() || row.email || "Player"}
                </Link>
                <span className="tabular-nums text-[#e8eefc]">${Number(row.wallet_balance ?? 0).toFixed(2)}</span>
              </li>
            ))
          )}
        </ul>
      </AdminSectionCard>
      </div>
    </div>
  );
}
