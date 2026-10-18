import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { loadTransactionTrace } from "@/lib/admin/transaction-explorer-data";
import { walletMovementCount } from "@/lib/admin/transaction-explorer";
import { getStaffContext } from "@/lib/data/admin";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Transaction explorer" };

export default async function TransactionExplorerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await getStaffContext();
  if (!ctx?.isSuperAdmin) redirect("/admin");
  const { q } = await searchParams;
  const loaded = await loadTransactionTrace(q);
  const movements = walletMovementCount(loaded.events);

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader
        title="Transaction explorer"
        description="Read-only. Search a player, email, user id, transaction id, game-load id, deposit id, or provider reference. Wallet movements are listed separately from requests and provider updates."
      />
      <form className="mb-4 flex flex-col gap-2 sm:flex-row" action="/admin/transaction-explorer">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Name, email, id, or provider reference"
          className="min-h-11 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white"
        />
        <button className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black" type="submit">
          Search
        </button>
      </form>
      {loaded.query.kind === "empty" ? (
        <AdminEmptyState title="Enter a search" body="Nothing is loaded until you search. This page does not move money." />
      ) : loaded.events.length === 0 ? (
        <AdminEmptyState title="No stored evidence" body="That search did not match a player, wallet row, deposit, game load, payment intent, or payout." />
      ) : (
        <AdminSectionCard title="Linked events" description={`${movements} wallet movement${movements === 1 ? "" : "s"}. This count is not a balance and is not added to requests or payouts.`}>
          <ol className="space-y-3">
            {loaded.events.map((event) => (
              <li key={`${event.evidence}-${event.at}`} className="rounded-xl border border-white/10 p-3">
                <p className="text-sm font-semibold text-white">{event.title}</p>
                <p className="mt-1 text-sm text-[#9fb0d0]">{event.detail || "No extra detail stored."}</p>
                <p className="mt-1 text-xs text-[#8ea0c3]">
                  {event.at.startsWith("1970") ? "Player match" : formatDate(event.at)} · {event.evidence}
                </p>
                <p className="mt-1 text-xs font-semibold text-amber-200">{event.verified ? "Stored record" : "Not verified"}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-[#9fb0d0]">
            <Link className="underline" href="/admin/reconciliation">Open reconciliation</Link>
          </p>
        </AdminSectionCard>
      )}
    </div>
  );
}
