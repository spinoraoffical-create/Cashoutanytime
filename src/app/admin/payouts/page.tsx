import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PayoutForm } from "@/components/admin/payout-form";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminDb } from "@/lib/actions/admin/core";
import { adminListScope, idsOrNone } from "@/lib/admin/list-scope";
import {
  ADMIN_PROFILE_SELECT,
  profileDisplayName,
  profileHandle,
  profileNum,
  type ProfileRow,
} from "@/lib/admin/spinora-profile";
import { readAgentScope } from "@/lib/agents/scope";
import { can, getStaffContext } from "@/lib/data/admin";

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
  const ctx = await getStaffContext();
  const scopeResult = await readAgentScope();
  const decision = adminListScope({
    isSuperAdmin: Boolean(ctx?.isSuperAdmin),
    hasStaffPermission: Boolean(ctx && can(ctx, "requests.manage")),
    scopeStatus: scopeResult.status,
    scope: scopeResult.scope
      ? { level: scopeResult.scope.level, parentIds: scopeResult.scope.parentIds }
      : null,
  });
  if (decision.mode === "deny") redirect("/admin");
  const db = adminDb();

  let owedQuery = db
    .from("profiles")
    .select(ADMIN_PROFILE_SELECT)
    .gt("cashout_wallet", 0)
    .order("cashout_wallet", { ascending: false })
    .limit(200);
  let historyQuery = db
    .from("wallet_transactions")
    .select("id, user_id, amount, wallet_type, transaction_type, description, created_at")
    .eq("wallet_type", "cashout")
    .eq("transaction_type", "debit")
    .order("created_at", { ascending: false })
    .limit(25);
  if (decision.mode === "network") {
    const parents = idsOrNone(decision.parentIds);
    owedQuery = owedQuery.in("parent_agent_id", parents);
    const { data: owned } = decision.parentIds.length
      ? await db.from("profiles").select("id").in("parent_agent_id", decision.parentIds).limit(1000)
      : { data: [] as { id: string }[] };
    historyQuery = historyQuery.in(
      "user_id",
      idsOrNone(((owned ?? []) as { id: string }[]).map((row) => row.id))
    );
  }

  const [{ data: owed }, { data: history }] = await Promise.all([owedQuery, historyQuery]);

  const players = (owed ?? []) as ProfileRow[];
  const ledger = history ?? [];

  const histUserIds = [...new Set(ledger.map((l) => l.user_id))];
  const { data: histProfs } = histUserIds.length
    ? await db.from("profiles").select(ADMIN_PROFILE_SELECT).in("id", histUserIds)
    : { data: [] };
  const nameById = new Map(
    (histProfs ?? []).map((p) => [p.id, profileDisplayName(p as ProfileRow)])
  );

  const totalOwed = players.reduce((sum, p) => sum + profileNum(p.cashout_wallet), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <AdminPageHeader
        title="Cash outs"
        description={`${players.length} player${players.length === 1 ? "" : "s"} with a cash-out balance. Combined balance $${totalOwed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. This is a balance total. Mark paid records a payout and removes the amount from the cash-out wallet.`}
      />

      {players.length === 0 ? (
        <AdminEmptyState title="No cash-out balances" body="Balances appear here when a player has money in the cash-out wallet." />
      ) : (
        <AdminSectionCard title="Waiting for a recorded payout" description="These rows are cash-out wallet balances. Mark paid records the payout on this screen.">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
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
                    <TableRow key={p.id!} className="border-white/10">
                      <TableCell>
                        <p className="text-sm font-medium text-white">{name}</p>
                        <p className="text-xs text-[#9fb0d0]">{profileHandle(p)}</p>
                      </TableCell>
                      <TableCell className="text-right text-base font-bold tabular-nums text-white">
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
        </AdminSectionCard>
      )}

      {ledger.length > 0 && (
        <AdminSectionCard title="Recorded cash-out debits" description="The latest cash-out wallet debit rows already stored.">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((row) => (
                  <TableRow key={row.id} className="border-white/10">
                    <TableCell className="text-sm">
                      {nameById.get(row.user_id) ?? "player"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-white">
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
        </AdminSectionCard>
      )}
    </div>
  );
}
