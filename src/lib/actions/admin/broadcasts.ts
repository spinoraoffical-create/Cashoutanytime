"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  AdminActionResult,
  authorize,
  writeAudit,
} from "@/lib/actions/admin/core";
import { getAgentScope } from "@/lib/agents/scope";
import { getStaffContext } from "@/lib/data/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BroadcastSegment } from "@/lib/database.types";
import { sendBroadcastPush } from "@/lib/notifications/broadcast-push";
import {
  BROADCAST_SEGMENTS,
  executeBroadcast,
  resolveVipRank,
  safeBroadcastDiagnostic,
  type BroadcastAudienceScope,
  type BroadcastCandidate,
  type BroadcastRepository,
  type StoredBroadcast,
} from "@/lib/notifications/broadcast-rules";

const schema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(120),
  body: z.string().trim().min(5, "Message is too short").max(1000),
  link_url: z
    .string()
    .trim()
    .regex(/^\/[\w\-/?=&%.]*$/, "Use an internal path like /promotions")
    .optional()
    .or(z.literal("")),
  segment: z.enum(BROADCAST_SEGMENTS),
  request_id: z.string().uuid("Refresh the page and try the notice again."),
});

const PAGE = 1000;
const MAX_PAGES = 20;

type ProfileRow = {
  id: string;
  is_suspended: boolean | null;
  vip_tier: string | null;
  parent_agent_id: string | null;
};

function chunks<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

