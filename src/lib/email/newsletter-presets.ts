import { SITE_URL } from "@/lib/constants";

import type { SimpleNewsletterInput } from "@/lib/email/newsletter-form";
import type { NewsletterVibe } from "@/lib/email/newsletter-templates";

export type NewsletterPreset = {
  id: string;
  label: string;
  description: string;
  vibe: NewsletterVibe;
  values: Omit<SimpleNewsletterInput, "segment" | "name" | "vibe">;
};

const PROMO = `${SITE_URL}/promotions`;
const DEPOSIT = `${SITE_URL}/dashboard/deposit`;
const SPIN = `${SITE_URL}/spin`;
const VIP = `${SITE_URL}/dashboard/vip`;
const REFERRALS = `${SITE_URL}/dashboard/referrals`;
const LEADERBOARD = `${SITE_URL}/leaderboard`;
const GAMES = `${SITE_URL}/games/juwa`;

/** Ready-made casino promo templates — pick one, tweak if needed, send. */
export const NEWSLETTER_PRESETS: NewsletterPreset[] = [
  {
    id: "welcome-50",
    label: "50% welcome bonus",
    description: "Jackpot-style first deposit offer",
    vibe: "jackpot",
    values: {
      template_id: "welcome-50",
      subject: "JACKPOT: 50% bonus on your first deposit at Spinora",
      eyebrow: "New player exclusive",
      heading: "Double your first deposit — 50% extra credits",
      subhead: "All 12 games. Zero codes. Instant wallet credit.",
      message:
        "Your welcome bonus is locked and loaded. New Spinora players get <strong>50% extra</strong> on their first deposit — Fire Kirin, Juwa, Game Vault and the full lineup included.<br><br>Fund once, load any game, and you're in the action within minutes.",
      cta_label: "Claim 50% bonus",
      cta_href: DEPOSIT,
      stat1_value: "50%",
      stat1_label: "Bonus",
      stat2_value: "12",
      stat2_label: "Games",
      stat3_value: "2 min",
      stat3_label: "Credit time",
    },
  },
  {
    id: "reload-weekend",
    label: "Weekend reload bonus",
    description: "Hot weekend deposit boost",
    vibe: "fire",
    values: {
      template_id: "reload-weekend",
      subject: "Weekend heat: reload bonus on every deposit",
      eyebrow: "Weekend special",
      heading: "Stack credits all weekend long",
      subhead: "VIP tiers unlock up to 15% reload — automatically.",
      message:
        "The weekend table is open. Every deposit earns a <strong>reload bonus</strong> stacked on your usual credits — higher VIP tiers get a bigger cut, no forms to fill.<br><br>Load up and hit your favorite fish table or slot before the weekend closes.",
      cta_label: "Reload & play",
      cta_href: DEPOSIT,
      stat1_value: "15%",
      stat1_label: "Max reload",
      stat2_value: "VIP",
      stat2_label: "Tier boost",
      stat3_value: "Instant",
      stat3_label: "Credit",
    },
  },
  {
    id: "happy-hour",
    label: "Happy hour +20%",
    description: "Urgent limited-time fire promo",
    vibe: "fire",
    values: {
      template_id: "happy-hour",
      subject: "HAPPY HOUR LIVE: +20% on every deposit right now",
      eyebrow: "Limited time only",
      heading: "Happy hour is ON — grab +20% extra",
      subhead: "Every deposit boosted for the next few hours only.",
      message:
        "Clock's ticking. For a short window, <strong>every Spinora deposit</strong> gets an extra 20% on top of your normal bonus.<br><br>Fire Kirin, Juwa, Orion Stars — load credits now and ride the happy hour wave.",
      cta_label: "Grab +20% now",
      cta_href: DEPOSIT,
      stat1_value: "+20%",
      stat1_label: "Extra",
      stat2_value: "HOT",
      stat2_label: "Limited",
      stat3_value: "12",
      stat3_label: "Games",
    },
  },
  {
    id: "daily-spin",
    label: "Free daily spin",
    description: "Daily wheel reminder",
    vibe: "jackpot",
    values: {
      template_id: "daily-spin",
      subject: "Your FREE spin is waiting — don't miss today's prize",
      eyebrow: "Daily jackpot wheel",
      heading: "Spin free. Win coins & XP.",
      subhead: "One free spin every 24 hours — resets at midnight.",
      message:
        "Today's free spin is sitting on the wheel waiting for you. Land <strong>bonus coins, XP boosts</strong> and more — completely free.<br><br>Log in before midnight to keep your streak alive.",
      cta_label: "Spin the wheel",
      cta_href: SPIN,
      stat1_value: "FREE",
      stat1_label: "Daily spin",
      stat2_value: "24h",
      stat2_label: "Reset",
      stat3_value: "WIN",
      stat3_label: "Prizes",
    },
  },
  {
    id: "refer-friends",
    label: "Refer & earn",
    description: "Referral rewards push",
    vibe: "jackpot",
    values: {
      template_id: "refer-friends",
      subject: "Invite friends — unlimited bonus credits for both of you",
      eyebrow: "Referral rewards",
      heading: "Your crew earns you real credits",
      subhead: "Unlimited invites. Both players win on first deposit.",
      message:
        "Share your personal link — when a friend signs up and deposits, <strong>you both get bonus credits</strong> automatically. No codes, no cap on invites.<br><br>Your referral link is ready in the dashboard.",
      cta_label: "Get referral link",
      cta_href: REFERRALS,
      stat1_value: "2×",
      stat1_label: "Both win",
      stat2_value: "∞",
      stat2_label: "Invites",
      stat3_value: "Auto",
      stat3_label: "Payout",
    },
  },
  {
    id: "vip-climb",
    label: "VIP tier boost",
    description: "Luxury VIP progression promo",
    vibe: "vip",
    values: {
      template_id: "vip-climb",
      subject: "VIP alert: you're closer to the next tier",
      eyebrow: "VIP lounge",
      heading: "Level up. Multiply every win.",
      subhead: "Silver → Elite. Up to 2× coin rewards at the top.",
      message:
        "Every claim and deposit pushes you toward the next VIP tier. Higher tiers mean <strong>bigger multipliers, fatter reload bonuses</strong> and priority support.<br><br>Check your progress — your next tier might be closer than you think.",
      cta_label: "View VIP status",
      cta_href: VIP,
      stat1_value: "2×",
      stat1_label: "Elite mult",
      stat2_value: "5",
      stat2_label: "VIP tiers",
      stat3_value: "24/7",
      stat3_label: "Concierge",
    },
  },
  {
    id: "trending-juwa",
    label: "Juwa trending",
    description: "Hot game spotlight",
    vibe: "fire",
    values: {
      template_id: "trending-juwa",
      subject: "Juwa is ON FIRE — #1 played game this week",
      eyebrow: "Hot game alert",
      heading: "Juwa is dominating the floor",
      subhead: "Chain combos. Boss battles. Non-stop action.",
      message:
        "Juwa is the hottest game on Spinora right now. One-click account setup, instant wallet load, and you're in the middle of the action.<br><br>Your reload bonus applies on every deposit — stack credits and go.",
      cta_label: "Play Juwa now",
      cta_href: GAMES,
      stat1_value: "#1",
      stat1_label: "Trending",
      stat2_value: "1-tap",
      stat2_label: "Setup",
      stat3_value: "Fish",
      stat3_label: "Table",
    },
  },
  {
    id: "leaderboard",
    label: "Leaderboard prizes",
    description: "Competition / prize pool promo",
    vibe: "jackpot",
    values: {
      template_id: "leaderboard",
      subject: "Leaderboard prizes live — climb the ranks, win credits",
      eyebrow: "Prize pool live",
      heading: "Top players get paid this week",
      subhead: "Bonus credits for the leaderboard elite.",
      message:
        "The weekly leaderboard is heating up. Every coin you earn moves you up the ranks — <strong>top spots take home bonus credits</strong> when the week closes.<br><br>Check your position and make your move before time runs out.",
      cta_label: "Climb the board",
      cta_href: LEADERBOARD,
      stat1_value: "TOP",
      stat1_label: "10 paid",
      stat2_value: "7",
      stat2_label: "Days left",
      stat3_value: "LIVE",
      stat3_label: "Now",
    },
  },
  {
    id: "win-back",
    label: "We miss you",
    description: "Win-back / return player promo",
    vibe: "fire",
    values: {
      template_id: "win-back",
      subject: "Your seat is saved — reload bonus waiting inside",
      eyebrow: "Come back & play",
      heading: "The table's still yours",
      subhead: "VIP progress saved. Reload bonus on your next deposit.",
      message:
        "We've been holding your spot. Log back in this week — your <strong>VIP progress is exactly where you left it</strong>, and a reload bonus kicks in on your next deposit.<br><br>Fire Kirin, Juwa and all 12 games are ready when you are.",
      cta_label: "Return & claim bonus",
      cta_href: PROMO,
      stat1_value: "VIP",
      stat1_label: "Saved",
      stat2_value: "Reload",
      stat2_label: "Bonus",
      stat3_value: "12",
      stat3_label: "Games",
    },
  },
  {
    id: "custom",
    label: "Blank — write your own",
    description: "Start from scratch",
    vibe: "gold",
    values: {
      template_id: "custom",
      subject: "",
      eyebrow: "Spinora exclusive",
      heading: "",
      subhead: "",
      message: "",
      cta_label: "Play now",
      cta_href: PROMO,
      stat1_value: "",
      stat1_label: "",
      stat2_value: "",
      stat2_label: "",
      stat3_value: "",
      stat3_label: "",
    },
  },
];

export function getNewsletterPreset(id: string): NewsletterPreset | undefined {
  return NEWSLETTER_PRESETS.find((p) => p.id === id);
}

export function presetToSimpleForm(
  presetId: string,
  segment: "all" | "test" = "test"
): SimpleNewsletterInput {
  const preset = getNewsletterPreset(presetId) ?? NEWSLETTER_PRESETS[0];
  return {
    ...preset.values,
    vibe: preset.vibe,
    name: preset.label,
    segment,
  };
}

export function emptySimpleForm(segment: "all" | "test" = "test"): SimpleNewsletterInput {
  return presetToSimpleForm("welcome-50", segment);
}
