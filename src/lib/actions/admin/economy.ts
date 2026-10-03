"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  AdminActionResult,
  adminDb,
  authorize,
  writeAudit,
} from "@/lib/actions/admin/core";

// ── Reward rules ─────────────────────────────────────────────────────────────

const rewardRuleSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(280),
  coins: z.number().int().min(0).max(1_000_000),
  xp: z.number().int().min(0).max(1_000_000),
  is_active: z.boolean(),
});

export async function updateRewardRuleAction(
  input: z.infer<typeof rewardRuleSchema>
): Promise<AdminActionResult> {
  const auth = await authorize("rewards.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = rewardRuleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { id, ...patch } = parsed.data;
  const db = adminDb();
  const { error } = await db.from("reward_rules").update(patch).eq("id", id);
  if (error) return { ok: false, error: "Could not update the reward rule." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: "reward_rule.update",
    entityType: "reward_rule",
    entityId: id,
    after: patch,
  });
  revalidatePath("/admin/rewards");
  revalidatePath("/dashboard/rewards");
  return { ok: true, message: "Reward rule updated." };
}

// ── Achievements ─────────────────────────────────────────────────────────────

const achievementSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(280),
  xp_reward: z.number().int().min(0).max(1_000_000),
  coins_reward: z.number().int().min(0).max(1_000_000),
  condition_value: z.number().int().min(1),
  is_active: z.boolean(),
});

export async function updateAchievementAction(
  input: z.infer<typeof achievementSchema>
): Promise<AdminActionResult> {
  const auth = await authorize("achievements.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = achievementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { id, ...patch } = parsed.data;
  const db = adminDb();
  const { error } = await db.from("achievements").update(patch).eq("id", id);
  if (error) return { ok: false, error: "Could not update the achievement." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: "achievement.update",
    entityType: "achievement",
    entityId: id,
    after: patch,
  });
  revalidatePath("/admin/achievements");
  return { ok: true, message: "Achievement updated." };
}

// ── VIP tiers ────────────────────────────────────────────────────────────────

const vipTierSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(40),
  min_xp: z.number().int().min(0),
  reward_multiplier: z.number().min(1).max(10),
  is_active: z.boolean(),
});

export async function updateVipTierAction(
  input: z.infer<typeof vipTierSchema>
): Promise<AdminActionResult> {
  const auth = await authorize("vip.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = vipTierSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { id, ...patch } = parsed.data;
  const db = adminDb();
  const { error } = await db.from("vip_tiers").update(patch).eq("id", id);
  if (error) return { ok: false, error: "Could not update the tier." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: "vip_tier.update",
    entityType: "vip_tier",
    entityId: id,
    after: patch,
  });
  revalidatePath("/admin/vip");
  revalidatePath("/vip");
  return { ok: true, message: "VIP tier updated." };
}

// ── Referrals ────────────────────────────────────────────────────────────────

export async function setReferralStatusAction(input: {
  id: string;
  status: "qualified" | "rejected";
  reason?: string;
}): Promise<AdminActionResult> {
  const auth = await authorize("referrals.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = adminDb();
  const patch =
    input.status === "rejected"
      ? { status: "rejected" as const, rejected_reason: input.reason ?? "Manual review" }
      : { status: "qualified" as const, qualified_at: new Date().toISOString() };

  const { error } = await db.from("referrals").update(patch).eq("id", input.id);
  if (error) return { ok: false, error: "Could not update the referral." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: `referral.${input.status}`,
    entityType: "referral",
    entityId: input.id,
    after: patch,
  });
  revalidatePath("/admin/referrals");
  return {
    ok: true,
    message: input.status === "rejected" ? "Referral rejected." : "Referral approved.",
  };
}

// ── Leaderboards ─────────────────────────────────────────────────────────────

export async function recomputeLeaderboardsAction(): Promise<AdminActionResult> {
  const auth = await authorize("leaderboards.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = adminDb();
  const periods = ["daily", "weekly", "monthly", "all_time"] as const;
  for (const p of periods) {
    const { error } = await db.rpc("compute_leaderboard", {
      p,
      p_key: null,
      finalize: false,
    });
    if (error) return { ok: false, error: `Failed to recompute ${p}.` };
  }

  await writeAudit({
    actorId: auth.staff.userId,
    action: "leaderboard.recompute",
    entityType: "leaderboard",
  });
  revalidatePath("/admin/leaderboards");
  revalidatePath("/leaderboard");
  return { ok: true, message: "Leaderboards recomputed." };
}
