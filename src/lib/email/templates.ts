/**
 * Branded transactional email templates (inline-styled HTML for client
 * compatibility). WinSweeps dark luxury palette baked in as literals since
 * email clients don't read CSS variables.
 */

const BG = "#060606";
const SURFACE = "#0f1115";
const GOLD = "#f5c542";
const TEXT = "#f4f1ea";
const MUTED = "#a8a29a";
const BORDER = "rgba(255,255,255,0.08)";

function shell(opts: { heading: string; body: string; cta?: { label: string; href: string } }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BG};color:${TEXT};font-family:'Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:${SURFACE};border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
          <tr><td style="padding:32px 32px 0;">
            <p style="margin:0;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${GOLD};">WinSweeps</p>
          </td></tr>
          <tr><td style="padding:24px 32px 8px;">
            <h1 style="margin:0;font-size:24px;font-weight:700;color:${TEXT};">${opts.heading}</h1>
          </td></tr>
          <tr><td style="padding:8px 32px 24px;">
            <div style="font-size:15px;line-height:1.6;color:${MUTED};">${opts.body}</div>
          </td></tr>
          ${
            opts.cta
              ? `<tr><td style="padding:0 32px 32px;">
                  <a href="${opts.cta.href}" style="display:inline-block;background:${GOLD};color:#1a1405;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;">${opts.cta.label}</a>
                </td></tr>`
              : ""
          }
          <tr><td style="padding:24px 32px;border-top:1px solid ${BORDER};">
            <p style="margin:0;font-size:12px;color:${MUTED};">You're receiving this because you have a WinSweeps account. Manage your email preferences in your dashboard settings.</p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:${MUTED};">© ${new Date().getFullYear()} WinSweeps · Immersive Social Gaming Excellence</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function welcomeEmail(opts: { displayName: string; siteUrl: string }) {
  return {
    subject: "Welcome to WinSweeps — your vault is open",
    html: shell({
      heading: `Welcome, ${opts.displayName}.`,
      body: "Your account is verified and your welcome bonus is waiting in the vault. Claim your daily reward, build a streak and climb the VIP tiers.",
      cta: { label: "Enter the Arena", href: `${opts.siteUrl}/dashboard` },
    }),
  };
}

export function rewardClaimedEmail(opts: {
  displayName: string;
  coins: number;
  xp: number;
  siteUrl: string;
}) {
  return {
    subject: "Reward claimed — keep the streak alive",
    html: shell({
      heading: "Nice claim!",
      body: `Hey ${opts.displayName}, you just banked <strong style="color:${GOLD};">${opts.coins.toLocaleString()} coins</strong> and <strong style="color:${GOLD};">${opts.xp.toLocaleString()} XP</strong>. Come back tomorrow to extend your streak.`,
      cta: { label: "View Rewards", href: `${opts.siteUrl}/dashboard/rewards` },
    }),
  };
}

export function vipTierUpEmail(opts: {
  displayName: string;
  tierName: string;
  multiplier: number;
  siteUrl: string;
}) {
  return {
    subject: `You've reached ${opts.tierName} VIP`,
    html: shell({
      heading: `Welcome to ${opts.tierName}.`,
      body: `Congratulations ${opts.displayName} — you've climbed to <strong style="color:${GOLD};">${opts.tierName}</strong>. Every reward you claim now earns a <strong>${opts.multiplier}× multiplier</strong>, plus new tier perks.`,
      cta: { label: "See Your Perks", href: `${opts.siteUrl}/dashboard/vip` },
    }),
  };
}

export function referralQualifiedEmail(opts: {
  displayName: string;
  referredName: string;
  siteUrl: string;
}) {
  return {
    subject: "Your referral qualified — bonus credited",
    html: shell({
      heading: "Referral bonus earned!",
      body: `${opts.referredName} joined through your code and qualified. Your referral bonus has been credited to your vault.`,
      cta: { label: "View Referrals", href: `${opts.siteUrl}/dashboard/referrals` },
    }),
  };
}

export function ticketReplyEmail(opts: {
  displayName: string;
  ticketNo: number;
  subject: string;
  siteUrl: string;
  ticketId: string;
}) {
  return {
    subject: `Re: [#${opts.ticketNo}] ${opts.subject}`,
    html: shell({
      heading: "You have a new reply",
      body: `Our concierge team replied to your ticket <strong>#${opts.ticketNo}</strong> — "${opts.subject}".`,
      cta: {
        label: "View Ticket",
        href: `${opts.siteUrl}/dashboard/support/${opts.ticketId}`,
      },
    }),
  };
}
