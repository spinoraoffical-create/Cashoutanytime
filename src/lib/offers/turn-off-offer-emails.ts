import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { validUnsubscribeToken } from "@/lib/offers/tokens";

export async function turnOffOfferEmails(userId: string, token: string) {
  const secret = process.env.OFFER_LINK_SECRET || process.env.RESEND_API_KEY || "";
  if (!validUnsubscribeToken(userId, token, secret)) return false;
  const admin = createAdminClient();
  if (!admin) return false;
  const { error } = await admin.from("notification_preferences").upsert(
    { user_id: userId, email_promotions: false },
    { onConflict: "user_id" }
  );
  return !error;
}
