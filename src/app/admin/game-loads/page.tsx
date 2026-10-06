import { createClient } from "@/lib/supabase/server";
import { AdminWalletLoadsPanels } from "@/components/admin/admin-wallet-loads-panels";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminGameLoadsPage() {
  const supabase = await createClient();

  const [{ data: loads }, { data: users }] = await Promise.all([
    supabase
      .from("game_load_requests")
      .select("*, user:profiles!game_load_requests_user_id_fkey(full_name, email)")
      .in("load_type", ["load", "reload", "redeem"])
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("profiles")
      .select("id, full_name, email, wallet_balance, cashout_wallet, created_at, last_seen_at")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

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
