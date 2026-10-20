import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { Button } from "@/components/ui/button";
import { formatNepalTime } from "@/lib/admin/nepal-time";
import { coinText } from "@/lib/admin/live-game-balances";
import { loadLiveGameBalances } from "@/lib/admin/live-game-balances-data";
import { requireSuperAdmin } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Live game coins" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function statusLabel(status: string, detail: string | null) {
  if (status === "live") return detail || "Live";
  if (status === "not_connected") return "Not connected";
  if (status === "paused") return "Paused";
  return detail || "Could not read this game.";
}

export default async function LiveGameBalancesPage() {
  await requireSuperAdmin();
  const rows = await loadLiveGameBalances();
  const checkedAt = formatNepalTime(new Date());

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        title="Live game coins"
        description="Coins read from each game panel when this page opens. Store coins are left on the agent login. On players are the coins sitting on player accounts. If a panel does not answer, that is a read error. It is not proof a provider transaction failed."
        action={
          <Button variant="outline" asChild>
            <Link href="/admin/game-balances">Check again</Link>
          </Button>
        }
      />
      <p className="text-sm text-[#9fb0d0]">Checked {checkedAt}</p>
      <AdminSectionCard title="Provider reads" description="These numbers come from the existing balance read. This page does not retry, refund, or complete a game load.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-[#8ea0c3]">
                <th className="px-2 py-2 font-medium">Game</th>
                <th className="px-2 py-2 text-right font-medium">Store coins</th>
                <th className="px-2 py-2 text-right font-medium">On players</th>
                <th className="px-2 py-2 text-right font-medium">Players</th>
                <th className="px-2 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-8 text-center text-[#9fb0d0]">No provider reads are available.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.slug} className="border-b border-white/5 last:border-0">
                    <td className="px-2 py-3 text-white">{row.name}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-[#e8eefc]">{coinText(row.storeCoins)}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-[#e8eefc]">{coinText(row.playerCoins)}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-[#e8eefc]">{row.playerCount == null ? "—" : row.playerCount}</td>
                    <td className="px-2 py-3">
                      <AdminStatusBadge status={row.status === "live" ? "Live" : row.status === "not_connected" ? "Not connected" : row.status === "paused" ? "Paused" : "Read error"} />
                      <p className="mt-1 text-xs text-[#9fb0d0]">{statusLabel(row.status, row.detail)}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminSectionCard>
    </div>
  );
}
