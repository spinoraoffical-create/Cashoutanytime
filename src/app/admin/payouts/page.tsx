import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PayoutForm } from "@/components/admin/payout-form";
import { GlassCard } from "@/components/shared/glass-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminDb } from "@/lib/actions/admin/core";
import {
  ADMIN_PROFILE_SELECT,
  profileDisplayName,
  profileHandle,
  profileNum,
  type SpinoraProfileRow,
} from "@/lib/admin/spinora-profile";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Cash-out Payouts" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminPayoutsPage() {
  await requirePermission("requests.manage");
  const db = adminDb();

  const [{ data: owed }, { data: history }] = await Promise.all([
    db
      .from("profiles")
      .select(ADMIN_PROFILE_SELECT)
      .gt("cashout_wallet", 0)
      .order("cashout_wallet", { ascending: false })
      .limit(200),
    db
      .from("wallet_transactions")
      .select("id, user_id, amount, wallet_type, transaction_type, description, created_at")
      .eq("wallet_type", "cashout")
      .eq("transaction_type", "debit")
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const players = (owed ?? []) as SpinoraProfileRow[];
  const ledger = history ?? [];

  const histUserIds = [...new Set(ledger.map((l) => l.user_id))];
  const { data: histProfs } = histUserIds.length
    ? await db.from("profiles").select(ADMIN_PROFILE_SELECT).in("id", histUserIds)
    : { data: [] };
  const nameById = new Map(
    (histProfs ?? []).map((p) => [p.id, profileDisplayName(p as SpinoraProfileRow)])
  );

  const totalOwed = players.reduce((sum, p) => sum + profileNum(p.cashout_wallet), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <AdminPageHeader
        title="Cash-out Payouts"
        description={`${players.length} player(s) awaiting payout · $${totalOwed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} owed — pay off-platform, then mark paid here to debit the cash-out balance`}
      />

      {players.length === 0 ? (
        <GlassCard className="py-16 text-center text-muted-foreground">
          No pending cash-outs. Balances appear here when players redeem winnings from a game.
        </GlassCard>
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-foreground/8 hover:bg-transparent">
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Cash-out balance</TableHead>
                  <TableHead className="text-right">Pay out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.filter((p) => p.id).map((p) => {
                  const name = profileDisplayName(p);
                  const bal = profileNum(p.cashout_wallet);
                  return (
                    <TableRow key={p.id!} className="border-foreground/8">
                      <TableCell>
                        <p className="text-sm font-medium text-foreground">{name}</p>
                        <p className="text-xs text-muted-foreground">{profileHandle(p)}</p>
                      </TableCell>
                      <TableCell className="tnum text-right text-base font-bold text-ws-emerald">
                        ${bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <PayoutForm userId={p.id!} maxAmount={bal} playerName={name} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      )}

      {ledger.length > 0 && (
        <GlassCard className="overflow-hidden">
          <div className="border-b border-foreground/8 px-6 py-4">
            <h2 className="font-bold">Recent payouts</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-foreground/8 hover:bg-transparent">
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((row) => (
                  <TableRow key={row.id} className="border-foreground/8">
                    <TableCell className="text-sm">
                      {nameById.get(row.user_id) ?? "player"}
                    </TableCell>
                    <TableCell className="tnum text-right font-semibold text-ws-emerald">
                      ${Math.abs(Number(row.amount)).toFixed(2)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {row.description ?? "—"}
                    </TableCell>
                    <TableCell className="tnum text-right text-xs text-muted-foreground">
                      {formatDate(row.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
