import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  EntityEditDialog,
  type FieldValue,
} from "@/components/admin/entity-edit-dialog";
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
import { adminDb } from "@/lib/actions/admin/core";
import { updateRewardRuleAction } from "@/lib/actions/admin/economy";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Rewards" };

const TYPE_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  streak_milestone: "Streak milestone",
  seasonal: "Seasonal",
  referral: "Referral",
};

export default async function AdminRewardsPage() {
  await requirePermission("rewards.manage");
  const db = adminDb();

  const { data } = await db
    .from("reward_rules")
    .select("id, key, name, description, reward_type, coins, xp, is_active")
    .order("reward_type");

  const rules = data ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Rewards"
        description="Tune the coins, XP and availability of every reward stream. Changes apply to future claims immediately."
      />

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-foreground/8 hover:bg-transparent">
                <TableHead>Stream</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Coins</TableHead>
                <TableHead className="text-right">XP</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="w-16 text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id} className="border-foreground/8">
                  <TableCell>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.description}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {TYPE_LABEL[r.reward_type] ?? r.reward_type}
                  </TableCell>
                  <TableCell className="tnum text-right text-ws-green-deep dark:text-ws-green">
                    {r.coins.toLocaleString()}
                  </TableCell>
                  <TableCell className="tnum text-right text-ws-cyan">
                    {r.xp.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      className={
                        r.is_active
                          ? "bg-ws-emerald/15 text-ws-emerald"
                          : "bg-foreground/8 text-muted-foreground"
                      }
                    >
                      {r.is_active ? "Active" : "Off"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <EntityEditDialog
                      title={`Edit ${r.name}`}
                      fields={[
                        { name: "name", label: "Name", type: "text", defaultValue: r.name },
                        { name: "description", label: "Description", type: "textarea", defaultValue: r.description },
                        { name: "coins", label: "Coins", type: "number", defaultValue: r.coins, min: 0 },
                        { name: "xp", label: "XP", type: "number", defaultValue: r.xp, min: 0 },
                        { name: "is_active", label: "Active", type: "switch", defaultValue: r.is_active },
                      ]}
                      action={async (values: Record<string, FieldValue>) => {
                        "use server";
                        return updateRewardRuleAction({
                          id: r.id,
                          name: String(values.name),
                          description: String(values.description),
                          coins: Number(values.coins),
                          xp: Number(values.xp),
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
