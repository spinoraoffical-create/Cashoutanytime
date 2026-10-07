import { SITE_URL } from "@/lib/constants";

import type { SimpleNewsletterInput } from "@/lib/email/newsletter-form";
import type { NewsletterSegmentId } from "@/lib/email/newsletter-segments";
import type { NewsletterVibe } from "@/lib/email/newsletter-templates";

export type NewsletterPreset = {
  id: string;
  label: string;
  description: string;
  vibe: NewsletterVibe;
  suggestedSegment: Exclude<NewsletterSegmentId, "test">;
  values: Omit<SimpleNewsletterInput, "segment" | "name" | "vibe">;
};

const DEPOSIT = `${SITE_URL}/dashboard/deposit`;
const VIP = `${SITE_URL}/dashboard/vip`;
const PROMO = `${SITE_URL}/promotions`;

/**
 * Short lifecycle notes. Pick one, adjust a line if needed, then test-send.
 * Suggested audiences match the moment — avoid using these as daily blasts.
 */
export const NEWSLETTER_PRESETS: NewsletterPreset[] = [
  {
    id: "welcome",
    label: "Welcome",
    description: "One note for people who joined in the last 48 hours",
    vibe: "gold",
    suggestedSegment: "new_signups",
    values: {
      template_id: "welcome",
      subject: "Your Sweepstakes Hub account is ready",
      eyebrow: "Welcome",
      heading: "You're in",
      subhead: "Play when you want. This is the only welcome email.",
      message:
        "Thanks for creating an account. Your wallet is ready whenever you want to play.\n\nOffer emails are easy to turn off in Notification settings.",
      cta_label: "Open my account",
      cta_href: DEPOSIT,
      stat1_value: "1",
      stat1_label: "Welcome",
      stat2_value: "You",
      stat2_label: "Control it",
      stat3_value: "Off",
      stat3_label: "Anytime",
    },
  },
  {
    id: "first-deposit",
    label: "First deposit reminder",
    description: "One nudge for accounts that have never deposited",
    vibe: "gold",
    suggestedSegment: "never_deposited",
    values: {
      template_id: "first-deposit",
      subject: "Your first deposit is still open",
      eyebrow: "When you're ready",
      heading: "No rush",
      subhead: "A completed deposit is what unlocks play. One reminder, then we leave it.",
      message:
        "You have an account and haven't deposited yet. When you want to play, add funds from your wallet and you're set.\n\nIf you'd rather not get offer emails, turn them off in Notification settings.",
      cta_label: "Review deposit",
      cta_href: DEPOSIT,
      stat1_value: "1",
      stat1_label: "Reminder",
      stat2_value: "You",
      stat2_label: "Choose",
      stat3_value: "Off",
      stat3_label: "Anytime",
    },
  },
  {
    id: "reload",
    label: "Reload",
    description: "A single reload note for people who deposited recently",
    vibe: "fire",
    suggestedSegment: "deposited_14d",
    values: {
      template_id: "reload",
      subject: "A reload is available on your next deposit",
      eyebrow: "Recent players",
      heading: "Reload when you want",
      subhead: "For players who deposited in the last two weeks.",
      message:
        "Your last deposit is on file. If you want to add more, the usual reload applies on the next one — nothing to enter.\n\nWe send this occasionally, not every day.",
      cta_label: "Add funds",
      cta_href: DEPOSIT,
      stat1_value: "14d",
      stat1_label: "Window",
      stat2_value: "1",
      stat2_label: "Note",
      stat3_value: "You",
      stat3_label: "Decide",
    },
  },
  {
    id: "win-back",
    label: "Inactive win-back",
    description: "One note for players last seen 7–14 days ago",
    vibe: "gold",
    suggestedSegment: "inactive_7_14",
    values: {
      template_id: "win-back",
      subject: "Your progress is saved",
      eyebrow: "It's been a week",
      heading: "Your place is still here",
      subhead: "VIP progress stays on the account. Come back only if you want to.",
      message:
        "You haven't been in for a little while. Your progress is where you left it.\n\nThis is a single note for this quiet stretch, not a daily reminder.",
      cta_label: "Return to my account",
      cta_href: `${SITE_URL}/dashboard`,
      stat1_value: "Saved",
      stat1_label: "Progress",
      stat2_value: "1",
      stat2_label: "Note",
      stat3_value: "You",
      stat3_label: "Choose",
    },
  },
  {
    id: "vip-exclusive",
    label: "VIP exclusive",
    description: "A short note for VIP tiers only",
    vibe: "vip",
    suggestedSegment: "vip",
    values: {
      template_id: "vip-exclusive",
      subject: "A note for VIP players",
      eyebrow: "VIP",
      heading: "For your tier",
      subhead: "Silver and above. Not sent to the full player list.",
      message:
        "This note is only for players on a VIP tier. Your multiplier and reload rate stay tied to that tier.\n\nCheck your status when you have a minute — there is nothing you need to claim by tonight.",
      cta_label: "View VIP status",
      cta_href: VIP,
      stat1_value: "VIP",
      stat1_label: "Only",
      stat2_value: "You",
      stat2_label: "Tier",
      stat3_value: "Off",
      stat3_label: "Anytime",
    },
  },
  {
    id: "custom",
    label: "Blank — write your own",
    description: "Start from scratch. Prefer a specific audience over everyone.",
    vibe: "gold",
    suggestedSegment: "all",
    values: {
      template_id: "custom",
      subject: "",
      eyebrow: "Sweepstakes Hub",
      heading: "",
      subhead: "",
      message: "",
      cta_label: "Open account",
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
  segment?: NewsletterSegmentId
): SimpleNewsletterInput {
  const preset = getNewsletterPreset(presetId) ?? NEWSLETTER_PRESETS[0];
  return {
    ...preset.values,
    vibe: preset.vibe,
    name: preset.label,
    segment: segment ?? preset.suggestedSegment,
  };
}

export function emptySimpleForm(): SimpleNewsletterInput {
  return presetToSimpleForm("welcome");
}
