"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import {
  AdminActionResult,
  adminDb,
  authorize,
  writeAudit,
} from "@/lib/actions/admin/core";
import { customCampaignEmail } from "@/lib/email/newsletter-templates";
import {
  previewNewsletterAudiences,
  resolveNewsletterRecipients,
} from "@/lib/email/newsletter-audience";
import {
  isNewsletterSegment,
  NEWSLETTER_SEGMENTS,
  type AudienceCounts,
  type NewsletterSegmentId,
} from "@/lib/email/newsletter-segments";
import {
  htmlToPlainText,
  promoEmailFooterPlain,
  promoEmailHeaders,
  PROMO_REPLY_TO,
} from "@/lib/email/deliverability";
import { FROM, getResend } from "@/lib/email/resend";

const campaignSchema = z.object({
  name: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(200),
  eyebrow: z.string().trim().max(100).optional().default(""),
  heading: z.string().trim().min(1).max(200),
  subhead: z.string().trim().max(300).optional().default(""),
  body: z.string().trim().min(1),
  cta_label: z.string().trim().min(1).max(60),
  cta_href: z.string().trim().url(),
  stat1_value: z.string().trim().max(30).optional().default(""),
  stat1_label: z.string().trim().max(30).optional().default(""),
  stat2_value: z.string().trim().max(30).optional().default(""),
  stat2_label: z.string().trim().max(30).optional().default(""),
  stat3_value: z.string().trim().max(30).optional().default(""),
  stat3_label: z.string().trim().max(30).optional().default(""),
  segment: z.enum(NEWSLETTER_SEGMENTS),
});

export async function upsertNewsletterCampaignAction(
  input: z.infer<typeof campaignSchema> & { id?: string }
): Promise<AdminActionResult> {
  const auth = await authorize("newsletters.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  const db = adminDb();

  if (input.id) {
    const { data: existing } = await db
      .from("newsletter_campaigns")
      .select("status")
      .eq("id", input.id)
      .maybeSingle();
    if (existing && existing.status !== "draft") {
      return { ok: false, error: "Only draft campaigns can be edited." };
    }
  }

  const payload = { ...parsed.data, created_by: auth.staff.userId };

  const result = input.id
    ? await db.from("newsletter_campaigns").update(payload).eq("id", input.id)
    : await db.from("newsletter_campaigns").insert(payload);

  if (result.error) {
    const message = result.error.message ?? "";
    if (/segment|check constraint/i.test(message)) {
      return {
        ok: false,
        error:
          "That audience is not enabled in the database yet. Apply the newsletter segments migration, then try again.",
      };
    }
    return { ok: false, error: "Could not save the campaign." };
  }

  await writeAudit({
    actorId: auth.staff.userId,
    action: input.id ? "newsletter_campaign.update" : "newsletter_campaign.create",
    entityType: "newsletter_campaign",
    entityId: input.id ?? null,
    after: payload,
  });

  revalidatePath("/admin/newsletters");
  return { ok: true, message: "Campaign saved." };
}

export async function deleteNewsletterCampaignAction(id: string): Promise<AdminActionResult> {
  const auth = await authorize("newsletters.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = adminDb();
  const { data: existing } = await db
    .from("newsletter_campaigns")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (existing && existing.status !== "draft") {
    return { ok: false, error: "Only draft campaigns can be deleted." };
  }

  const { error } = await db.from("newsletter_campaigns").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the campaign." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: "newsletter_campaign.delete",
    entityType: "newsletter_campaign",
    entityId: id,
  });

  revalidatePath("/admin/newsletters");
  return { ok: true, message: "Deleted." };
}

/**
 * "Schedule" and "Send Now" share this entrypoint — `scheduledAt: null`
 * means "as soon as possible". On first call for a campaign it enumerates
 * the recipient list once (idempotent — a re-call is a no-op for
 * enumeration) so later batches never re-scan or double-send.
 */
