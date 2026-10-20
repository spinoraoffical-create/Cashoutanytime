import type { Metadata } from "next";
import { formatNepalTime } from "@/lib/admin/nepal-time";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import { PromotionFormDialog } from "@/components/admin/promotion-form-dialog";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { deletePromotionAction } from "@/lib/actions/admin/promotions";
import { adminDb } from "@/lib/actions/admin/core";
import { requirePermission } from "@/lib/data/admin";
import { promotionStatusHelp } from "@/lib/admin/marketing-status";

export const metadata: Metadata = { title: "Promotions" };

export default async function AdminPromotionsPage() {
  await requirePermission("promotions.manage");
  const db = adminDb();

  const { data: promotions } = await db
    .from("promotions")
    .select("*")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });

  const list = promotions ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <AdminPageHeader
        title="Promotions"
        description="Draft, scheduled, active, expired, and archived are the stored statuses. Edit and delete change the promotion record. They do not send email or SMS from this screen."
        action={<PromotionFormDialog />}
      />

      <AdminSectionCard title="Promotion list" description="The reward columns are the stored coin and XP amounts on the promotion. This page does not pay them out.">
        {list.length === 0 ? (
          <AdminEmptyState title="No promotions yet" body="Create a promotion to save a draft. Creating one does not email players." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-[#8ea0c3]">
                  <th className="px-2 py-2 font-medium">Promotion</th>
                  <th className="px-2 py-2 text-right font-medium">Reward</th>
                  <th className="px-2 py-2 text-right font-medium">Window</th>
                  <th className="px-2 py-2 text-right font-medium">Status</th>
                  <th className="px-2 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 align-top last:border-0">
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-white">{p.title}</span>
                        {p.is_featured ? <AdminStatusBadge status="Featured" /> : null}
                      </div>
                      <p className="text-xs text-[#9fb0d0]">/{p.slug}</p>
                    </td>
                    <td className="px-2 py-3 text-right text-sm tabular-nums text-[#e8eefc]">
                      {p.coins_bonus > 0 ? <span>{p.coins_bonus.toLocaleString()} coins</span> : null}
                      {p.coins_bonus > 0 && p.xp_bonus > 0 ? " · " : null}
                      {p.xp_bonus > 0 ? <span>{p.xp_bonus.toLocaleString()} XP</span> : null}
                      {p.coins_bonus <= 0 && p.xp_bonus <= 0 ? "—" : null}
                    </td>
                    <td className="px-2 py-3 text-right text-xs tabular-nums text-[#9fb0d0]">
                      {p.starts_at ? formatNepalTime(p.starts_at) : "—"}
                      {" → "}
                      {p.ends_at ? formatNepalTime(p.ends_at) : "∞"}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <AdminStatusBadge status={p.status} />
                      <p className="mt-1 text-xs leading-5 text-[#9fb0d0]">{promotionStatusHelp(p.status)}</p>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <PromotionFormDialog promotion={p} />
                        <ConfirmActionButton
                          action={deletePromotionAction.bind(null, p.id)}
                          title="Delete promotion?"
                          description={`"${p.title}" will be permanently removed. If members have claimed it, archive it instead.`}
                          confirmLabel="Delete"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
}
