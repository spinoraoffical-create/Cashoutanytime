import "server-only";

import { adminDb, writeAudit } from "@/lib/actions/admin/core";
import { getAgentScope } from "@/lib/agents/scope";
import { SITE_URL } from "@/lib/constants";
import { getStaffContext } from "@/lib/data/admin";
import { FROM, getResend } from "@/lib/email/resend";
import {
  emailRecipients,
  formatOfferEmail,
  formatOfferSms,
  playersInScope,
  smsRecipients,
  type OfferPlayer,
  type OfferScope,
} from "@/lib/offers/audience";
import { unsubscribeToken } from "@/lib/offers/tokens";

export async function offerScopeForCurrentUser(): Promise<OfferScope | null> {
  const ctx = await getStaffContext();
  if (!ctx) return null;
  if (ctx.isSuperAdmin) return { all: true, parentIds: [] };
  const scope = await getAgentScope();
  if (scope?.level === "sub") return { all: false, parentIds: [scope.userId] };
  if (scope?.level === "store") return { all: false, parentIds: scope.parentIds };
  return null;
}

function offerSecret() {
  const secret = process.env.OFFER_LINK_SECRET || process.env.RESEND_API_KEY || "";
  if (!secret) throw new Error("Offer links need OFFER_LINK_SECRET or RESEND_API_KEY.");
  return secret;
}

export async function loadScopedPlayers(scope: OfferScope): Promise<OfferPlayer[]> {
  const db = adminDb();
  let query = db
    .from("profiles")
    .select("id, full_name, email, phone, parent_agent_id, is_suspended, is_banned");
  if (!scope.all) {
    if (scope.parentIds.length === 0) return [];
    query = query.in("parent_agent_id", scope.parentIds);
  }
  const { data, error } = await query.limit(5000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    parent_agent_id: string | null;
    is_suspended: boolean | null;
    is_banned: boolean | null;
  }[];
  if (rows.length === 0) return [];

  const { data: prefs, error: prefError } = await db
    .from("notification_preferences")
    .select("user_id, email_promotions, sms_marketing")
    .in(
      "user_id",
      rows.map((row) => row.id)
    );
  if (prefError) throw new Error(prefError.message);
  const consent = new Map(
    ((prefs ?? []) as { user_id: string; email_promotions: boolean | null; sms_marketing: boolean | null }[]).map(
      (row) => [row.user_id, row]
    )
  );

  return playersInScope(
    rows.map((row) => {
      const pref = consent.get(row.id);
      return {
        id: row.id,
        name: row.full_name?.trim() || "there",
        email: row.email,
        phone: row.phone,
        parentAgentId: row.parent_agent_id,
        suspended: row.is_suspended === true,
        banned: row.is_banned === true,
        emailPromotions: pref?.email_promotions === true,
        smsMarketing: pref?.sms_marketing === true,
      };
    }),
    scope
  );
}

export async function countOfferAudience(scope: OfferScope) {
  const players = await loadScopedPlayers(scope);
  return {
    email: emailRecipients(players).length,
    sms: smsRecipients(players).length,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID || "";
  const token = process.env.TWILIO_AUTH_TOKEN || "";
  const from = process.env.TWILIO_FROM_NUMBER || "";
  if (!sid || !token || !from) return false;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  return res.ok;
}

export async function sendScopedOffer(input: { subject: string; emailBody: string; smsBody: string }) {
  const ctx = await getStaffContext();
  const scope = await offerScopeForCurrentUser();
  if (!ctx || !scope) return { ok: false as const, error: "You can't send offers." };

  const subject = input.subject.trim();
  const emailBody = input.emailBody.trim();
  const smsBody = input.smsBody.trim();
  if (!subject || !emailBody || !smsBody) {
    return { ok: false as const, error: "Enter a subject, an email, and a short SMS." };
  }

  const resend = getResend();
  if (!resend) return { ok: false as const, error: "RESEND_API_KEY is not configured." };

  const players = await loadScopedPlayers(scope);
  const day = new Date().toISOString().slice(0, 10);
  const db = adminDb();
  const { data: offer, error: offerError } = await db
    .from("offer_sends")
    .insert({
      actor_id: ctx.userId,
      title: subject,
      email_count: 0,
      sms_count: 0,
    })
    .select("id")
    .single();
  if (offerError || !offer) {
    return {
      ok: false as const,
      error: "Apply supabase/migrations/20261008000170_signup_offers.sql before sending offers.",
    };
  }

  const offerId = (offer as { id: string }).id;
  let emailCount = 0;
  let smsCount = 0;
  const secret = offerSecret();
  const smsReady = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER
  );

  for (const player of emailRecipients(players)) {
    const claim = await db.from("offer_deliveries").insert({
      user_id: player.id,
      channel: "email",
      sent_on: day,
      offer_id: offerId,
    });
    if (claim.error) continue;
    const unsubscribeUrl = `${SITE_URL}/unsubscribe/${player.id}/${unsubscribeToken(player.id, secret)}`;
    const text = formatOfferEmail({ name: player.name, body: emailBody, unsubscribeUrl });
    const html = text
      .split("\n")
      .map((line) => `<p>${escapeHtml(line) || "&nbsp;"}</p>`)
      .join("");
    const { error } = await resend.emails.send({
      from: FROM,
      to: player.email || "",
      subject,
      text,
      html,
    });
    if (error) {
      await db.from("offer_deliveries").delete().eq("user_id", player.id).eq("channel", "email").eq("sent_on", day);
      continue;
    }
    emailCount += 1;
  }

  if (smsReady) {
    for (const player of smsRecipients(players)) {
      const claim = await db.from("offer_deliveries").insert({
        user_id: player.id,
        channel: "sms",
        sent_on: day,
        offer_id: offerId,
      });
      if (claim.error) continue;
      const sent = await sendSms(player.phone || "", formatOfferSms(smsBody));
      if (!sent) {
        await db.from("offer_deliveries").delete().eq("user_id", player.id).eq("channel", "sms").eq("sent_on", day);
        continue;
      }
      smsCount += 1;
    }
  }

  const sentAt = new Date().toISOString();
  await db.from("offer_sends").update({ email_count: emailCount, sms_count: smsCount, sent_at: sentAt }).eq("id", offerId);
  await writeAudit({
    actorId: ctx.userId,
    action: "offer.send",
    entityType: "offer",
    entityId: offerId,
    after: { title: subject, emailCount, smsCount, sentAt },
  });

  return { ok: true as const, emailCount, smsCount, smsReady };
}
