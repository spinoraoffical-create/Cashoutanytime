/** Promotional mail only. Transactional mail keeps RESEND_FROM_EMAIL. */
export const MARKETING_FROM_ADDRESS = "offers@news.sweeptakehub.com";
export const MARKETING_FROM =
  "Sweepstakes Hub Offers <offers@news.sweeptakehub.com>";

const NAMED_ADDRESS = /^(.*)<\s*([^<>\s]+)\s*>$/;

/**
 * The verified marketing address is the default.
 * An explicit override is accepted only for that same address.
 * Any other value refuses the send instead of using the transactional sender.
 */
export function resolveMarketingFrom(raw?: string | null): { ok: true; from: string } | { ok: false; error: string } {
  const value = (raw === undefined ? process.env.RESEND_MARKETING_FROM_EMAIL : raw) ?? "";
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, from: MARKETING_FROM };

  const match = NAMED_ADDRESS.exec(trimmed);
  const email = match?.[2]?.trim().toLowerCase();
  const name = match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  if (!match || email !== MARKETING_FROM_ADDRESS || !name || /[\r\n]/.test(trimmed)) {
    return {
      ok: false,
      error: "Promotional email can only be sent from offers@news.sweeptakehub.com. No message was sent.",
    };
  }
  return { ok: true, from: `${name} <${MARKETING_FROM_ADDRESS}>` };
}
