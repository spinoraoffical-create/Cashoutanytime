"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/actions/admin/core";
import { getStaffContext } from "@/lib/data/admin";
import { latestIpsFor } from "@/lib/admin/signup-ips";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminFraudRow {
  user_id: string;
  risk_score: number;
  flags: string[];
  blocked: boolean;
  rewards_blocked: boolean;
  manual_review: boolean;
  last_calculated_at: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  is_suspended: boolean;
  created_at: string;
  device_count: number;
  signupIp: string;
  lastSeenIp: string;
  updated_at: string | null;
  restriction_actor: string | null;
  restriction_at: string | null;
}

async function requireAdmin() {
  const ctx = await getStaffContext();
  if (!ctx?.isSuperAdmin) return { error: "Unauthorized" as const };
  return { error: null, userId: ctx.userId };
}

function parseFlags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f): f is string => typeof f === "string");
}

export async function getFlaggedFraudUsers(): Promise<{
  users?: AdminFraudRow[];
  error?: string;
}> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const admin = createAdminClient();
  if (!admin) {
    return {
      error: "Admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.",
    };
  }

  const { data: scores, error } = await admin
    .from("fraud_scores")
    .select(
      "user_id, risk_score, flags, blocked, rewards_blocked, manual_review, last_calculated_at, updated_at"
    )
    .or("rewards_blocked.eq.true,blocked.eq.true,manual_review.eq.true,risk_score.gte.50")
    .order("risk_score", { ascending: false })
    .limit(200);

  if (error) {
    if (error.message.includes("fraud_scores")) {
      return {
        error: "Run supabase/migrations/20261011000260_anti_spam_multi_account.sql in the Supabase SQL editor first.",
      };
    }
    return { error: error.message };
  }

  if (!scores?.length) return { users: [] };

  const userIds = scores.map((s) => s.user_id);

  const profileSelect = await admin
    .from("profiles")
    .select("id, full_name, email, phone, is_suspended, created_at")
    .in("id", userIds);
  const profileRows = profileSelect.error
    ? (
        await admin
          .from("profiles")
          .select("id, full_name, email, is_suspended, created_at")
          .in("id", userIds)
      ).data
    : profileSelect.data;

  const [{ data: devices }, ips, { data: audits }] = await Promise.all([
    admin.from("device_map").select("user_id, device_id").in("user_id", userIds),
    latestIpsFor(admin, userIds),
    admin
      .from("audit_logs")
      .select("entity_id, actor_id, created_at, action")
      .in("entity_id", userIds)
      .eq("action", "fraud.block_freeplay")
      .order("created_at", { ascending: false }),
  ]);
  const latestBlock = new Map<string, { actor_id: string | null; created_at: string }>();
  for (const audit of audits ?? []) {
    if (!audit.entity_id || latestBlock.has(audit.entity_id)) continue;
    latestBlock.set(audit.entity_id, { actor_id: audit.actor_id, created_at: audit.created_at });
  }
  const actorIds = [...new Set([...latestBlock.values()].map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];
  const { data: actors } = actorIds.length
    ? await admin.from("profiles").select("id, full_name, email").in("id", actorIds)
    : { data: [] };
  const actorName = new Map((actors ?? []).map((actor) => [actor.id, actor.full_name || actor.email || "Admin"]));

  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));
  const deviceCountByUser = new Map<string, Set<string>>();

  for (const row of devices ?? []) {
    if (!deviceCountByUser.has(row.user_id)) {
      deviceCountByUser.set(row.user_id, new Set());
    }
    deviceCountByUser.get(row.user_id)!.add(row.device_id);
  }

  const users: AdminFraudRow[] = scores
    .map((score) => {
      const profile = profileById.get(score.user_id);
      if (!profile) return null;
      const block = latestBlock.get(score.user_id);
      return {
        user_id: score.user_id,
        risk_score: score.risk_score ?? 0,
        flags: parseFlags(score.flags),
        blocked: Boolean(score.blocked),
        rewards_blocked: Boolean(score.rewards_blocked),
        manual_review: Boolean(score.manual_review),
        last_calculated_at: score.last_calculated_at,
        full_name: profile.full_name,
        email: profile.email,
        phone: "phone" in profile ? profile.phone : null,
        is_suspended: Boolean(profile.is_suspended),
        created_at: profile.created_at,
        device_count: deviceCountByUser.get(score.user_id)?.size ?? 0,
        signupIp: ips.signup.get(score.user_id)?.trim() || "—",
        lastSeenIp: ips.seen.get(score.user_id)?.trim() || "—",
        updated_at: "updated_at" in score ? String(score.updated_at ?? "") || null : null,
        restriction_actor: block?.actor_id ? actorName.get(block.actor_id) ?? "Admin" : null,
        restriction_at: block?.created_at ?? null,
      };
    })
    .filter((row): row is AdminFraudRow => row !== null);

  return { users };
}

