export const BROADCAST_SEGMENTS = [
  "all",
  "vip_silver_up",
  "vip_gold_up",
  "vip_platinum_up",
  "vip_diamond_up",
  "vip_elite",
] as const;

export type BroadcastSegmentName = (typeof BROADCAST_SEGMENTS)[number];

const SEGMENT_RANK: Record<BroadcastSegmentName, number> = {
  all: 0,
  vip_silver_up: 1,
  vip_gold_up: 2,
  vip_platinum_up: 3,
  vip_diamond_up: 4,
  vip_elite: 5,
};

const PROFILE_TIER_RANK: Record<string, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
  diamond: 4,
  elite: 5,
};

export type BroadcastCandidate = {
  userId: string;
  suspended: boolean;
  announcements: boolean | null;
  vipRank: number;
  parentAgentId: string | null;
};

export type BroadcastAudienceScope = {
  level: "platform" | "store" | "sub";
  parentIds: string[];
};

export function segmentMinRank(segment: string): number | null {
  if (!Object.hasOwn(SEGMENT_RANK, segment)) return null;
  return SEGMENT_RANK[segment as BroadcastSegmentName];
}

/** VIP rank from vip_status when present, otherwise the profile tier label. */
export function resolveVipRank(statusRank: number | null, profileTier: string | null): number {
  if (statusRank != null && Number.isFinite(statusRank)) return statusRank;
  const key = (profileTier ?? "").trim().toLowerCase();
  return PROFILE_TIER_RANK[key] ?? 0;
}

export function selectBroadcastRecipients(
  candidates: BroadcastCandidate[],
  segment: string,
  scope: BroadcastAudienceScope | null
): { recipients: string[]; error: string | null } {
  const minRank = segmentMinRank(segment);
  if (minRank == null) return { recipients: [], error: "Choose a valid audience." };
  if (scope && scope.level !== "platform" && scope.parentIds.length === 0) {
    return { recipients: [], error: "This store has no players in its audience. Nothing was sent." };
  }
  const parents = scope && scope.level !== "platform" ? new Set(scope.parentIds) : null;
  const recipients = candidates
    .filter((person) => !person.suspended)
    .filter((person) => person.announcements === true)
    .filter((person) => person.vipRank >= minRank)
    .filter((person) => (parents ? person.parentAgentId != null && parents.has(person.parentAgentId) : true))
    .map((person) => person.userId);
  return { recipients: [...new Set(recipients)], error: null };
}

export function safeBroadcastDiagnostic(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .slice(0, 180);
}

export type BroadcastDraft = {
  id: string;
  actorId: string;
  title: string;
  body: string;
  linkUrl: string | null;
  segment: BroadcastSegmentName;
};

export type StoredBroadcast = BroadcastDraft & {
  recipientIds: string[];
};

export type BroadcastWriteError = { code?: string; message: string };

export type BroadcastRepository = {
  get(id: string): Promise<StoredBroadcast | null>;
  create(record: StoredBroadcast): Promise<BroadcastWriteError | null>;
  addRecipients(id: string, userIds: string[]): Promise<BroadcastWriteError | null>;
  finish(id: string, total: number): Promise<BroadcastWriteError | null>;
};

export type BroadcastRunResult =
  | { ok: true; id: string; added: number; total: number; message: string }
  | { ok: false; error: string };

function sameNotice(left: BroadcastDraft, right: BroadcastDraft) {
  return (
    left.actorId === right.actorId &&
    left.title === right.title &&
    left.body === right.body &&
    left.linkUrl === right.linkUrl &&
    left.segment === right.segment
  );
}

export async function executeBroadcast(input: {
  permitted: boolean;
  draft: BroadcastDraft;
  candidates: BroadcastCandidate[];
  audienceComplete: boolean;
  scope: BroadcastAudienceScope | null;
  repo: BroadcastRepository;
}): Promise<BroadcastRunResult> {
  if (!input.permitted) {
    return { ok: false, error: "You don't have permission to send this notice." };
  }
  if (!input.audienceComplete) {
    return { ok: false, error: "The member list could not be loaded completely. Nothing was sent." };
  }

  const selected = selectBroadcastRecipients(input.candidates, input.draft.segment, input.scope);
  if (selected.error) return { ok: false, error: selected.error };

  let existing = await input.repo.get(input.draft.id);
  if (existing && !sameNotice(existing, input.draft)) {
    return { ok: false, error: "This send was already used for a different notice. Refresh the page before trying again." };
  }
  if (!existing) {
    const created = await input.repo.create({ ...input.draft, recipientIds: [] });
    if (created && created.code !== "23505") {
      return { ok: false, error: publicBroadcastError(created.code, created.message) };
    }
    existing = await input.repo.get(input.draft.id);
    if (!existing || !sameNotice(existing, input.draft)) {
      return { ok: false, error: "The notice was not saved. Press send again." };
    }
  }

  const already = new Set(existing.recipientIds);
  const pending = selected.recipients.filter((userId) => !already.has(userId));
  const total = already.size + pending.length;
  if (pending.length > 0) {
    const added = await input.repo.addRecipients(input.draft.id, pending);
    if (added) return { ok: false, error: publicBroadcastError(added.code, added.message) };
  }
  const finished = await input.repo.finish(input.draft.id, total);
  if (finished) return { ok: false, error: publicBroadcastError(finished.code, finished.message) };
  const message =
    total === 0
      ? "Saved. No eligible members matched this audience, so nobody was notified."
      : pending.length === 0
        ? `Already sent to ${total.toLocaleString()} eligible members. No duplicate was added.`
        : `Notice saved for ${total.toLocaleString()} eligible members.`;
  return { ok: true, id: input.draft.id, added: pending.length, total, message };
}

export function publicBroadcastError(code: string | undefined, message: string): string {
  const text = message.toLowerCase();
  if (code === "42501" || text.includes("row-level security") || text.includes("permission denied") || text.includes("forbidden")) {
    return "You don't have permission to save this notice. Nothing was sent.";
  }
  if (
    code === "42703" ||
    code === "PGRST202" ||
    code === "PGRST204" ||
    text.includes("send_broadcast") ||
    text.includes("is_banned") ||
    text.includes("does not exist") ||
    text.includes("schema cache")
  ) {
    return "The notice could not be saved because the database function is missing or out of date. Nothing new was sent.";
  }
  if (code === "23503") {
    return "One recipient account is no longer available. Press send again to finish the people who were not notified.";
  }
  return "The notice could not be saved. Press send again. People who already received it will not get a duplicate.";
}
