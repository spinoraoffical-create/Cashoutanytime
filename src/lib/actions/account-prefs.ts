"use server";

import { requireUser } from "@/lib/data/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServiceRoleKey } from "@/lib/supabase/env";

export type AccountPrefs = {
  depositLimit: number;
  timeoutUntil: string;
  emailNotices: boolean;
  promoNotices: boolean;
  textSize: "sm" | "md" | "lg" | "xl";
};

const SIZES = new Set(["sm", "md", "lg", "xl"]);

export async function getAccountPrefs(): Promise<AccountPrefs> {
  const { user } = await requireUser();
  const raw = (user.user_metadata?.prefs ?? {}) as Record<string, unknown>;
  const textSize = SIZES.has(String(raw.textSize)) ? (String(raw.textSize) as AccountPrefs["textSize"]) : "md";
  return {
    depositLimit: Number(raw.depositLimit ?? 0) || 0,
    timeoutUntil: typeof raw.timeoutUntil === "string" ? raw.timeoutUntil : "",
    emailNotices: raw.emailNotices !== false,
    promoNotices: raw.promoNotices !== false,
    textSize,
  };
}

export async function saveAccountPrefs(next: Partial<AccountPrefs>): Promise<{ ok: boolean; error?: string }> {
  const { user } = await requireUser();
  const admin = getSupabaseServiceRoleKey() ? createAdminClient() : null;
  if (!admin) return { ok: false, error: "Could not save those settings." };

  const { data, error } = await admin.auth.admin.getUserById(user.id);
  if (error || !data.user) return { ok: false, error: "Could not save those settings." };

  const existing = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const prev = (existing.prefs ?? {}) as Record<string, unknown>;
  const prefs = { ...prev, ...next };

  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...existing, prefs },
  });
  if (updateError) return { ok: false, error: "Could not save those settings." };
  return { ok: true };
}
