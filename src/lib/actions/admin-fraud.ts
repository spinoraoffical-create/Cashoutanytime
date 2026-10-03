"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: "Unauthorized" as const };

  return { error: null, userId: user.id };
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
      "user_id, risk_score, flags, blocked, rewards_blocked, manual_review, last_calculated_at"
    )
    .or("rewards_blocked.eq.true,blocked.eq.true,manual_review.eq.true,risk_score.gte.50")
    .order("risk_score", { ascending: false })
    .limit(200);

  if (error) {
    if (error.message.includes("fraud_scores")) {
      return { error: "Run supabase/anti-spam-multi-account.sql in Supabase SQL Editor first." };
    }
    return { error: error.message };
  }

  if (!scores?.length) return { users: [] };

  const userIds = scores.map((s) => s.user_id);

  const [{ data: profiles }, { data: devices }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email, phone, is_suspended, created_at")
      .in("id", userIds),
    admin.from("device_map").select("user_id, device_id").in("user_id", userIds),
  ]);

  const profileById = new Map(profiles?.map((p) => [p.id, p]) ?? []);
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
        phone: profile.phone,
        is_suspended: Boolean(profile.is_suspended),
        created_at: profile.created_at,
        device_count: deviceCountByUser.get(score.user_id)?.size ?? 0,
      };
    })
    .filter((row): row is AdminFraudRow => row !== null);

  return { users };
}

/** Restore signup rewards + clear fraud flags (and unsuspend if fraud-related). */
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
      return { error: "Run supabase/anti-spam-multi-account.sql in Supabase SQL Editor first." };
    }
    return { error: fraudError.message };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ is_suspended: false })
    .eq("id", userId);

  if (profileError) return { error: profileError.message };

  await admin
    .from("fraud_events")
    .insert({
      user_id: userId,
      event_type: "admin_cleared",
      risk_delta: 0,
      details: { cleared_by: auth.userId },
    })
    .then(() => {}, () => {});

  revalidatePath("/admin/fraud");
  revalidatePath("/admin/users");
  return { success: true };
}

export async function blockUserFreeplay(userId: string): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const admin = createAdminClient();
  if (!admin) return { error: "Admin client not configured" };

  const { error } = await admin
    .from("fraud_scores")
    .upsert(
      {
        user_id: userId,
        risk_score: 75,
        rewards_blocked: true,
        manual_review: true,
        blocked: false,
        flags: ["admin_manual_block"],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) return { error: error.message };

  revalidatePath("/admin/fraud");
  return { success: true };
}
