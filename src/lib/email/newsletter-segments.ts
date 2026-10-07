import type { NewsletterCampaignSegment } from "@/lib/database.types";

/** Audiences a campaign can target. Suspended players and promo opt-outs are removed later. */
export const NEWSLETTER_SEGMENTS = [
  "new_signups",
  "never_deposited",
  "deposited_7d",
  "deposited_14d",
  "deposited_30d",
  "inactive_7_14",
  "vip",
  "all",
  "test",
] as const satisfies readonly NewsletterCampaignSegment[];

export type NewsletterSegmentId = (typeof NEWSLETTER_SEGMENTS)[number];

const SEGMENT_SET = new Set<string>(NEWSLETTER_SEGMENTS);

export function isNewsletterSegment(value: string): value is NewsletterSegmentId {
  return SEGMENT_SET.has(value);
}

export type AudienceCounts = {
  eligible: number;
  optedOut: number;
  suspended: number;
  noEmail: number;
};

export const NEWSLETTER_SEGMENT_META: Record<
  NewsletterSegmentId,
  { label: string; hint: string; cadence: string }
> = {
  new_signups: {
    label: "New signups (last 48 hours)",
    hint: "Accounts created in the last two days.",
    cadence: "One welcome. Do not send this again tomorrow.",
  },
  never_deposited: {
    label: "Registered, never deposited",
    hint: "Has an account and no completed deposit.",
    cadence: "One reminder is enough.",
  },
  deposited_7d: {
    label: "Deposited in the last 7 days",
    hint: "Completed a deposit this week.",
    cadence: "A single reload note, not a daily send.",
  },
  deposited_14d: {
    label: "Deposited in the last 14 days",
    hint: "Completed a deposit in the last two weeks.",
    cadence: "At most once in this window.",
  },
  deposited_30d: {
    label: "Deposited in the last 30 days",
    hint: "Completed a deposit this month.",
    cadence: "A monthly note, not a drip.",
  },
  inactive_7_14: {
    label: "Inactive 7–14 days",
    hint: "Last seen between 7 and 14 days ago.",
    cadence: "One win-back while they are in this window.",
  },
  vip: {
    label: "VIP tiers only",
    hint: "Silver and above, or a VIP record in CRM.",
    cadence: "Occasional exclusive notes.",
  },
  all: {
    label: "All opted-in players",
    hint: "Everyone with an account who still accepts offer email.",
    cadence: "Rare announcements only.",
  },
  test: {
    label: "Test list (your email only)",
    hint: "Legacy audience. Prefer Test send so the draft stays editable.",
    cadence: "Does not email players.",
  },
};

export function newsletterSegmentLabel(segment: string): string {
  if (isNewsletterSegment(segment)) return NEWSLETTER_SEGMENT_META[segment].label;
  return "All opted-in players";
}

export type SegmentPerson = {
  createdAt: number | null;
  lastSeenAt: number | null;
  depositedAt: number | null;
  vip: boolean;
};

const DAY_MS = 86_400_000;

export function segmentNeedsDeposits(segment: NewsletterSegmentId): boolean {
  return (
    segment === "never_deposited" ||
    segment === "deposited_7d" ||
    segment === "deposited_14d" ||
    segment === "deposited_30d"
  );
}

export function segmentNeedsProfileActivity(segment: NewsletterSegmentId): boolean {
  return segment === "new_signups" || segment === "inactive_7_14";
}

/** True when the player belongs in the segment before opt-out and suspension filters. */
export function matchesNewsletterSegment(
  segment: NewsletterSegmentId,
  person: SegmentPerson,
  now: number
): boolean {
  switch (segment) {
    case "test":
      return false;
    case "all":
      return true;
    case "new_signups":
      return person.createdAt != null && person.createdAt >= now - 2 * DAY_MS;
    case "never_deposited":
      return person.depositedAt == null;
    case "deposited_7d":
      return person.depositedAt != null && person.depositedAt >= now - 7 * DAY_MS;
    case "deposited_14d":
      return person.depositedAt != null && person.depositedAt >= now - 14 * DAY_MS;
    case "deposited_30d":
      return person.depositedAt != null && person.depositedAt >= now - 30 * DAY_MS;
    case "inactive_7_14": {
      const seen = person.lastSeenAt ?? person.createdAt;
      if (seen == null) return false;
      return seen < now - 7 * DAY_MS && seen >= now - 14 * DAY_MS;
    }
    case "vip":
      return person.vip;
    default:
      return false;
  }
}

export function emptyAudienceCounts(): AudienceCounts {
  return { eligible: 0, optedOut: 0, suspended: 0, noEmail: 0 };
}
