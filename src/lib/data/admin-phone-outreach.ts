import "server-only";

import { adminDb } from "@/lib/actions/admin/core";

export type PhoneOutreachPlayer = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  sms: boolean;
  whatsappOn: boolean;
  suspended: boolean;
};

export type PhoneOutreachSnapshot = {
  players: PhoneOutreachPlayer[];
  smsCount: number;
  whatsappCount: number;
  hiddenSuspended: number;
  setupError: string | null;
};

const EMPTY: PhoneOutreachSnapshot = {
  players: [],
  smsCount: 0,
  whatsappCount: 0,
  hiddenSuspended: 0,
  setupError: null,
};

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * Players who explicitly turned on SMS or WhatsApp marketing.
 * Suspended accounts are counted and left out of the list.
 */
export async function getConsentedPhoneOutreach(): Promise<PhoneOutreachSnapshot> {
  const db = adminDb();
  const { data, error } = await db
    .from("notification_preferences")
    .select("user_id, sms_marketing, whatsapp_marketing, updated_at")
    .or("sms_marketing.eq.true,whatsapp_marketing.eq.true")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    return {
      ...EMPTY,
      setupError:
        "Phone marketing preferences are not in the database yet. Apply supabase/migrations/20261007000110_newsletter_segments_phone_consent.sql, then refresh.",
    };
  }

  const prefRows = (data ?? []) as {
    user_id: string;
    sms_marketing: boolean | null;
    whatsapp_marketing: boolean | null;
  }[];
  if (!prefRows.length) return EMPTY;

  const ids = prefRows.map((row) => row.user_id).filter(Boolean);
  const profiles = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const loaded = await db
      .from("profiles")
      .select("id, full_name, display_name, email, phone, whatsapp, is_suspended, is_banned")
      .in("id", chunk);
    const rows = loaded.error
      ? (
          await db
            .from("profiles")
            .select("id, full_name, email, phone, whatsapp, is_suspended")
            .in("id", chunk)
        ).data
      : loaded.data;
    for (const row of (rows ?? []) as Record<string, unknown>[]) {
      if (typeof row.id === "string") profiles.set(row.id, row);
    }
  }

  const players: PhoneOutreachPlayer[] = [];
  let hiddenSuspended = 0;
  let smsCount = 0;
  let whatsappCount = 0;

  for (const pref of prefRows) {
    const profile = profiles.get(pref.user_id);
    const suspended = profile?.is_suspended === true || profile?.is_banned === true;
    const sms = pref.sms_marketing === true;
    const whatsappOn = pref.whatsapp_marketing === true;
    if (sms) smsCount += 1;
    if (whatsappOn) whatsappCount += 1;
    if (suspended) {
      hiddenSuspended += 1;
      continue;
    }
    const name =
      text(profile?.full_name) ||
      text(profile?.display_name) ||
      text(profile?.email) ||
      "Player";
    players.push({
      id: pref.user_id,
      name,
      phone: text(profile?.phone),
      whatsapp: text(profile?.whatsapp) || text(profile?.phone),
      sms,
      whatsappOn,
      suspended: false,
    });
  }

  return {
    players: players.slice(0, 50),
    smsCount,
    whatsappCount,
    hiddenSuspended,
    setupError: null,
  };
}
