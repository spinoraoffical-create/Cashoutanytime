import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { adminDb } from "@/lib/actions/admin/core";
import type { AgentScope } from "@/lib/agents/scope";

export async function AgentHome({ scope }: { scope: AgentScope }) {
  const db = adminDb();
  const parents = scope.parentIds;
  const { data: players } = parents.length
    ? await db
        .from("profiles")
        .select("id, full_name, email, created_at, wallet_balance")
        .in("parent_agent_id", parents)
        .order("created_at", { ascending: false })
        .limit(8)
    : { data: [] };

  const list = (players ?? []) as {
    id: string;
    full_name: string | null;
    email: string | null;
    created_at: string;
    wallet_balance: number | null;
  }[];
  const { count } = parents.length
    ? await db.from("profiles").select("id", { count: "exact", head: true }).in("parent_agent_id", parents)
    : { count: 0 };
  const { data: owned } = parents.length
    ? await db.from("profiles").select("id").in("parent_agent_id", parents).limit(1000)
    : { data: [] as { id: string }[] };
  const ownedIds = ((owned ?? []) as { id: string }[]).map((row) => row.id);
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
            : "Only players who registered with your link."
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-4">
          <p className="text-sm text-muted-foreground">Players</p>
          <p className="text-3xl font-black">{(count ?? 0).toLocaleString()}</p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-sm text-muted-foreground">Sub-creators</p>
          <p className="text-3xl font-black">{scope.subCreatorIds.length.toLocaleString()}</p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-sm text-muted-foreground">Pending deposits</p>
          <p className="text-3xl font-black">{(pending.count ?? 0).toLocaleString()}</p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-sm text-muted-foreground">Commission</p>
          <p className="text-3xl font-black">${commission.toFixed(2)}</p>
        </GlassCard>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/admin/players" className="inline-flex h-10 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background">
          View players
        </Link>
        <Link href="/admin/failed-loads" className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-semibold">
          Failed loads
        </Link>
        {scope.level === "store" ? (
          <Link href="/admin/sub-creators" className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-semibold">
            Sub-creators
          </Link>
        ) : (
          <Link href="/admin/agent-inbox" className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-semibold">
            Player chat
          </Link>
        )}
      </div>
      <GlassCard className="mt-6 p-5">
        <h2 className="font-bold">Newest players</h2>
        <ul className="mt-3 divide-y divide-border">
          {list.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">No players yet. Share your referral code from Sub-creators.</li>
          ) : (
            list.map((row) => (
              <li key={row.id} className="flex items-center justify-between py-3 text-sm">
                <Link href={`/admin/users/${row.id}`} className="font-semibold">
                  {row.full_name?.trim() || row.email || "Player"}
                </Link>
                <span>${Number(row.wallet_balance ?? 0).toFixed(2)}</span>
              </li>
            ))
          )}
        </ul>
      </GlassCard>
    </div>
  );
}