/** Clear fraud flags only. A separate ban and reward history stay in place. */
export async function clearUserFraudFlags(userId: string): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const admin = createAdminClient();
  if (!admin) return { error: "Admin client not configured" };

  const { error: fraudError } = await admin
    .from("fraud_scores")
    .update({
      risk_score: 0,
      flags: [],
      blocked: false,
      rewards_blocked: false,
      manual_review: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (fraudError) {
    if (fraudError.message.includes("fraud_scores")) {
      return {
        error: "Run supabase/migrations/20261011000260_anti_spam_multi_account.sql in the Supabase SQL editor first.",
      };
    }
    return { error: fraudError.message };
  }

  await admin
    .from("fraud_events")
    .insert({
      user_id: userId,
      event_type: "admin_cleared",
      risk_delta: 0,
      details: { cleared_by: auth.userId },
    })
    .then(() => {}, () => {});

  await writeAudit({
    actorId: auth.userId,
    action: "fraud.clear",
    entityType: "profile",
    entityId: userId,
    after: { cleared: true },
  });

  revalidatePath("/admin/fraud");
  revalidatePath("/admin/users");
  return { success: true };
}

export async function blockUserFreeplay(userId: string): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const admin = createAdminClient();
  if (!admin) return { error: "Admin client not configured" };

  const { data: existing } = await admin
    .from("fraud_scores")
    .select("flags, risk_score, blocked")
    .eq("user_id", userId)
    .maybeSingle();
  const flags = parseFlags(existing?.flags);
  const nextFlags = flags.includes("admin_manual_block") ? flags : [...flags, "admin_manual_block"];
  const { error } = await admin
    .from("fraud_scores")
    .upsert(
      {
        user_id: userId,
        risk_score: Math.max(Number(existing?.risk_score ?? 0), 75),
        rewards_blocked: true,
        manual_review: true,
        blocked: Boolean(existing?.blocked),
        flags: nextFlags,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) return { error: error.message };

  await writeAudit({
    actorId: auth.userId,
    action: "fraud.block_freeplay",
    entityType: "profile",
    entityId: userId,
    after: { rewards_blocked: true },
  });

  revalidatePath("/admin/fraud");
  return { success: true };
}

export async function unblockUserFreeplay(userId: string): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const admin = createAdminClient();
  if (!admin) return { error: "Admin client not configured" };

  const { data: existing, error: readError } = await admin
    .from("fraud_scores")
    .select("flags, risk_score, blocked")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) return { error: readError.message };
  const flags = parseFlags(existing?.flags).filter((flag) => flag !== "admin_manual_block");
  const stillRestricted = flags.length > 0 || Boolean(existing?.blocked);
  const { error } = await admin
    .from("fraud_scores")
    .update({
      flags,
      rewards_blocked: stillRestricted,
      manual_review: stillRestricted,
      risk_score: stillRestricted ? Number(existing?.risk_score ?? 0) : 0,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) return { error: error.message };

  await writeAudit({
    actorId: auth.userId,
    action: "fraud.unblock_freeplay",
    entityType: "profile",
    entityId: userId,
    after: { rewards_blocked: stillRestricted, flags },
  });

  revalidatePath("/admin/fraud");
  return { success: true };
}
