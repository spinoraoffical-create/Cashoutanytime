import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { coinText } from "@/lib/admin/live-game-balances";
import { loadLiveGameBalances } from "@/lib/admin/live-game-balances-data";
import { requireSuperAdmin } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Live game coins" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function statusLabel(status: string, detail: string | null) {
  if (status === "live") return detail || "Live";
  if (status === "not_connected") return "Not connected";
  return detail || "Could not read this game.";
}

export default async function LiveGameBalancesPage() {
  await requireSuperAdmin();
  const rows = await loadLiveGameBalances();
  const checkedAt = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        title="Live game coins"
        description="Coins read from each game panel just now. Store coins are left on the agent login. On players are the coins sitting on player accounts."
        action={
          <Button variant="outline" asChild>
            <Link href="/admin/game-balances">Check again</Link>
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">Checked {checkedAt}</p>
      <GlassCard className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Game</TableHead>
              <TableHead className="text-right">Store coins</TableHead>
              <TableHead className="text-right">On players</TableHead>
              <TableHead className="text-right">Players</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.slug}>
                <TableCell>{row.name}</TableCell>
                <TableCell className="text-right">{coinText(row.storeCoins)}</TableCell>
                <TableCell className="text-right">{coinText(row.playerCoins)}</TableCell>
                <TableCell className="text-right">{row.playerCount == null ? "—" : row.playerCount}</TableCell>
                <TableCell className="text-muted-foreground">{statusLabel(row.status, row.detail)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>
    </div>
  );
}
