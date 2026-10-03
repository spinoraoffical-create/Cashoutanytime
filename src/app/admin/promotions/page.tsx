import type { Metadata } from "next";
import { format } from "date-fns";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import { PromotionFormDialog } from "@/components/admin/promotion-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deletePromotionAction } from "@/lib/actions/admin/promotions";
import { adminDb } from "@/lib/actions/admin/core";
import { requirePermission } from "@/lib/data/admin";
import { BadgePercent } from "lucide-react";

export const metadata: Metadata = { title: "Promotions" };

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-foreground/8 text-muted-foreground",
  scheduled: "bg-ws-cyan/15 text-ws-cyan",
  active: "bg-ws-emerald/15 text-ws-emerald",
  expired: "bg-ws-green/15 text-ws-green-deep dark:text-ws-green",
  archived: "bg-foreground/8 text-muted-foreground",
};

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
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Promotions"
        description="Create, schedule and expire member bonus offers."
        action={<PromotionFormDialog />}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<BadgePercent />}
          title="No promotions yet"
          description="Create your first promotion to drive engagement."
        />
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-foreground/8 hover:bg-transparent">
                  <TableHead>Promotion</TableHead>
                  <TableHead className="text-right">Reward</TableHead>
                  <TableHead className="text-right">Window</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((p) => (
                  <TableRow key={p.id} className="border-foreground/8">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.title}</span>
                        {p.is_featured && (
                          <Badge className="bg-ws-green/15 text-ws-green-deep dark:text-ws-green">Featured</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">/{p.slug}</p>
                    </TableCell>
                    <TableCell className="tnum text-right text-sm">
                      {p.coins_bonus > 0 && (
                        <span className="text-ws-green-deep dark:text-ws-green">
                          {p.coins_bonus.toLocaleString()}c
                        </span>
                      )}
                      {p.coins_bonus > 0 && p.xp_bonus > 0 && " · "}
                      {p.xp_bonus > 0 && (
                        <span className="text-ws-cyan">
                          {p.xp_bonus.toLocaleString()} XP
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tnum text-right text-xs text-muted-foreground">
                      {p.starts_at ? format(new Date(p.starts_at), "MMM d") : "—"}
                      {" → "}
                      {p.ends_at ? format(new Date(p.ends_at), "MMM d") : "∞"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        className={`uppercase tracking-wide ${STATUS_STYLE[p.status]}`}
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <PromotionFormDialog promotion={p} />
                        <ConfirmActionButton
                          action={deletePromotionAction.bind(null, p.id)}
                          title="Delete promotion?"
                          description={`"${p.title}" will be permanently removed. If members have claimed it, archive it instead.`}
                          confirmLabel="Delete"
                        />
                      </div>
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
