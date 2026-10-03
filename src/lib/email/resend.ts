import "server-only";

import { Resend } from "resend";

let client: Resend | null = null;

/** Lazily construct the Resend client so a missing key never breaks builds. */
export function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export const FROM =
  process.env.RESEND_FROM_EMAIL ?? "Spinora <noreply@spinoracasinos.com>";
