const OFFER_BRAND = "Sweepstakes Hub";

export type OfferPlayer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  parentAgentId: string | null;
  suspended: boolean;
  banned: boolean;
  emailPromotions: boolean;
  smsMarketing: boolean;
};

export type OfferScope = {
  all: boolean;
  parentIds: string[];
};

export function keptParent(current: string | null | undefined, nextId: string | null) {
  if (current) return current;
  return nextId;
}

export function assignedParent(
  owners: { code: string; userId: string; active: boolean }[],
  code: string,
  currentParent: string | null
) {
  if (currentParent) return currentParent;
  const match = owners.find(
    (owner) => owner.active && owner.code.toLowerCase() === code.trim().toLowerCase()
  );
  return match?.userId ?? null;
}

export function signupReady(terms: boolean, offers: boolean) {
  return terms === true && offers === true;
}

export function playersInScope(players: OfferPlayer[], scope: OfferScope) {
  if (scope.all) return players;
  const parents = new Set(scope.parentIds);
  return players.filter((player) => player.parentAgentId != null && parents.has(player.parentAgentId));
}

function canContact(player: OfferPlayer) {
  return !player.suspended && !player.banned;
}

export function emailRecipients(players: OfferPlayer[]) {
  return players.filter(
    (player) => canContact(player) && player.emailPromotions === true && Boolean(player.email?.trim())
  );
}

export function smsRecipients(players: OfferPlayer[]) {
  return players.filter(
    (player) => canContact(player) && player.smsMarketing === true && Boolean(player.phone?.trim())
  );
}

export function claimOnce(sent: Set<string>, userId: string, channel: "email" | "sms", day: string) {
  const key = `${userId}:${channel}:${day}`;
  if (sent.has(key)) return false;
  sent.add(key);
  return true;
}

export function formatOfferSms(body: string) {
  const text = body.trim();
  const withBrand = text.toLowerCase().startsWith(OFFER_BRAND.toLowerCase()) ? text : `${OFFER_BRAND}: ${text}`;
  return withBrand.endsWith("Reply STOP to opt out.") ? withBrand : `${withBrand} Reply STOP to opt out.`;
}

export function formatOfferEmail(input: { name: string; body: string; unsubscribeUrl: string }) {
  const name = input.name.trim() || "there";
  return `Hi ${name},\n\n${input.body.trim()}\n\nUnsubscribe: ${input.unsubscribeUrl}`;
}

export function isStopMessage(body: string) {
  return /^(stop|stopall|unsubscribe|cancel|end|quit)$/i.test(body.trim());
}

export type OfferDelivery = {
  email: { id: string; to: string; text: string }[];
  sms: { id: string; to: string; text: string }[];
};

/** One send. A second call the same day adds nothing. Signup does not call this. */
export function deliverOffer(input: {
  players: OfferPlayer[];
  scope: OfferScope;
  day: string;
  sent: Set<string>;
  subject: string;
  emailBody: string;
  smsBody: string;
  unsubscribeUrl: (userId: string) => string;
}): OfferDelivery {
  const visible = playersInScope(input.players, input.scope);
  const email: OfferDelivery["email"] = [];
  const sms: OfferDelivery["sms"] = [];
  for (const player of emailRecipients(visible)) {
    if (!claimOnce(input.sent, player.id, "email", input.day)) continue;
    email.push({
      id: player.id,
      to: player.email || "",
      text: formatOfferEmail({
        name: player.name,
        body: input.emailBody,
        unsubscribeUrl: input.unsubscribeUrl(player.id),
      }),
    });
  }
  for (const player of smsRecipients(visible)) {
    if (!claimOnce(input.sent, player.id, "sms", input.day)) continue;
    sms.push({
      id: player.id,
      to: player.phone || "",
      text: formatOfferSms(input.smsBody),
    });
  }
  return { email, sms };
}
