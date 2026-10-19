import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CashoutHoldActions } from "@/components/admin/cashout-hold-actions";
import { CashoutLimitForm } from "@/components/admin/cashout-limit-form";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminErrorState } from "@/components/admin/ui/admin-error-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { adminDb } from "@/lib/actions/admin/core";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Held cash outs" };

export default async function CashoutHoldsPage() {
  await requirePermission("requests.manage");
  const db = adminDb();
  const [{ data: holds, error }, { data: ops }] = await Promise.all([
    db.from("cashout_holds").select("id, user_id, amount, reason, status, created_at").eq("status", "held").order("created_at", { ascending: false }).limit(100),
    db.from("platform_ops").select("cashout_auto_limit").eq("key", "cashout").maybeSingle(),
  ]);
  const limit = Number((ops as { cashout_auto_limit?: number } | null)?.cashout_auto_limit ?? 0);
  const rows = (holds ?? []) as { id: string; user_id: string; amount: number; reason: string; created_at: string }[];

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader
        title="Held cash outs"
        description="Amounts at or under the limit go out through Paydora. Anything over the limit, or a risk flag, waits here with status held. A held cash out does not debit the wallet."
      />
      {error ? (
        <div className="mb-4">
          <AdminErrorState title="Held cash outs unavailable" body="The hold list could not be loaded. The automatic cash-out tables may still need to be applied." />
        </div>
      ) : null}
      <CashoutLimitForm limit={limit} />
      <div className="mt-4">
      <AdminSectionCard title="Held records" description="Each row is a cash-out hold marked held. Saving the limit uses the confirmation already on the form.">
        {rows.length === 0 ? <AdminEmptyState title="No held cash outs" body="New holds appear when a cash out is over the limit or flagged." /> : (
          <ul className="divide-y divide-white/10">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold text-white">${Number(row.amount).toFixed(2)}</p>
                  <p className="text-[#9fb0d0]">{row.reason}</p>
                </div>
                <div className="text-right">
                  <AdminStatusBadge status="held" />
                  <p className="mt-1 text-xs text-[#8ea0c3]">{new Date(row.created_at).toLocaleString()}</p>
                  <CashoutHoldActions holdId={row.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminSectionCard>
      </div>
    </div>
  );
}
