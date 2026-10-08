import { redirect } from "next/navigation";

import { AdminWalletLoadsPanels } from "@/components/admin/admin-wallet-loads-panels";
import { adminDb } from "@/lib/actions/admin/core";
import { getAgentScope } from "@/lib/agents/scope";
import { can, getStaffContext } from "@/lib/data/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminGameLoadsPage() {
  const ctx = await getStaffContext();
  const scope = await getAgentScope();
  const platform = Boolean(ctx && (ctx.isSuperAdmin || can(ctx, "requests.manage")));
  const network = scope && (scope.level === "store" || scope.level === "sub");
  if (!platform && !network) redirect("/admin");

  const db = platform ? await createClient() : adminDb();
  let userIds: string[] | null = null;
  if (network && !platform && scope) {
    const { data: owned } = scope.parentIds.length
      ? await adminDb().from("profiles").select("id").in("parent_agent_id", scope.parentIds).limit(1000)
      : { data: [] as { id: string }[] };
    userIds = ((owned ?? []) as { id: string }[]).map((row) => row.id);
  }

  let loadsQuery = db
    .from("game_load_requests")
    .select("*, user:profiles!game_load_requests_user_id_fkey(full_name, email)")
    .in("load_type", ["load", "reload", "redeem"])
    .order("created_at", { ascending: false })
    .limit(500);
  let usersQuery = db
    .from("profiles")
    .select("id, full_name, email, wallet_balance, cashout_wallet, created_at, last_seen_at")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (userIds) {
    const ids = userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"];
    loadsQuery = loadsQuery.in("user_id", ids);
    usersQuery = usersQuery.in("id", ids);
  }

  const [{ data: loads }, { data: users }] = await Promise.all([loadsQuery, usersQuery]);

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Wallet Loads</h1>
        <p className="text-sm text-slate-400 sm:text-base">
          Browse every player&apos;s deposit loads and redeems — pending requests shown first.
          Click any row to open their full load history. Updates live.
        </p>
      </div>

      <AdminWalletLoadsPanels loads={loads ?? []} users={users ?? []} />
    </div>
  );
}
