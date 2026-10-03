/**
 * Spinora marketing/newsletter emails — promo campaigns via Resend.
 */

import { SITE_NAME, SITE_URL } from "@/lib/constants";

const BG = "#050505";
const SURFACE = "#111111";
const CARD = "#181818";
const GOLD = "#f5c542";
const GOLD_BRIGHT = "#ffe082";
const GOLD_DEEP = "#c8860a";
const ORANGE = "#f97316";
const ORANGE_DEEP = "#c2410c";
const EMERALD = "#34d399";
const RUBY = "#f87171";
const TEXT = "#fafafa";
const MUTED = "#b0aaa0";
const BORDER = "rgba(255,255,255,0.1)";
const GOLD_GLOW = "rgba(245, 197, 66, 0.35)";

interface Stat {
  value: string;
  label: string;
}

interface NewsletterOpts {
  eyebrow: string;
  heading: string;
  subhead: string;
  body: string;
  stats?: Stat[];
  cta: { label: string; href: string };
  promoCode?: string;
  /** Visual accent — auto-matched from promo vibe */
  vibe?: "gold" | "fire" | "vip" | "jackpot";
}

function vibeColors(vibe: NewsletterOpts["vibe"]) {
  switch (vibe) {
    case "fire":
      return {
        accent: ORANGE,
        accentBright: "#fb923c",
        accentDeep: ORANGE_DEEP,
        heroTop: "#2a1206",
        heroBottom: "#141010",
        badgeBg: "rgba(249,115,22,0.18)",
        badgeText: "#fdba74",
      };
    case "vip":
      return {
        accent: "#a78bfa",
        accentBright: "#c4b5fd",
        accentDeep: "#7c3aed",
        heroTop: "#1a1030",
        heroBottom: "#100e18",
        badgeBg: "rgba(167,139,250,0.18)",
        badgeText: "#ddd6fe",
      };
    case "jackpot":
      return {
        accent: EMERALD,
        accentBright: "#6ee7b7",
        accentDeep: "#059669",
        heroTop: "#061a12",
        heroBottom: "#0e1410",
        badgeBg: "rgba(52,211,153,0.18)",
        badgeText: "#a7f3d0",
      };
    default:
      return {
        accent: GOLD,
        accentBright: GOLD_BRIGHT,
        accentDeep: GOLD_DEEP,
        heroTop: "#221808",
        heroBottom: "#141010",
        badgeBg: "rgba(245, 197, 66, 0.16)",
        badgeText: GOLD_BRIGHT,
      };
  }
}

function statChip(s: Stat, accent: string, accentBright: string) {
  return `<td width="33%" align="center" style="padding:0 4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:2px solid ${accent};border-radius:16px;">
      <tr><td align="center" style="padding:14px 6px 4px;">
        <p style="margin:0;font-size:26px;line-height:1;font-weight:900;color:${accentBright};font-family:Georgia,'Times New Roman',serif;">${s.value}</p>
      </td></tr>
      <tr><td align="center" style="padding:0 8px 12px;">
        <p style="margin:0;font-size:9px;font-weight:800;color:${MUTED};text-transform:uppercase;letter-spacing:0.12em;">${s.label}</p>
      </td></tr>
    </table>
  </td>`;
}