export async function scheduleNewsletterCampaignAction(
  id: string,
  scheduledAt: string | null
): Promise<AdminActionResult> {
  const auth = await authorize("newsletters.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = adminDb();
  const { data: campaign } = await db
    .from("newsletter_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) return { ok: false, error: "Campaign not found." };
  if (campaign.status !== "draft") {
    return { ok: false, error: "Only draft campaigns can be scheduled." };
  }

  const segment: NewsletterSegmentId = isNewsletterSegment(campaign.segment)
    ? campaign.segment
    : "all";
  if (segment === "test" && !auth.staff.email) {
    return { ok: false, error: "Your account has no email on file." };
  }

  let recipients: { user_id: string; email: string }[];
  try {
    recipients = await resolveNewsletterRecipients(db, segment, {
      userId: auth.staff.userId,
      email: auth.staff.email,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not build this audience.",
    };
  }

  if (recipients.length === 0) {
    return { ok: false, error: "No eligible recipients found for this segment." };
  }

  const { count } = await db
    .from("newsletter_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", id);

  if (!count) {
    const rows = recipients.map((r) => ({
      campaign_id: id,
      user_id: r.user_id,
      email: r.email,
    }));
    const { error: insertError } = await db.from("newsletter_campaign_recipients").insert(rows);
    if (insertError) return { ok: false, error: "Could not enumerate recipients." };
  }

  const when = scheduledAt ?? new Date().toISOString();
  await db
    .from("newsletter_campaigns")
    .update({ status: "scheduled", scheduled_at: when, total_recipients: recipients.length })
    .eq("id", id);

  await writeAudit({
    actorId: auth.staff.userId,
    action: "newsletter_campaign.schedule",
    entityType: "newsletter_campaign",
    entityId: id,
    after: { scheduled_at: when, total_recipients: recipients.length, segment },
  });

  // Kick off the first batch after the response is sent so "Send Now"
  // doesn't block on Resend's rate-limited per-email loop — the cron sweep
  // (external, cron-job.org) picks up anything after() doesn't finish.
  if (new Date(when) <= new Date()) {
    after(() => processCampaignBatch(id));
  }

  revalidatePath("/admin/newsletters");
  return { ok: true, message: "Campaign scheduled." };
}

const BATCH_SIZE = 100;
const SEND_DELAY_MS = 130; // ~7.7/sec — under Resend's observed 10/sec limit

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type CampaignStat = { value: string; label: string };

type CampaignContent = {
  subject: string;
  eyebrow: string;
  heading: string;
  subhead: string;
  body: string;
  cta_label: string;
  cta_href: string;
  stat1_value: string | null;
  stat1_label: string | null;
  stat2_value: string | null;
  stat2_label: string | null;
  stat3_value: string | null;
  stat3_label: string | null;
};

function buildCampaignEmail(campaign: CampaignContent) {
  const stats = (
    [
      campaign.stat1_value && campaign.stat1_label
        ? { value: campaign.stat1_value, label: campaign.stat1_label }
        : null,
      campaign.stat2_value && campaign.stat2_label
        ? { value: campaign.stat2_value, label: campaign.stat2_label }
        : null,
      campaign.stat3_value && campaign.stat3_label
        ? { value: campaign.stat3_value, label: campaign.stat3_label }
        : null,
    ] as (CampaignStat | null)[]
  ).filter((s): s is CampaignStat => s !== null);

  const { subject, html } = customCampaignEmail({
    subject: campaign.subject,
    eyebrow: campaign.eyebrow,
    heading: campaign.heading,
    subhead: campaign.subhead,
    body: campaign.body,
    stats: stats.length ? stats : undefined,
    cta: { label: campaign.cta_label, href: campaign.cta_href },
  });

  return {
    subject,
    html,
    text: htmlToPlainText(html) + promoEmailFooterPlain(),
  };
}

export type NewsletterAudiencePreview = {
  ok: true;
  counts: Record<NewsletterSegmentId, AudienceCounts>;
  warnings: string[];
};

/** Live eligible / opted-out / suspended counts for the campaign dialog. */
export async function previewNewsletterAudiencesAction(): Promise<
  NewsletterAudiencePreview | { ok: false; error: string }
> {
  const auth = await authorize("newsletters.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  try {
    const preview = await previewNewsletterAudiences(adminDb());
    return { ok: true, ...preview };
  } catch {
    return { ok: false, error: "Audience counts are unavailable right now." };
  }
}

/**
 * Sends one copy to the signed-in staff email. Does not change campaign
 * status or write recipient rows, so the draft can still be scheduled.
 */
export async function sendNewsletterTestAction(id: string): Promise<AdminActionResult> {
  const auth = await authorize("newsletters.manage");
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!auth.staff.email) return { ok: false, error: "Your account has no email on file." };

  const resend = getResend();
  if (!resend) return { ok: false, error: "RESEND_API_KEY is not configured." };

  const db = adminDb();
  const { data: campaign } = await db
    .from("newsletter_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) return { ok: false, error: "Campaign not found." };
  if (campaign.status !== "draft") {
    return { ok: false, error: "Only a draft can be test-sent." };
  }

  const message = buildCampaignEmail(campaign);
  const { error } = await resend.emails.send({
    from: FROM,
    to: auth.staff.email,
    replyTo: PROMO_REPLY_TO,
    subject: message.subject,
    html: message.html,
    text: message.text,
    headers: promoEmailHeaders(),
    tags: [{ name: "category", value: "promo-test" }],
  });
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actorId: auth.staff.userId,
    action: "newsletter_campaign.test_send",
    entityType: "newsletter_campaign",
    entityId: id,
    after: { to: auth.staff.email },
  });

  return { ok: true, message: `Test sent to ${auth.staff.email}. The campaign is still a draft.` };
}

/**
 * Sends up to `limit` pending recipients for a campaign. Shared by
 * `scheduleNewsletterCampaignAction`'s immediate first batch and the
 * `/api/cron/newsletter-send` sweep — safe to call repeatedly since it only
 * ever claims rows still marked `'pending'`.
 */
export async function processCampaignBatch(campaignId: string, limit = BATCH_SIZE) {
  const admin = adminDb();
  const resend = getResend();
  if (!resend) {
    await admin
      .from("newsletter_campaigns")
      .update({ status: "failed" })
      .eq("id", campaignId);
    await admin
      .from("newsletter_campaign_recipients")
      .update({ status: "failed", error: "RESEND_API_KEY is not configured in env." })
      .eq("campaign_id", campaignId)
      .eq("status", "pending");
    return { sent: 0, failed: 0, remaining: -1 };
  }

  const { data: campaign } = await admin
    .from("newsletter_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) return { sent: 0, failed: 0, remaining: 0 };

  if (campaign.status === "scheduled") {
    await admin.from("newsletter_campaigns").update({ status: "sending" }).eq("id", campaignId);
  }

  const { data: pending } = await admin
    .from("newsletter_campaign_recipients")
    .select("id, email")
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .limit(limit);

  if (!pending || pending.length === 0) {
    await admin
      .from("newsletter_campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", campaignId);
    return { sent: 0, failed: 0, remaining: 0 };
  }

  const { subject, html, text } = buildCampaignEmail(campaign);

  let sent = 0;
  let failed = 0;

  for (const recipient of pending) {
    const { error } = await resend.emails.send({
      from: FROM,
      to: recipient.email,
      replyTo: PROMO_REPLY_TO,
      subject,
      html,
      text,
      headers: promoEmailHeaders(),
      tags: [{ name: "category", value: "promo" }],
    });
    if (error) {
      failed += 1;
      await admin
        .from("newsletter_campaign_recipients")
        .update({ status: "failed", error: error.message })
        .eq("id", recipient.id);
    } else {
      sent += 1;
      await admin
        .from("newsletter_campaign_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", recipient.id);
    }
    await sleep(SEND_DELAY_MS);
  }

  await admin
    .from("newsletter_campaigns")
    .update({
      sent_count: campaign.sent_count + sent,
      failed_count: campaign.failed_count + failed,
    })
    .eq("id", campaignId);

  const { count: stillPending } = await admin
    .from("newsletter_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  if (!stillPending) {
    await admin
      .from("newsletter_campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", campaignId);
  }

  return { sent, failed, remaining: stillPending ?? 0 };
}
