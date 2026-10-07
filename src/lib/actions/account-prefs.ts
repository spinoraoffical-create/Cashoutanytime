"use server";

import { requireUser } from "@/lib/data/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServiceRoleKey } from "@/lib/supabase/env";

export type AccountPrefs = {
  depositLimit: number;
  depositLimitPending?: number;
  depositLimitPendingAt?: string;
  weeklyLoadLimit: number;
  weeklyLoadLimitPending?: number;
  weeklyLoadLimitPendingAt?: string;
  monthlyLoadLimit: number;
  monthlyLoadLimitPending?: number;
  monthlyLoadLimitPendingAt?: string;
  timeoutUntil: string;
  selfExcludeUntil: string;
  breakReminderMin: number;
  emailNotices: boolean;
  promoNotices: boolean;
  smsMarketing: boolean;
  whatsappMarketing: boolean;
  textSize: "sm" | "md" | "lg" | "xl";
};

const SIZES = new Set(["sm", "md", "lg", "xl"]);

type StoredMarketing = {
  emailPromotions: boolean | null;
  smsMarketing: boolean;
  whatsappMarketing: boolean;
  phoneColumns: boolean;
};

async function readStoredMarketing(userId: string): Promise<StoredMarketing> {
  const empty: StoredMarketing = {
    emailPromotions: null,
    smsMarketing: false,
    whatsappMarketing: false,
    phoneColumns: false,
  };
  const admin = getSupabaseServiceRoleKey() ? createAdminClient() : null;
  if (!admin) return empty;

  const full = await admin
    .from("notification_preferences")
    .select("email_promotions, sms_marketing, whatsapp_marketing")
    .eq("user_id", userId)
    .maybeSingle();

  if (!full.error && full.data) {
    const row = full.data as {
      email_promotions?: boolean | null;
      sms_marketing?: boolean | null;
      whatsapp_marketing?: boolean | null;
    };
    return {
      emailPromotions: row.email_promotions !== false,
      smsMarketing: row.sms_marketing === true,
      whatsappMarketing: row.whatsapp_marketing === true,
      phoneColumns: true,
    };
  }

  const basic = await admin
    .from("notification_preferences")
    .select("email_promotions")
    .eq("user_id", userId)
    .maybeSingle();
  if (!basic.error && basic.data) {
    const row = basic.data as { email_promotions?: boolean | null };
    return {
      emailPromotions: row.email_promotions !== false,
      smsMarketing: false,
      whatsappMarketing: false,
      phoneColumns: false,
    };
  }

  return empty;
}

export async function getAccountPrefs(): Promise<AccountPrefs> {
  const { user } = await requireUser();
  const raw = (user.user_metadata?.prefs ?? {}) as Record<string, unknown>;
  const textSize = SIZES.has(String(raw.textSize)) ? (String(raw.textSize) as AccountPrefs["textSize"]) : "md";
  const metaPromo = raw.promoNotices !== false;
  const stored = await readStoredMarketing(user.id);

  if (metaPromo === false && stored.emailPromotions !== false) {
    const admin = getSupabaseServiceRoleKey() ? createAdminClient() : null;
    if (admin) {
      await admin.from("notification_preferences").upsert(
        { user_id: user.id, email_promotions: false },
        { onConflict: "user_id" }
      );
    }
  }

  const promoNotices =
    stored.emailPromotions == null ? metaPromo : stored.emailPromotions && metaPromo;

  const reminder = Number(raw.breakReminderMin ?? 30);
  const active = (current: unknown, pending: unknown, at: unknown) => {
    if (typeof at === "string" && at && Date.now() >= new Date(at).getTime()) return Number(pending) || 0;
    return Number(current ?? 0) || 0;
  };
  return {
    depositLimit: active(raw.depositLimit, raw.depositLimitPending, raw.depositLimitPendingAt),
    weeklyLoadLimit: active(raw.weeklyLoadLimit, raw.weeklyLoadLimitPending, raw.weeklyLoadLimitPendingAt),
    monthlyLoadLimit: active(raw.monthlyLoadLimit, raw.monthlyLoadLimitPending, raw.monthlyLoadLimitPendingAt),
    timeoutUntil: typeof raw.timeoutUntil === "string" ? raw.timeoutUntil : "",
    selfExcludeUntil: typeof raw.selfExcludeUntil === "string" ? raw.selfExcludeUntil : "",
    breakReminderMin: [10, 15, 20, 30].includes(reminder) ? reminder : 30,
    emailNotices: raw.emailNotices !== false,
    promoNotices,
    smsMarketing: stored.smsMarketing,
    whatsappMarketing: stored.whatsappMarketing,
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
  const touchesMarketing =
    next.promoNotices !== undefined ||
    next.smsMarketing !== undefined ||
    next.whatsappMarketing !== undefined;

  const prefs: Record<string, unknown> = { ...prev, ...next };

  if (touchesMarketing) {
    const stored = await readStoredMarketing(user.id);
    const promoNotices =
      next.promoNotices !== undefined ? next.promoNotices !== false : stored.emailPromotions !== false;
    const smsMarketing =
      next.smsMarketing !== undefined ? next.smsMarketing === true : stored.smsMarketing;
    const whatsappMarketing =
      next.whatsappMarketing !== undefined ? next.whatsappMarketing === true : stored.whatsappMarketing;

    const withPhone = await admin.from("notification_preferences").upsert(
      {
        user_id: user.id,
        email_promotions: promoNotices,
        sms_marketing: smsMarketing,
        whatsapp_marketing: whatsappMarketing,
      },
      { onConflict: "user_id" }
    );

    if (withPhone.error) {
      const emailOnly = await admin.from("notification_preferences").upsert(
        { user_id: user.id, email_promotions: promoNotices },
        { onConflict: "user_id" }
      );
      if (emailOnly.error) return { ok: false, error: "Could not save those settings." };
      if (smsMarketing || whatsappMarketing) {
        return {
          ok: false,
          error: "SMS and WhatsApp opt-in needs the latest preference migration before it can be saved.",
        };
      }
    } else {
      prefs.smsMarketing = smsMarketing;
      prefs.whatsappMarketing = whatsappMarketing;
    }
    prefs.promoNotices = promoNotices;
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...existing, prefs },
  });
  if (updateError) return { ok: false, error: "Could not save those settings." };
  return { ok: true };
}
