import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CashoutLimitForm } from "@/components/admin/cashout-limit-form";
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
        description="Amounts at or under the limit go out through Paydora. Anything over the limit, or a risk flag, waits here and does not debit the wallet."
      />
      {error ? (
        <p className="mb-4 text-sm text-destructive">Apply supabase/migrations/20261008000130_auto_ops.sql to turn on automatic cash outs.</p>
      ) : null}
      <CashoutLimitForm limit={limit} />
      <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
        {rows.length === 0 ? <li className="p-6 text-sm text-muted-foreground">No held cash outs.</li> : null}
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 p-4 text-sm">
            <div>
              <p className="font-semibold">${Number(row.amount).toFixed(2)}</p>
              <p className="text-muted-foreground">{row.reason}</p>
            </div>
            <span className="text-muted-foreground">{new Date(row.created_at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
