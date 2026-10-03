import "server-only";

import { FROM, getResend } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";

type EmailChannel =
  | "rewards"
  | "promotions"
  | "vip"
  | "referrals"
  | "support"
  | "announcements";

/**
 * Send a transactional email to a member, gated by their notification
 * preferences. Resolves the auth email via the admin API. Best-effort: never
 * throws into the calling flow.
 */
export async function sendMemberEmail(opts: {
  userId: string;
  channel: EmailChannel;
  subject: string;
  html: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return; // email not configured — skip silently

  try {
    const admin = createAdminClient();
    if (!admin) return;

    // preference check
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select(`email_${opts.channel}`)
      .eq("user_id", opts.userId)
      .maybeSingle();

    const key = `email_${opts.channel}` as keyof typeof prefs;
    if (prefs && prefs[key] === false) return; // opted out

    // resolve email from auth
    const { data: userRes } = await admin.auth.admin.getUserById(opts.userId);
    const email = userRes.user?.email;
    if (!email) return;

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: opts.subject,
      html: opts.html,
    });
  } catch {
    // swallow — email delivery is never critical to the underlying action
  }
}

/** Send to an explicit address (used pre-account, e.g. contact form replies). */
export async function sendRawEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
  } catch {
    /* best-effort */
  }
}
