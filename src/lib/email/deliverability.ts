import "server-only";

import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { unsubscribeToken } from "@/lib/offers/tokens";

/** Plain-text fallback — major factor for inbox placement vs spam. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const PROMO_REPLY_TO =
  process.env.RESEND_REPLY_TO ?? "support@spinoracasinos.com";

const SETTINGS_URL = `${SITE_URL}/dashboard/notifications`;

function offerLinkSecret() {
  return process.env.OFFER_LINK_SECRET || process.env.RESEND_API_KEY || "";
}

/** One address per player. Mail providers POST here to unsubscribe in one click. */
export function promoUnsubscribeUrl(userId: string) {
  const secret = offerLinkSecret();
  if (!secret) return SETTINGS_URL;
  return `${SITE_URL}/api/email/unsubscribe/${userId}/${unsubscribeToken(userId, secret)}`;
}

export function promoEmailHeaders(unsubscribeUrl?: string): Record<string, string> {
  const url = unsubscribeUrl || SETTINGS_URL;
  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${url}>, <mailto:${PROMO_REPLY_TO}?subject=unsubscribe>`,
  };
  if (url.includes("/api/email/unsubscribe/")) {
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  return headers;
}

export function promoEmailFooterPlain(): string {
  return `\n\n—\n${SITE_NAME}\n${SITE_URL}\n\nYou're receiving this because you asked for email notices. Manage email preferences: ${SETTINGS_URL}`;
}
