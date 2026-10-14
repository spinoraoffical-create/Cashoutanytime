import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminDataTable } from "@/components/admin/ui/admin-data-table";
import { AdminErrorState } from "@/components/admin/ui/admin-error-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PAYOUT_STATUSES,
  loadPayoutOperations,
  payoutStatusHelp,
  resolvePayoutReadPlan,
} from "@/lib/admin/payout-operations";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Payout activity" };

function hrefFor(q: string, status: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `/admin/payout-operations?${text}` : "/admin/payout-operations";
}

export default async function PayoutOperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const plan = await resolvePayoutReadPlan();
  if (plan.action === "deny") redirect("/admin");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = params.status ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const loaded =
    plan.action === "query"
      ? await loadPayoutOperations({ scope: plan.scope, q, status, page })
      : { rows: [], total: 0, error: plan.action === "error" ? plan.message : null, page, pageSize: 20 };
  const totalPages = Math.max(1, Math.ceil(loaded.total / loaded.pageSize));

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Payout activity"
        description="Read-only payout records. This page does not send, retry, or refund a payment. Submitted does not mean paid. Failed does not mean refunded."
      />
      <p className="mb-4 text-sm text-[#9fb0d0]">
        Manual review requires investigation before any further money action. A failed status does not by itself show that a refund was posted.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={hrefFor(q, "", 1)}
          className={cn(
            "inline-flex min-h-9 items-center rounded-full border px-4 py-1.5 text-sm font-semibold",
            status ? "border-white/10 text-[#9fb0d0]" : "border-transparent bg-gradient-to-r from-[#6d28d9] to-[#2563eb] text-white"
          )}
        >
          All statuses
        </Link>
        {PAYOUT_STATUSES.map((item) => (
          <Link
            key={item}
            href={hrefFor(q, item, 1)}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full border px-4 py-1.5 text-sm font-semibold capitalize",
              status === item
                ? "border-transparent bg-gradient-to-r from-[#6d28d9] to-[#2563eb] text-white"
                : "border-white/10 text-[#9fb0d0]"
            )}
          >
            {item.replaceAll("_", " ")}
          </Link>
        ))}
      </div>
      <p className="mb-4 text-sm text-[#9fb0d0]">{status ? payoutStatusHelp(status) : "Each filter shows one stored status. Pending and paid records stay separate."}</p>

      <form className="mb-4 flex flex-col gap-2 sm:flex-row" action="/admin/payout-operations">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by player name, email, or record id"
          aria-label="Search payout activity"
          className="border-white/10 bg-[#0b1224] text-white placeholder:text-[#8ea0c3]"
        />
        <Button type="submit" variant="outline" className="border-white/15 bg-transparent text-white">
          Search
        </Button>
      </form>

      {loaded.error ? (
        <AdminErrorState title="Payout activity unavailable" body={loaded.error} />
      ) : (
        <AdminSectionCard title="Payout records" description={`${loaded.total.toLocaleString()} records match this view.`}>
          <AdminDataTable
            columns={[
              { key: "player", label: "Player" },
              { key: "amount", label: "Amount", align: "right" },
              { key: "status", label: "Status" },
              { key: "updated", label: "Updated" },
              { key: "open", label: "Open", align: "right" },
            ]}
            rows={loaded.rows.map((row) => ({
              player: (
                <div>
                  <p className="font-medium text-white">{row.playerName}</p>
                  <p className="text-xs text-[#9fb0d0]">{row.playerEmail || "No email"}</p>
                </div>
              ),
              amount: `$${row.amount.toFixed(2)}`,
              status: <AdminStatusBadge status={row.status.replaceAll("_", " ")} />,
              updated: row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "Unavailable",
              open: (
                <Link href={`/admin/payout-operations/${row.id}`} className="font-semibold text-cyan-200">
                  Details
                </Link>
              ),
            }))}
            emptyTitle="No payout records"
            emptyBody={q || status ? "Nothing matches this search and status." : "Payout records will show here after a cash-out request is saved."}
          />
        </AdminSectionCard>
      )}

      {loaded.total > loaded.pageSize ? (
        <div className="mt-4 flex items-center justify-between">
          <Button asChild variant="outline" size="sm" className={cn("border-white/15 bg-transparent text-white", page <= 1 && "pointer-events-none opacity-50")}>
            <Link href={hrefFor(q, status, page - 1)}>Previous</Link>
          </Button>
          <p className="text-sm tabular-nums text-[#9fb0d0]">Page {page} of {totalPages}</p>
          <Button asChild variant="outline" size="sm" className={cn("border-white/15 bg-transparent text-white", page >= totalPages && "pointer-events-none opacity-50")}>
            <Link href={hrefFor(q, status, page + 1)}>Next</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