function newsletterShell(opts: NewsletterOpts) {
  const preheader = opts.subhead || opts.heading;
  const v = vibeColors(opts.vibe);

  const statsRow = opts.stats?.length
    ? `<tr><td style="padding:0 24px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>${opts.stats.map((s) => statChip(s, v.accent, v.accentBright)).join("")}</tr>
        </table>
      </td></tr>`
    : "";

  const promoRow = opts.promoCode
    ? `<tr><td style="padding:0 24px 20px;" align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" style="border:2px dashed ${v.accent};border-radius:12px;background:${CARD};">
          <tr><td style="padding:12px 28px;">
            <p style="margin:0 0 4px;font-size:10px;font-weight:800;color:${MUTED};text-transform:uppercase;letter-spacing:0.14em;">Promo code</p>
            <p style="margin:0;font-size:22px;font-weight:900;color:${v.accentBright};letter-spacing:0.18em;font-family:Georgia,'Times New Roman',serif;">${opts.promoCode}</p>
          </td></tr>
        </table>
      </td></tr>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
  </head>
  <body style="margin:0;padding:0;background:${BG};color:${TEXT};font-family:'Helvetica Neue',Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:${SURFACE};border:1px solid ${BORDER};border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.6);">
          <!-- Gold top strip -->
          <tr><td style="height:5px;background:linear-gradient(90deg,${v.accentDeep},${v.accentBright},${ORANGE},${v.accentBright},${v.accentDeep});font-size:0;line-height:0;">&nbsp;</td></tr>
          <!-- Logo bar -->
          <tr><td style="padding:20px 24px 0;background:linear-gradient(180deg,${v.heroTop},${SURFACE});">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:22px;font-weight:900;letter-spacing:0.06em;color:${v.accentBright};font-family:Georgia,'Times New Roman',serif;">♠ ${SITE_NAME.toUpperCase()} ♠</p>
                </td>
                <td align="right" style="font-size:18px;color:${v.accent};letter-spacing:4px;">✦ ✦ ✦</td>
              </tr>
            </table>
          </td></tr>
          <!-- Hero -->
          <tr><td style="padding:16px 24px 20px;background:linear-gradient(180deg,${v.heroTop},${v.heroBottom});">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${GOLD_GLOW};border-radius:16px;">
              <tr><td style="padding:20px 20px 16px;">
                <p style="margin:0 0 12px;display:inline-block;background:${v.badgeBg};color:${v.badgeText};font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;padding:6px 14px;border-radius:999px;border:1px solid ${v.accent};">${opts.eyebrow}</p>
                <h1 style="margin:0 0 10px;font-size:30px;line-height:1.1;font-weight:900;color:${TEXT};font-family:Georgia,'Times New Roman',serif;">${opts.heading}</h1>
                <p style="margin:0;font-size:16px;line-height:1.45;color:${MUTED};">${opts.subhead}</p>
              </td></tr>
            </table>
          </td></tr>
          ${statsRow}
          <!-- Body -->
          <tr><td style="padding:0 24px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid ${v.accent};background:${CARD};border-radius:0 12px 12px 0;">
              <tr><td style="padding:16px 18px;">
                <div style="font-size:15px;line-height:1.65;color:#d4d0c8;">${opts.body}</div>
              </td></tr>
            </table>
          </td></tr>
          ${promoRow}
          <!-- CTA -->
          <tr><td style="padding:4px 24px 28px;" align="center">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="border-radius:999px;background:linear-gradient(135deg,${v.accentBright},${v.accentDeep});box-shadow:0 6px 28px ${GOLD_GLOW};">
                <a href="${opts.cta.href}" style="display:inline-block;color:#1a0f00;font-weight:900;text-decoration:none;padding:18px 40px;border-radius:999px;font-size:15px;text-transform:uppercase;letter-spacing:0.08em;border:2px solid ${v.accentBright};">${opts.cta.label} →</a>
              </td></tr>
            </table>
            <p style="margin:14px 0 0;font-size:11px;color:${MUTED};">Instant credit · 12 games · 24/7 support</p>
          </td></tr>
          <!-- Footer -->
          <tr><td style="padding:20px 24px;border-top:1px solid ${BORDER};background:${BG};">
            <p style="margin:0;font-size:11px;line-height:1.5;color:${MUTED};">You're receiving this because you have a ${SITE_NAME} account. <a href="${SITE_URL}/dashboard/settings" style="color:${v.accentBright};">Manage email preferences</a> · reply "unsubscribe" to opt out.</p>
          </td></tr>
        </table>
        <p style="margin:14px 0 0;font-size:10px;color:#666;">© ${new Date().getFullYear()} ${SITE_NAME} · Play responsibly · ${SITE_URL.replace(/^https?:\/\//, "")}</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function welcomeBonusNewsletter(opts: { siteUrl: string }) {
  return {
    subject: "Your $2 or $3 Free Play is waiting (eligible players)",
    html: newsletterShell({
      eyebrow: "New Member Offer — USA Players",
      heading: "Free Play is here.",
      subhead: "Claim your $2 or $3 Free Play, plus a 20% deposit bonus.",
      stats: [
        { value: "$2-3", label: "Free Play" },
        { value: "20%", label: "Deposit Bonus" },
        { value: "24/7", label: "Support" },
      ],
      body: "Eligible players get Free Play credited straight to their account, and every deposit on top earns a 20% bonus. Instant credit, fast cashouts, no catches.",
      cta: { label: "Claim Free Play", href: `${opts.siteUrl}/deposit` },
    }),
  };
}

export function happyHourNewsletter(opts: { siteUrl: string }) {
  return {
    subject: "Happy Hour: +20% extra on deposit, right now",
    html: newsletterShell({
      eyebrow: "Happy Hour — Limited Time",
      heading: "Happy Hour is on.",
      subhead: "Deposit now and get 20% extra, on top of your usual bonus.",
      stats: [
        { value: "+20%", label: "Extra On Deposit" },
        { value: "Ltd", label: "Time Only" },
        { value: "Instant", label: "Credit" },
      ],
      body: "For a limited time, every deposit gets an extra 20% on top — your favorite games are waiting. Load up before Happy Hour ends.",
      cta: { label: "Deposit Now", href: `${opts.siteUrl}/deposit` },
    }),
  };
}

export function vipClimbNewsletter(opts: { siteUrl: string; tierName: string }) {
  return {
    subject: `${opts.tierName} VIP is closer than you think`,
    html: newsletterShell({
      eyebrow: "VIP Progression",
      heading: `${opts.tierName} unlocks richer rewards.`,
      subhead: "Your next tier is one good session away.",
      stats: [
        { value: "1.1x-2x", label: "Reward Mult" },
        { value: "5", label: "Tiers" },
        { value: "1", label: "Concierge" },
      ],
      body: "Every coin you earn pushes you toward your next VIP tier — reward multipliers scale up to 2x at the top tier, plus priority support along the way. Check your progress and see exactly what's left to unlock.",
      cta: { label: "View VIP Progress", href: `${opts.siteUrl}/dashboard/vip` },
    }),
  };
}

export function referralBoostNewsletter(opts: { siteUrl: string }) {
  return {
    subject: "Invite friends, earn 40% referral rewards",
    html: newsletterShell({
      eyebrow: "Referral Program",
      heading: "Your friends are worth real coins.",
      subhead: "Invite friends and earn 40% referral rewards — the more friends, the more rewards.",
      stats: [
        { value: "40%", label: "Referral Reward" },
        { value: "∞", label: "Unlimited Invites" },
        { value: "Instant", label: "Credit" },
      ],
      body: "Every friend who signs up with your code and qualifies earns you 40% in referral rewards — no limit on how many. Your personal link is ready whenever you are.",
      cta: { label: "Get My Referral Link", href: `${opts.siteUrl}/dashboard/referrals` },
    }),
  };
}

export function trendingGameNewsletter(opts: { siteUrl: string; gameName: string; gameSlug: string }) {
  return {
    subject: `${opts.gameName} is trending right now`,
    html: newsletterShell({
      eyebrow: "Player Favorite",
      heading: `${opts.gameName} is trending right now.`,
      subhead: "Check out what other players can't stop playing.",
      stats: [
        { value: "Hot", label: "Right Now" },
        { value: "20%", label: "Deposit Bonus" },
        { value: "24/7", label: "Support" },
      ],
      body: `${opts.gameName} is one of today's most-played titles. Load credits and get your 20% deposit bonus while you're at it.`,
      cta: { label: "Play It Now", href: `${opts.siteUrl}/games/${opts.gameSlug}` },
    }),
  };
}

export function leaderboardPrizeNewsletter(opts: { siteUrl: string; prizePool: string }) {
  return {
    subject: `${opts.prizePool} leaderboard prize pool is live`,
    html: newsletterShell({
      eyebrow: "Weekly Leaderboard",
      heading: `${opts.prizePool} up for grabs this week.`,
      subhead: "Climb the board, bank the prize.",
      stats: [
        { value: "Top 10", label: "Paid Out" },
        { value: "7 Days", label: "Duration" },
        { value: "Live", label: "Rankings" },
      ],
      body: "The weekly leaderboard resets every Monday and the prize pool is bigger than ever. Every coin you earn counts toward your rank — check where you stand right now.",
      cta: { label: "View Leaderboard", href: `${opts.siteUrl}/leaderboard` },
    }),
  };
}

export function depositLoyaltyNewsletter(opts: { siteUrl: string }) {
  return {
    subject: "Deposit 5 times, get 1 Free Play",
    html: newsletterShell({
      eyebrow: "Loyalty Reward",
      heading: "Stack your deposits, stack your wins.",
      subhead: "Deposit 5 times and get 1 Free Play on the house.",
      stats: [
        { value: "5", label: "Deposits" },
        { value: "1", label: "Free Play" },
        { value: "20%", label: "Deposit Bonus" },
      ],
      body: "Every deposit already earns a 20% bonus — hit 5 deposits and we add a Free Play on top, automatically. No forms, no tracking required.",
      cta: { label: "View My Wallet", href: `${opts.siteUrl}/dashboard/wallet` },
    }),
  };
}

export function birthdayRewardNewsletter(opts: { siteUrl: string; displayName: string }) {
  return {
    subject: `Happy birthday, ${opts.displayName} — a gift is waiting`,
    html: newsletterShell({
      eyebrow: "Birthday Reward",
      heading: `Happy birthday, ${opts.displayName}.`,
      subhead: "A gift from the whole WinSweeps table.",
      stats: [
        { value: "🎁", label: "Bonus" },
        { value: "7 Days", label: "To Claim" },
        { value: "You", label: "Guest of Honor" },
      ],
      body: "We don't let birthdays pass quietly. Your reward is sitting in the vault, ready whenever you are — claim it before the week's out.",
      cta: { label: "Claim Birthday Gift", href: `${opts.siteUrl}/dashboard/rewards` },
    }),
  };
}

export function winBackNewsletter(opts: { siteUrl: string; displayName: string }) {
  return {
    subject: "We kept your seat warm",
    html: newsletterShell({
      eyebrow: "We Miss You",
      heading: `Come back, ${opts.displayName} — the table's still yours.`,
      subhead: "Happy Hour is on: +20% extra on your next deposit.",
      stats: [
        { value: "+20%", label: "Happy Hour Extra" },
        { value: "Ltd", label: "Time Only" },
        { value: "0", label: "Strings Attached" },
      ],
      body: "Your streak's paused, not gone. Log back in this week and Happy Hour adds 20% extra to your next deposit — plus your VIP progress is exactly where you left it.",
      cta: { label: "Reclaim My Bonus", href: `${opts.siteUrl}/deposit` },
    }),
  };
}

