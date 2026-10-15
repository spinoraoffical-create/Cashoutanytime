import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminWalletLoadsPanels, type GameLoadCounts, type GameLoadView } from "@/components/admin/admin-wallet-loads-panels";
import { AdminStatCard } from "@/components/admin/ui/admin-stat-card";
import { adminDb } from "@/lib/actions/admin/core";
import { GAME_LOAD_OPEN_STATUSES } from "@/lib/admin/game-load-status";
import { getAgentScope } from "@/lib/agents/scope";
import { can, getStaffContext } from "@/lib/data/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EMPTY_SCOPE = "00000000-0000-0000-0000-000000000000";

function showCount(value: number | null) {
  return value == null ? "Unavailable" : value.toLocaleString();
}

function loadView(params: { view?: string; status?: string }): GameLoadView {
  if (params.status === "failed" || params.view === "failed") return "failed";
  if (params.view === "all") return "all";
  if (params.view === "completed") return "completed";
  return "attention";
}

export default async function AdminGameLoadsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string; players?: string }>;
}) {
  const ctx = await getStaffContext();
  const scope = await getAgentScope();
  const network = scope && (scope.level === "store" || scope.level === "sub");
  const platform = Boolean(ctx && (ctx.isSuperAdmin || can(ctx, "requests.manage")) && !network);
  if (!platform && !network) redirect("/admin");

  const params = await searchParams;
  const view = loadView(params);
  const showAllPlayers = params.players === "all";

  const db = platform ? await createClient() : adminDb();
  const loadsDb = adminDb();
  let userIds: string[] | null = null;
  if (network && scope) {
    const { data: owned } = scope.parentIds.length
      ? await adminDb().from("profiles").select("id").in("parent_agent_id", scope.parentIds).limit(1000)
      : { data: [] as { id: string }[] };
    userIds = ((owned ?? []) as { id: string }[]).map((row) => row.id);
  }
  const scopeIds = userIds ? (userIds.length ? userIds : [EMPTY_SCOPE]) : null;

  async function countStatus(status: string): Promise<number | null> {
    let query = loadsDb.from("game_load_requests").select("id", { count: "exact", head: true }).eq("status", status);
    if (scopeIds) query = query.in("user_id", scopeIds);
    const { count, error } = await query;
    if (error) return null;
    return count ?? 0;
  }

  async function loadRows(statuses?: readonly string[], limit = 500) {
    let query = loadsDb
      .from("game_load_requests")
      .select("*, user:profiles!game_load_requests_user_id_fkey(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (statuses) query = query.in("status", [...statuses]);
    if (scopeIds) query = query.in("user_id", scopeIds);
    const { data } = await query;
    return data ?? [];
  }

  let usersQuery = db
    .from("profiles")
    .select("id, full_name, email, wallet_balance, cashout_wallet, created_at, last_seen_at")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (scopeIds) usersQuery = usersQuery.in("id", scopeIds);

  const [pending, processing, completed, failed, recent, openRows, usersResult] = await Promise.all([
    countStatus("pending"),
    countStatus("processing"),
    countStatus("completed"),
    countStatus("failed"),
    loadRows(undefined, 500),
    loadRows(GAME_LOAD_OPEN_STATUSES, 1000),
    usersQuery,
  ]);

  const loadsById = new Map<string, (typeof recent)[number]>();
  for (const row of [...recent, ...openRows]) loadsById.set(row.id, row);
  const loads = [...loadsById.values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  const counts: GameLoadCounts = { pending, processing, completed, failed };

  return (
    <div>
      <AdminPageHeader
        title="Loads and redeems"
        description="Needs attention lists every pending and processing game-load request, including new game accounts. Completed and failed requests stay in their own filters."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Pending" value={showCount(pending)} hint="Game-load requests still marked pending." href="/admin/game-loads" />
        <AdminStatCard label="Processing" value={showCount(processing)} hint="Game-load requests still marked processing." href="/admin/game-loads" />
        <AdminStatCard label="Completed" value={showCount(completed)} hint="Game-load requests marked completed." href="/admin/game-loads?view=completed" />
        <AdminStatCard label="Failed" value={showCount(failed)} hint="Game-load requests marked failed." href="/admin/game-loads?status=failed" />
      </div>

      <AdminWalletLoadsPanels
        loads={loads}
        users={usersResult.data ?? []}
        counts={counts}
        view={view}
        showAllPlayers={showAllPlayers}
      />
    </div>
  );
}
