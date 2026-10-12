import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { adminDb } from "@/lib/actions/admin/core";
import {
  htmlToPlainText,
  promoEmailFooterPlain,
  promoEmailHeaders,
  promoUnsubscribeUrl,
  PROMO_REPLY_TO,
} from "@/lib/email/deliverability";
import { promoEmailBlockReason } from "@/lib/email/newsletter-consent";
import { customCampaignEmail } from "@/lib/email/newsletter-templates";
import { FROM, getResend } from "@/lib/email/resend";

const BATCH_SIZE = 100;
const SEND_DELAY_MS = 130;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type CampaignStat = { value: string; label: string };

export type CampaignContent = {
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

export function buildCampaignEmail(campaign: CampaignContent) {
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

async function blockReasonNow(db: SupabaseClient, userId: string): Promise<string | null> {
  const prefs = await db
    .from("notification_preferences")
    .select("email_promotions")
    .eq("user_id", userId)
    .maybeSingle();

  let accountError = false;
  let hasAccount = false;
  let suspended: boolean | null = null;
  let banned: boolean | null = null;

  const profile = await db
    .from("profiles")
    .select("is_suspended, is_banned")
    .eq("id", userId)
    .maybeSingle();

  if (profile.error) {
    const bannedOnly = await db.from("profiles").select("is_banned").eq("id", userId).maybeSingle();
    if (bannedOnly.error) {
      accountError = true;
    } else if (!bannedOnly.data) {
      hasAccount = false;
    } else {
      hasAccount = true;
      banned = bannedOnly.data.is_banned === true;
      suspended = false;
    }
  } else if (!profile.data) {
    hasAccount = false;
  } else {
    hasAccount = true;
    suspended = profile.data.is_suspended === true;
    banned = profile.data.is_banned === true;
  }

  return promoEmailBlockReason({
    prefsError: Boolean(prefs.error),
    hasPrefs: Boolean(prefs.data),
    emailPromotions: prefs.data?.email_promotions,
    accountError,
    hasAccount,
    suspended,
    banned,
  });
}

/**
 * Sends up to `limit` pending recipients. Only the cron route and
 * scheduleNewsletterCampaignAction call this. Each row is claimed by moving
 * it off `pending` before Resend is called, so a second worker cannot send it.
 * Opted-out, suspended, and banned rows stay off `pending`.
 */
export async function processCampaignBatch(campaignId: string, limit = BATCH_SIZE) {
  const admin = adminDb();
  const resend = getResend();
  if (!resend) {
    await admin.from("newsletter_campaigns").update({ status: "failed" }).eq("id", campaignId);
    await admin
      .from("newsletter_campaign_recipients")
      .update({ status: "failed", error: "RESEND_API_KEY is not configured in env." })
      .eq("campaign_id", campaignId)
      .eq("status", "pending");
    return { sent: 0, failed: 0, skipped: 0, remaining: -1 };
  }

  const { data: campaign } = await admin
    .from("newsletter_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) return { sent: 0, failed: 0, skipped: 0, remaining: 0 };

  if (campaign.status === "scheduled") {
    await admin.from("newsletter_campaigns").update({ status: "sending" }).eq("id", campaignId);
  }

  const { data: pending } = await admin
    .from("newsletter_campaign_recipients")
    .select("id, email, user_id")
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .limit(limit);

  if (!pending || pending.length === 0) {
    await admin
      .from("newsletter_campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", campaignId);
    return { sent: 0, failed: 0, skipped: 0, remaining: 0 };
  }

  const { subject, html, text } = buildCampaignEmail(campaign);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const recipient of pending) {
    const { data: claimed, error: claimError } = await admin
      .from("newsletter_campaign_recipients")
      .update({ status: "failed", error: "Sending." })
      .eq("id", recipient.id)
      .eq("status", "pending")
      .select("id");

    if (claimError || !claimed?.length) continue;

    const block = await blockReasonNow(admin, recipient.user_id);
    if (block) {
      skipped += 1;
      await admin
        .from("newsletter_campaign_recipients")
        .update({ status: "failed", error: block })
        .eq("id", recipient.id);
      continue;
    }

    const { error } = await resend.emails.send({
      from: FROM,
      to: recipient.email,
      replyTo: PROMO_REPLY_TO,
      subject,
      html,
      text,
      headers: promoEmailHeaders(promoUnsubscribeUrl(recipient.user_id)),
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
        .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
        .eq("id", recipient.id);
    }
    await sleep(SEND_DELAY_MS);
  }

  await admin
    .from("newsletter_campaigns")
    .update({
      sent_count: campaign.sent_count + sent,
      failed_count: campaign.failed_count + failed + skipped,
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

  return { sent, failed, skipped, remaining: stillPending ?? 0 };
}
