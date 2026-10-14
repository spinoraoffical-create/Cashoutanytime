import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StoreHierarchyNote } from "@/components/admin/store-hierarchy";
import { AdminQuickAction } from "@/components/admin/ui/admin-quick-action";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatCard } from "@/components/admin/ui/admin-stat-card";
import { adminDb } from "@/lib/actions/admin/core";
import type { AgentScope } from "@/lib/agents/scope";

export async function AgentHome({ scope }: { scope: AgentScope }) {
  const db = adminDb();
  const parents = scope.parentIds;
  const { data: ownedRows } = parents.length
    ? await db
        .from("profiles")
        .select("id, full_name, email, created_at, wallet_balance")
        .in("parent_agent_id", parents)
        .order("created_at", { ascending: false })
        .limit(1000)
    : { data: [] };
  const owned = (ownedRows ?? []) as {
    id: string;
    full_name: string | null;
    email: string | null;
    created_at: string;
    wallet_balance: number | null;
  }[];
  const ownedIds = owned.map((row) => row.id);
  const list = owned.slice(0, 8);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const newPlayers = owned.filter((row) => row.created_at >= weekAgo).length;
  const { count } = parents.length
    ? await db.from("profiles").select("id", { count: "exact", head: true }).in("parent_agent_id", parents)
    : { count: 0 };
  const pendingLoads = ownedIds.length
    ? await db
        .from("game_load_requests")
        .select("id", { count: "exact", head: true })
        .in("user_id", ownedIds)
        .in("status", ["pending", "processing"])
    : { count: 0 };
  const failedLoads = ownedIds.length
    ? await db
        .from("game_load_requests")
        .select("id", { count: "exact", head: true })
        .in("user_id", ownedIds)
        .eq("status", "failed")
    : { count: 0 };
  let commission = 0;
  const { data: commissionRows, error: commissionError } = parents.length
    ? await db.from("agent_commissions").select("commission_amount").in("agent_id", scope.level === "sub" ? [scope.userId] : parents)
    : { data: [], error: null };
  if (!commissionError) {
    commission = ((commissionRows ?? []) as { commission_amount: number }[]).reduce((sum, row) => sum + Number(row.commission_amount || 0), 0);
  }
  const pending = ownedIds.length
    ? await db
        .from("deposit_requests")
        .select("id", { count: "exact", head: true })
        .in("user_id", ownedIds)
        .in("status", ["pending", "processing"])
    : { count: 0 };

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
        <AdminStatCard label="Players" value={(count ?? 0).toLocaleString()} hint="Players assigned in this network." />
        <AdminStatCard label="New players, 7 days" value={newPlayers.toLocaleString()} hint="Players created in the last 7 days among the players loaded for this network." />
        <AdminStatCard label="Pending loads" value={(pendingLoads.count ?? 0).toLocaleString()} hint="Game loads still marked pending or processing." />
        <AdminStatCard label="Failed loads" value={(failedLoads.count ?? 0).toLocaleString()} hint="Game loads marked failed." />
        <AdminStatCard label="Sub-creators" value={scope.subCreatorIds.length.toLocaleString()} hint="Sub-creators on file for this account." />
        <AdminStatCard label="Pending deposits" value={(pending.count ?? 0).toLocaleString()} hint="Deposit records still marked pending or processing." />
        <AdminStatCard label="Commission" value={`$${commission.toFixed(2)}`} hint="Sum of stored commission records. This screen does not pay commission." />
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
          {list.length === 0 ? (
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
