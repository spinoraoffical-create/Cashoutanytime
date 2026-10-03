import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  EntityEditDialog,
  type FieldValue,
} from "@/components/admin/entity-edit-dialog";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
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
import { updateAchievementAction } from "@/lib/actions/admin/economy";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Achievements" };

const RARITY_STYLE: Record<string, string> = {
  common: "bg-[#C7CCD6]/10 text-[#C7CCD6]",
  rare: "bg-ws-cyan/10 text-ws-cyan",
  epic: "bg-ws-purple/10 text-ws-purple",
  legendary: "bg-ws-green/10 text-ws-green-deep dark:text-ws-green",
};

export default async function AdminAchievementsPage() {
  await requirePermission("achievements.manage");
  const db = adminDb();

  const { data } = await db
    .from("achievements")
    .select(
      "id, name, description, category, rarity, icon, condition_type, condition_value, xp_reward, coins_reward, is_active"
    )
    .order("sort_order");

  const achievements = data ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Achievements"
        description="Edit rewards and unlock thresholds. Conditions are evaluated automatically as members progress."
      />

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-foreground/8 hover:bg-transparent">
                <TableHead>Achievement</TableHead>
                <TableHead>Rarity</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Reward</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="w-16 text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {achievements.map((a) => (
                <TableRow key={a.id} className="border-foreground/8">
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground/5">
                        <DynamicIcon name={a.icon} className="size-4 text-ws-green-deep dark:text-ws-green" />
                      </span>
                      <div>
                        <p className="font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.description}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`uppercase ${RARITY_STYLE[a.rarity]}`}>
                      {a.rarity}
                    </Badge>
                  </TableCell>
                  <TableCell className="tnum text-right text-sm text-muted-foreground">
                    {a.condition_value.toLocaleString()}
                  </TableCell>
                  <TableCell className="tnum text-right text-sm">
                    {a.coins_reward > 0 && (
                      <span className="text-ws-green-deep dark:text-ws-green">{a.coins_reward.toLocaleString()}c</span>
                    )}
                    {a.coins_reward > 0 && a.xp_reward > 0 && " · "}
                    {a.xp_reward > 0 && (
                      <span className="text-ws-cyan">{a.xp_reward.toLocaleString()} XP</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      className={
                        a.is_active
                          ? "bg-ws-emerald/15 text-ws-emerald"
                          : "bg-foreground/8 text-muted-foreground"
                      }
                    >
                      {a.is_active ? "Active" : "Off"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <EntityEditDialog
                      title={`Edit ${a.name}`}
                      fields={[
                        { name: "name", label: "Name", type: "text", defaultValue: a.name },
                        { name: "description", label: "Description", type: "textarea", defaultValue: a.description },
                        { name: "condition_value", label: "Target value", type: "number", defaultValue: a.condition_value, min: 1, hint: `Condition: ${a.condition_type}` },
                        { name: "coins_reward", label: "Coins reward", type: "number", defaultValue: a.coins_reward, min: 0 },
                        { name: "xp_reward", label: "XP reward", type: "number", defaultValue: a.xp_reward, min: 0 },
                        { name: "is_active", label: "Active", type: "switch", defaultValue: a.is_active },
                      ]}
                      action={async (values: Record<string, FieldValue>) => {
                        "use server";
                        return updateAchievementAction({
                          id: a.id,
                          name: String(values.name),
                          description: String(values.description),
                          condition_value: Number(values.condition_value),
                          coins_reward: Number(values.coins_reward),
                          xp_reward: Number(values.xp_reward),
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