export function seasonalHolidayNewsletter(opts: { siteUrl: string; seasonName: string }) {
  return {
    subject: `${opts.seasonName}: $2/$3 Free Play + 20% deposit bonus`,
    html: newsletterShell({
      eyebrow: `${opts.seasonName} Event`,
      heading: `${opts.seasonName} rewards are live.`,
      subhead: "Free Play plus a deposit bonus, for a limited time.",
      stats: [
        { value: "$2-3", label: "Free Play" },
        { value: "20%", label: "Deposit Bonus" },
        { value: "Ltd", label: "Time Only" },
      ],
      body: `To mark ${opts.seasonName}, eligible players get Free Play credited to their account, plus the usual 20% deposit bonus on top. Once the event ends, so does the offer.`,
      cta: { label: "Join The Event", href: `${opts.siteUrl}/promotions` },
    }),
  };
}

export type NewsletterVibe = "gold" | "fire" | "vip" | "jackpot";

export function inferNewsletterVibe(fields: {
  subject?: string;
  eyebrow?: string;
  heading?: string;
  template_id?: string;
}): NewsletterVibe {
  const id = fields.template_id ?? "";
  if (id === "vip-climb") return "vip";
  if (id === "happy-hour" || id === "reload-weekend" || id === "trending-juwa" || id === "win-back")
    return "fire";
  if (
    id === "daily-spin" ||
    id === "leaderboard" ||
    id === "refer-friends" ||
    id === "welcome-50"
  )
    return "jackpot";

  const text = `${fields.subject ?? ""} ${fields.eyebrow ?? ""} ${fields.heading ?? ""}`.toLowerCase();
  if (text.includes("vip") || text.includes("elite") || text.includes("platinum")) return "vip";
  if (
    text.includes("happy") ||
    text.includes("weekend") ||
    text.includes("hot") ||
    text.includes("juwa") ||
    text.includes("fire") ||
    text.includes("come back")
  )
    return "fire";
  if (
    text.includes("spin") ||
    text.includes("leaderboard") ||
    text.includes("refer") ||
    text.includes("welcome") ||
    text.includes("bonus")
  )
    return "jackpot";
  return "gold";
}

/**
 * Renders a fully admin-authored campaign (subject + all shell fields
 * supplied at call time) — used by the admin Newsletters section.
 */
export function customCampaignEmail(opts: {
  subject: string;
  eyebrow: string;
  heading: string;
  subhead: string;
  body: string;
  stats?: Stat[];
  cta: { label: string; href: string };
  vibe?: NewsletterVibe;
  template_id?: string;
}) {
  const vibe = opts.vibe ?? inferNewsletterVibe(opts);
  return {
    subject: opts.subject,
    html: newsletterShell({
      eyebrow: opts.eyebrow,
      heading: opts.heading,
      subhead: opts.subhead,
      body: opts.body,
      stats: opts.stats,
      cta: opts.cta,
      vibe,
    }),
  };
}
