import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  emptyAudienceCounts,
  matchesNewsletterSegment,
  NEWSLETTER_SEGMENTS,
  segmentNeedsDeposits,
  segmentNeedsProfileActivity,
  type AudienceCounts,
  type NewsletterSegmentId,
} from "@/lib/email/newsletter-segments";

export type NewsletterRecipient = { user_id: string; email: string };

type Person = {
  id: string;
  email: string | null;
  createdAt: number | null;
  lastSeenAt: number | null;
  suspended: boolean;
  vip: boolean;
  promoOptOut: boolean;
  depositedAt: number | null;
};

type AudienceLoad = {
  people: Person[];
  depositsAvailable: boolean;
  profilesAvailable: boolean;
};

const VIP_TIER_KEYS = new Set(["silver", "gold", "platinum", "diamond", "elite"]);

function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim();
  if (!email.includes("@")) return null;
  return email;
}

function parseTime(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

function metadataOptOut(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const prefs = (metadata as { prefs?: unknown }).prefs;
  if (!prefs || typeof prefs !== "object") return false;
  return (prefs as { promoNotices?: unknown }).promoNotices === false;
}

async function listAuthUsers(db: SupabaseClient): Promise<
  { id: string; email: string | null; promoOptOut: boolean }[]
> {
  const users: { id: string; email: string | null; promoOptOut: boolean }[] = [];
  const perPage = 1000;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) break;
    for (const user of data.users) {
      users.push({
        id: user.id,
        email: cleanEmail(user.email),
        promoOptOut: metadataOptOut(user.user_metadata),
      });
    }
    if (data.users.length < perPage) break;
  }
  return users;
}

async function loadProfiles(db: SupabaseClient): Promise<{ rows: Record<string, unknown>[]; ok: boolean }> {
  const selects = [
    "id, email, created_at, last_seen_at, is_suspended, is_banned, vip_tier",
    "id, email, created_at, last_seen_at, is_suspended, vip_tier",
    "id, created_at, last_seen_at, is_banned",
  ];

  for (const select of selects) {
    const first = await db.from("profiles").select(select).range(0, 999);
    if (first.error) continue;
    const rows = [...((first.data ?? []) as unknown as Record<string, unknown>[])];
    if ((first.data ?? []).length === 1000) {
      for (let from = 1000; from < 20000; from += 1000) {
        const page = await db.from("profiles").select(select).range(from, from + 999);
        if (page.error || !page.data?.length) break;
        rows.push(...(page.data as unknown as Record<string, unknown>[]));
        if (page.data.length < 1000) break;
      }
    }
    return { rows, ok: true };
  }

  return { rows: [], ok: false };
}

async function loadVipIds(db: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  const joined = await db.from("vip_status").select("user_id, vip_tiers(rank, key)").limit(5000);
  if (!joined.error && joined.data) {
    for (const row of joined.data as {
      user_id: string;
      vip_tiers: { rank?: number; key?: string } | { rank?: number; key?: string }[] | null;
    }[]) {
      const tier = Array.isArray(row.vip_tiers) ? row.vip_tiers[0] : row.vip_tiers;
      const key = (tier?.key ?? "").toLowerCase();
      const rank = Number(tier?.rank ?? 0);
      if (rank >= 1 || VIP_TIER_KEYS.has(key)) ids.add(row.user_id);
    }
    return ids;
  }

  const plain = await db.from("vip_status").select("user_id").limit(5000);
  if (!plain.error && plain.data) {
    for (const row of plain.data as { user_id: string }[]) {
      if (row.user_id) ids.add(row.user_id);
    }
  }
  return ids;
}

async function loadDeposits(
  db: SupabaseClient
): Promise<{ latest: Map<string, number>; ok: boolean }> {
  const latest = new Map<string, number>();
  const pageSize = 1000;
  for (let from = 0; from < 50000; from += pageSize) {
    const { data, error } = await db
      .from("deposit_requests")
      .select("user_id, created_at")
      .eq("status", "completed")
      .range(from, from + pageSize - 1);
    if (error) return { latest, ok: false };
    if (!data?.length) return { latest, ok: true };
    for (const row of data as { user_id: string | null; created_at: string | null }[]) {
      if (!row.user_id) continue;
      const ts = parseTime(row.created_at);
      if (ts == null) continue;
      const prev = latest.get(row.user_id);
      if (prev == null || ts > prev) latest.set(row.user_id, ts);
    }
    if (data.length < pageSize) return { latest, ok: true };
  }
  return { latest, ok: true };
}

async function loadOptOuts(db: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await db
      .from("notification_preferences")
      .select("user_id")
      .eq("email_promotions", false)
      .range(from, from + 999);
    if (error || !data?.length) break;
    for (const row of data as { user_id: string }[]) {
      if (row.user_id) ids.add(row.user_id);
    }
    if (data.length < 1000) break;
  }
  return ids;
}

