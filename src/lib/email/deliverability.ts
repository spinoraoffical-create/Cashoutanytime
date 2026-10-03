import "server-only";

import { SITE_NAME, SITE_URL } from "@/lib/constants";

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

const SETTINGS_URL = `${SITE_URL}/dashboard/settings`;

export function promoEmailHeaders(): Record<string, string> {
  return {
    "List-Unsubscribe": `<${SETTINGS_URL}>, <mailto:${PROMO_REPLY_TO}?subject=unsubscribe>`,
    "X-Entity-Ref-ID": "spinora-promo",
  };
}

export function promoEmailFooterPlain(): string {
  return `\n\n—\n${SITE_NAME}\n${SITE_URL}\n\nYou're receiving this because you have a ${SITE_NAME} account. Manage email preferences: ${SETTINGS_URL}`;
}
