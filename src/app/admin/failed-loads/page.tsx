import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminErrorState } from "@/components/admin/ui/admin-error-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { adminDb } from "@/lib/actions/admin/core";
import {
  ownerLoadState,
  rejectedLoadMissingRefund,
  stuckOpenLoad,
  uncertainProviderMessage,
  type LoadAlertRow,
} from "@/lib/admin/reconciliation-rules";
import { getStaffContext, can } from "@/lib/data/admin";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Failed loads" };

function needsInvestigation(row: LoadAlertRow, now: number) {
  return (
    row.status === "failed" ||
    rejectedLoadMissingRefund(row, now) ||
    uncertainProviderMessage(row.error_message) ||
    stuckOpenLoad(row, now)
  );
}

export default async function FailedLoadsPage() {
  const ctx = await getStaffContext();
  if (!ctx?.isSuperAdmin && !(ctx && can(ctx, "requests.manage"))) redirect("/admin");
  const db = adminDb();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const now = Date.now();
  const { data, error } = await db
    .from("game_load_requests")
    .select("id, amount, load_type, status, wallet_refunded, game_api_debited, error_message, created_at, game_username, game_name")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = ((data ?? []) as Array<LoadAlertRow & { game_name?: string }>).filter((row) => needsInvestigation(row, now));

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader
        title="Failed loads"
        description="Last 7 days. Failed loads, failed redeems, missing refunds, unknown provider results, and requests still open after 30 minutes. Investigate does not move money."
      />
      {error ? <AdminErrorState title="Could not load game requests" body="This page is not showing zero failures. The list could not be read." /> : null}
      {!error && rows.length === 0 ? (
        <AdminEmptyState title="Nothing in this check needs investigation" body="The full game-transaction list is still available. This view only keeps problem rows." />
      ) : null}
      <div className="space-y-3">
        {rows.map((row) => {
          const state = ownerLoadState(row);
          const next = state === "Reconciliation required"
            ? "Do not refund from this screen. Open the record and confirm the ledger before any refund."
            : state === "Outcome unknown"
              ? "Do not retry while the provider result is unknown."
              : "Read the stored error, then open the timeline.";
          return (
            <AdminSectionCard key={row.id} title={row.game_name || row.game_username || "Game request"} description={state}>
              <p className="text-sm text-white">${Number(row.amount ?? 0).toFixed(2)} · {row.load_type} · stored status {row.status}</p>
              <p className="mt-1 text-sm text-[#9fb0d0]">{row.game_username || "No game login stored"} · {formatDate(row.created_at)}</p>
              <p className="mt-1 text-sm text-[#9fb0d0]">Wallet refund saved: {row.wallet_refunded ? "yes" : "no"}. Provider debit saved: {row.game_api_debited ? "yes" : "no"}.</p>
              {row.error_message ? <p className="mt-2 text-sm text-amber-100">{row.error_message}</p> : null}
              <p className="mt-2 text-sm text-[#9fb0d0]">{next}</p>
              <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-cyan-200 underline" href={`/admin/transaction-explorer?q=${row.id}`}>
                Investigate
              </Link>
            </AdminSectionCard>
          );
        })}
      </div>
    </div>
  );
}
