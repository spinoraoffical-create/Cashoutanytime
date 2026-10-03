import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  EntityEditDialog,
  type FieldValue,
} from "@/components/admin/entity-edit-dialog";
import { GlassCard } from "@/components/shared/glass-card";
import { TierBadge } from "@/components/shared/tier-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminDb } from "@/lib/actions/admin/core";
import { updateVipTierAction } from "@/lib/actions/admin/economy";
import { requirePermission } from "@/lib/data/admin";
import type { VipTierKey } from "@/lib/database.types";

export const metadata: Metadata = { title: "VIP Tiers" };

export default async function AdminVipPage() {
  await requirePermission("vip.manage");
  const db = adminDb();

  const [tiersRes, membersRes] = await Promise.all([
    db
      .from("vip_tiers")
      .select("id, key, name, rank, min_xp, reward_multiplier, is_active")
      .order("rank"),
    db.from("vip_status").select("tier_id"),
  ]);

  const tiers = tiersRes.data ?? [];
  const memberCounts = new Map<string, number>();
  for (const m of membersRes.data ?? []) {
    memberCounts.set(m.tier_id, (memberCounts.get(m.tier_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="VIP Tiers"
        description="Configure XP thresholds and reward multipliers. Members re-evaluate on their next XP gain."
      />

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-foreground/8 hover:bg-transparent">
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Min XP</TableHead>
                <TableHead className="text-right">Multiplier</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="w-16 text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((t) => (
                <TableRow key={t.id} className="border-foreground/8">
                  <TableCell>
                    <TierBadge tier={t.key as VipTierKey} />
                  </TableCell>
                  <TableCell className="tnum text-right">
                    {t.min_xp.toLocaleString()}
                  </TableCell>
                  <TableCell className="tnum text-right text-ws-green-deep dark:text-ws-green">
                    {Number(t.reward_multiplier)}×
                  </TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">
                    {(memberCounts.get(t.id) ?? 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      className={
                        t.is_active
                          ? "bg-ws-emerald/15 text-ws-emerald"
                          : "bg-foreground/8 text-muted-foreground"
                      }
                    >
                      {t.is_active ? "Active" : "Off"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <EntityEditDialog
                      title={`Edit ${t.name} tier`}
                      fields={[
                        { name: "name", label: "Name", type: "text", defaultValue: t.name },
                        { name: "min_xp", label: "Minimum XP", type: "number", defaultValue: t.min_xp, min: 0 },
                        { name: "reward_multiplier", label: "Reward multiplier", type: "number", defaultValue: Number(t.reward_multiplier), min: 1, step: 0.05 },
                        { name: "is_active", label: "Active", type: "switch", defaultValue: t.is_active },
                      ]}
                      action={async (values: Record<string, FieldValue>) => {
                        "use server";
                        return updateVipTierAction({
                          id: t.id,
                          name: String(values.name),
                          min_xp: Number(values.min_xp),
                          reward_multiplier: Number(values.reward_multiplier),
                          is_active: Boolean(values.is_active),
                        });
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </GlassCard>
    </div>
  );
}