async function loadAudience(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  parentIds: string[] | null
): Promise<{ candidates: BroadcastCandidate[]; complete: boolean; error: string | null }> {
  if (parentIds && parentIds.length === 0) return { candidates: [], complete: true, error: null };
  const profiles: ProfileRow[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = db
      .from("profiles")
      .select("id, is_suspended, vip_tier, parent_agent_id")
      .order("id", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (parentIds) query = query.in("parent_agent_id", parentIds);
    const { data, error } = await query;
    if (error) {
      console.error("[broadcast] audience", error.code, safeBroadcastDiagnostic(error.message));
      return { candidates: [], complete: false, error: "The member list could not be loaded. Nothing was sent." };
    }
    profiles.push(...((data ?? []) as ProfileRow[]));
    if ((data ?? []).length < PAGE) break;
    if (page === MAX_PAGES - 1) {
      return { candidates: [], complete: false, error: null };
    }
  }

  const ids = profiles.map((row) => row.id);
  const announcements = new Map<string, boolean>();
  const statusRank = new Map<string, number>();
  const tierRank = new Map<string, number>();

  const { data: tiers, error: tierError } = await db.from("vip_tiers").select("id, rank");
  if (tierError) {
    console.error("[broadcast] tiers", tierError.code, safeBroadcastDiagnostic(tierError.message));
    return { candidates: [], complete: false, error: "VIP tiers could not be checked. Nothing was sent." };
  }
  for (const tier of (tiers ?? []) as { id: string; rank: number | null }[]) {
    if (tier.rank != null) tierRank.set(tier.id, tier.rank);
  }

  for (const group of chunks(ids, 200)) {
    const [prefs, status] = await Promise.all([
      db.from("notification_preferences").select("user_id, inapp_announcements").in("user_id", group),
      db.from("vip_status").select("user_id, tier_id").in("user_id", group),
    ]);
    if (prefs.error || status.error) {
      const failure = prefs.error ?? status.error;
      console.error("[broadcast] eligibility", failure?.code, safeBroadcastDiagnostic(failure?.message ?? ""));
      return { candidates: [], complete: false, error: "Notification preferences could not be checked. Nothing was sent." };
    }
    for (const row of (prefs.data ?? []) as { user_id: string; inapp_announcements: boolean }[]) {
      announcements.set(row.user_id, row.inapp_announcements);
    }
    for (const row of (status.data ?? []) as { user_id: string; tier_id: string | null }[]) {
      statusRank.set(row.user_id, row.tier_id ? tierRank.get(row.tier_id) ?? 0 : 0);
    }
  }

  return {
    complete: true,
    error: null,
    candidates: profiles.map((row) => ({
      userId: row.id,
      suspended: row.is_suspended === true,
      announcements: announcements.has(row.id) ? announcements.get(row.id) === true : null,
      vipRank: resolveVipRank(statusRank.has(row.id) ? statusRank.get(row.id)! : null, row.vip_tier),
      parentAgentId: row.parent_agent_id,
    })),
  };
}

function repository(db: NonNullable<ReturnType<typeof createAdminClient>>): BroadcastRepository {
  return {
    async get(id) {
      const { data, error } = await db
        .from("broadcasts")
        .select("id, title, body, link_url, segment, sent_by")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      const { data: notes, error: noteError } = await db
        .from("notifications")
        .select("user_id")
        .contains("metadata", { broadcast_id: id });
      if (noteError) return null;
      const row = data as {
        id: string;
        title: string;
        body: string;
        link_url: string | null;
        segment: BroadcastSegment;
        sent_by: string | null;
      };
      return {
        id: row.id,
        actorId: row.sent_by ?? "",
        title: row.title,
        body: row.body,
        linkUrl: row.link_url,
        segment: row.segment,
        recipientIds: ((notes ?? []) as { user_id: string }[]).map((note) => note.user_id),
      } satisfies StoredBroadcast;
    },
    async create(record) {
      const { error } = await db.from("broadcasts").insert({
        id: record.id,
        title: record.title,
        body: record.body,
        link_url: record.linkUrl,
        segment: record.segment,
        sent_by: record.actorId,
        recipient_count: 0,
      });
      if (!error) return null;
      console.error("[broadcast] save", error.code, safeBroadcastDiagnostic(error.message));
      return { code: error.code, message: error.message };
    },
    async addRecipients(id, userIds) {
      const notice = await db.from("broadcasts").select("title, body, link_url").eq("id", id).maybeSingle();
      if (notice.error || !notice.data) {
        return { code: notice.error?.code, message: notice.error?.message ?? "Notice record missing" };
      }
      const saved = notice.data as { title: string; body: string; link_url: string | null };
      for (const group of chunks(userIds, 200)) {
        const { error } = await db.from("notifications").insert(
          group.map((userId) => ({
            user_id: userId,
            type: "announcement",
            title: saved.title,
            body: saved.body,
            message: saved.body,
            link_url: saved.link_url,
            metadata: { broadcast_id: id },
          }))
        );
        if (error) {
          console.error("[broadcast] recipients", error.code, safeBroadcastDiagnostic(error.message));
          return { code: error.code, message: error.message };
        }
      }
      return null;
    },
    async finish(id, total) {
      const { error } = await db.from("broadcasts").update({ recipient_count: total }).eq("id", id);
      if (!error) return null;
      console.error("[broadcast] count-save", error.code, safeBroadcastDiagnostic(error.message));
      return { code: error.code, message: error.message };
    },
  };
}

export async function sendBroadcastAction(input: {
  title: string;
  body: string;
  link_url?: string;
  segment: BroadcastSegment;
  request_id: string;
}): Promise<AdminActionResult> {
  const auth = await authorize("notifications.broadcast");
  if ("error" in auth) return { ok: false, error: auth.error };

  const limited = await checkRateLimit("broadcast", auth.staff.userId);
  if (!limited.allowed) {
    return {
      ok: false,
      error:
        limited.reason === "unavailable"
          ? "Temporarily unavailable. Please try again shortly."
          : "Too many broadcasts in a short window. Pause a moment.",
    };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const db = createAdminClient();
  if (!db) return { ok: false, error: "In-app notices are not configured on the server. Nothing was sent." };

  const [scopeRead, staff] = await Promise.all([getAgentScope(), getStaffContext()]);
  if (!staff) return { ok: false, error: "Your sign-in could not be confirmed. Nothing was sent." };
  const storeRole = staff.roles.includes("store_creator") || staff.roles.includes("sub_creator");
  const storeScoped = scopeRead?.level === "store" || scopeRead?.level === "sub";
  if (storeRole && !storeScoped) {
    return { ok: false, error: "Your store audience could not be checked. Nothing was sent." };
  }
  const scope: BroadcastAudienceScope | null = scopeRead
    ? { level: scopeRead.level, parentIds: scopeRead.parentIds }
    : null;

  const audience = await loadAudience(db, storeScoped ? scopeRead.parentIds : null);
  if (audience.error) return { ok: false, error: audience.error };

  const result = await executeBroadcast({
    permitted: true,
    draft: {
      id: parsed.data.request_id,
      actorId: auth.staff.userId,
      title: parsed.data.title,
      body: parsed.data.body,
      linkUrl: parsed.data.link_url || null,
      segment: parsed.data.segment,
    },
    candidates: audience.candidates,
    audienceComplete: audience.complete,
    scope: storeScoped ? scope : { level: "platform", parentIds: [] },
    repo: repository(db),
  });

  if (!result.ok) return result;

  await writeAudit({
    actorId: auth.staff.userId,
    action: "broadcast.send",
    entityType: "broadcast",
    entityId: result.id,
    after: { segment: parsed.data.segment, title: parsed.data.title, recipient_count: result.total },
  });

  let message = result.message;
  try {
    const notes = await db.from("notifications").select("user_id").contains("metadata", { broadcast_id: result.id });
    const userIds = [...new Set(((notes.data ?? []) as { user_id: string }[]).map((row) => row.user_id))];
    const push = await sendBroadcastPush({
      broadcastId: result.id,
      title: parsed.data.title,
      body: parsed.data.body,
      linkUrl: parsed.data.link_url || null,
      userIds,
    });
    message = `${result.message} ${push.note}`;
  } catch (error) {
    console.error("[broadcast] push", safeBroadcastDiagnostic(error instanceof Error ? error.message : "push failed"));
    message = `${result.message} Phone alerts could not be attempted. The in-app notice was still saved.`;
  }

  revalidatePath("/admin/notifications");
  revalidatePath("/dashboard/inbox");
  return { ok: true, message, id: result.id };
}