async function loadAudience(db: SupabaseClient): Promise<AudienceLoad> {
  const [authUsers, profiles, vipIds, deposits, optOuts] = await Promise.all([
    listAuthUsers(db),
    loadProfiles(db),
    loadVipIds(db),
    loadDeposits(db),
    loadOptOuts(db),
  ]);

  const people = new Map<string, Person>();

  for (const user of authUsers) {
    people.set(user.id, {
      id: user.id,
      email: user.email,
      createdAt: null,
      lastSeenAt: null,
      suspended: false,
      vip: vipIds.has(user.id),
      promoOptOut: user.promoOptOut || optOuts.has(user.id),
      depositedAt: deposits.latest.get(user.id) ?? null,
    });
  }

  for (const row of profiles.rows) {
    const id = typeof row.id === "string" ? row.id : "";
    if (!id) continue;
    const existing = people.get(id);
    const tier = typeof row.vip_tier === "string" ? row.vip_tier.toLowerCase() : "";
    const suspended = row.is_suspended === true || row.is_banned === true;
    const email = cleanEmail(row.email) ?? existing?.email ?? null;
    people.set(id, {
      id,
      email,
      createdAt: parseTime(row.created_at) ?? existing?.createdAt ?? null,
      lastSeenAt: parseTime(row.last_seen_at) ?? existing?.lastSeenAt ?? null,
      suspended: suspended || existing?.suspended === true,
      vip: existing?.vip === true || vipIds.has(id) || VIP_TIER_KEYS.has(tier),
      promoOptOut: existing?.promoOptOut === true || optOuts.has(id),
      depositedAt: deposits.latest.get(id) ?? existing?.depositedAt ?? null,
    });
  }

  return {
    people: [...people.values()],
    depositsAvailable: deposits.ok,
    profilesAvailable: profiles.ok,
  };
}

function segmentBlocked(segment: NewsletterSegmentId, load: AudienceLoad): string | null {
  if (segmentNeedsDeposits(segment) && !load.depositsAvailable) {
    return "Deposit history could not be loaded, so deposit audiences were not calculated.";
  }
  if (segmentNeedsProfileActivity(segment) && !load.profilesAvailable) {
    return "Player activity could not be loaded, so signup and inactive audiences were not calculated.";
  }
  return null;
}

function countSegment(load: AudienceLoad, segment: NewsletterSegmentId, now: number): AudienceCounts {
  if (segment === "test") {
    return { eligible: 1, optedOut: 0, suspended: 0, noEmail: 0 };
  }
  if (segmentBlocked(segment, load)) return emptyAudienceCounts();

  const counts = emptyAudienceCounts();
  for (const person of load.people) {
    if (!matchesNewsletterSegment(segment, person, now)) continue;
    if (person.suspended) counts.suspended += 1;
    else if (person.promoOptOut) counts.optedOut += 1;
    else if (!person.email) counts.noEmail += 1;
    else counts.eligible += 1;
  }
  return counts;
}

export async function previewNewsletterAudiences(db: SupabaseClient): Promise<{
  counts: Record<NewsletterSegmentId, AudienceCounts>;
  warnings: string[];
}> {
  const load = await loadAudience(db);
  const now = Date.now();
  const counts = {} as Record<NewsletterSegmentId, AudienceCounts>;
  const warnings = new Set<string>();

  for (const segment of NEWSLETTER_SEGMENTS) {
    const blocked = segmentBlocked(segment, load);
    if (blocked) warnings.add(blocked);
    counts[segment] = countSegment(load, segment, now);
  }

  return { counts, warnings: [...warnings] };
}

export async function resolveNewsletterRecipients(
  db: SupabaseClient,
  segment: NewsletterSegmentId,
  staff: { userId: string; email: string | null }
): Promise<NewsletterRecipient[]> {
  if (segment === "test") {
    if (!staff.email) return [];
    return [{ user_id: staff.userId, email: staff.email }];
  }

  const load = await loadAudience(db);
  const blocked = segmentBlocked(segment, load);
  if (blocked) {
    throw new Error(`${blocked} Nothing was sent.`);
  }

  const now = Date.now();
  const recipients: NewsletterRecipient[] = [];
  const seen = new Set<string>();
  for (const person of load.people) {
    if (!matchesNewsletterSegment(segment, person, now)) continue;
    if (person.suspended || person.promoOptOut || !person.email) continue;
    if (seen.has(person.id)) continue;
    seen.add(person.id);
    recipients.push({ user_id: person.id, email: person.email });
  }
  return recipients;
}
