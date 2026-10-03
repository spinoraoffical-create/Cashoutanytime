export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Free Zero-Cost Email Follow-Up Sender
 * Uses standard Fetch API to integrate with free Resend API (3,000 free emails/mo) or custom Webhook.
 */
export async function sendFreePlayerEmail({ to, subject, html }: EmailOptions): Promise<{ ok: boolean; error?: string }> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.log(`[FreeMailer Local Mode] Sent follow-up email to ${to}: "${subject}"`);
      return { ok: true };
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Spinora Royale VIP <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return { ok: false, error: errJson.message || "Failed to send via Resend" };
    }

    return { ok: true };
  } catch (err: any) {
    console.error("[FreeMailer Error]", err.message);
    return { ok: false, error: err.message };
  }
}

/** Pre-built 1-Click Marketing Email Templates */
export function getWelcomeEmailTemplate(playerName: string): string {
  return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #121212; color: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #eba030;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h1 style="color: #eba030; margin: 0; font-size: 24px;">👑 SPINORA ROYALE VIP</h1>
    <p style="color: #10b981; font-weight: bold; margin-top: 4px; font-size: 12px; letter-spacing: 2px;">EXCLUSIVE PLAYER WELCOME</p>
  </div>

  <p style="font-size: 16px;">Hello <strong>${playerName}</strong>,</p>
  
  <p>Welcome to <strong>Spinora Royale VIP</strong>! Your new player account has been activated.</p>

  <div style="background-color: #1e1e1e; padding: 16px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #eba030;">
    <h3 style="color: #eba030; margin-top: 0;">🎁 YOUR SIGN-UP BONUS MATCH IS READY</h3>
    <p style="margin: 0; font-size: 14px;">Use promo code <strong>ROYALE100</strong> on your dashboard to claim your 100% Deposit Match + Free Daily Wheel Spin!</p>
  </div>

  <div style="text-align: center; margin: 28px 0;">
    <a href="http://localhost:3001/dashboard" style="background-color: #eba030; color: #000000; text-decoration: none; font-weight: bold; padding: 14px 28px; border-radius: 10px; display: inline-block;">
      Claim $100 Bonus & Play Now →
    </a>
  </div>

  <hr style="border: none; border-top: 1px solid #333333; margin: 20px 0;" />
  <p style="font-size: 12px; color: #888888; text-align: center;">Need help? Contact 24/7 Live Support on your Spinora Dashboard.</p>
</div>
  `.trim();
}

export function getDailySpinReminderTemplate(playerName: string): string {
  return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #121212; color: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #10b981;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h1 style="color: #10b981; margin: 0; font-size: 24px;">🎡 YOUR DAILY SPIN IS READY!</h1>
  </div>

  <p style="font-size: 16px;">Hey <strong>${playerName}</strong>,</p>
  
  <p>Your free 24-hour Wheel of Fortune spin has refreshed on <strong>Spinora Royale VIP</strong>!</p>

  <div style="text-align: center; margin: 28px 0;">
    <a href="http://localhost:3001/spin" style="background-color: #10b981; color: #000000; text-decoration: none; font-weight: bold; padding: 14px 28px; border-radius: 10px; display: inline-block;">
      Spin Bonus Wheel Free Now →
    </a>
  </div>
</div>
  `.trim();
}
