import { createClient } from "@/lib/supabase/server";
import { AdminWalletLoadsPanels } from "@/components/admin/admin-wallet-loads-panels";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminGameLoadsPage() {
  const supabase = await createClient();

  const { data: loads } = await supabase
    .from("game_load_requests")
    .select("*, user:profiles!game_load_requests_user_id_fkey(full_name, email)")
    .in("load_type", ["load", "reload", "redeem"])
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Wallet Loads</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Loads and redeems from <strong className="text-foreground font-medium">Total Deposit</strong> only.
          Account creation is not shown here. Updates live when users request loads.
        </p>
      </div>

      <AdminWalletLoadsPanels loads={loads ?? []} lazyUsers />
    </div>
  );
}
