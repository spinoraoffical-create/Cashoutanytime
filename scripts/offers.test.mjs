import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assignedParent,
  claimOnce,
  deliverOffer,
  formatOfferEmail,
  formatOfferSms,
  isStopMessage,
  keptParent,
  signupReady,
} from "../src/lib/offers/audience.ts";
import { unsubscribeToken, validUnsubscribeToken } from "../src/lib/offers/tokens.ts";

const teamA = "agent-a";
const teamB = "agent-b";
const owners = [
  { code: "TEAM-A", userId: teamA, active: true },
  { code: "TEAM-B", userId: teamB, active: true },
];

assert.equal(assignedParent(owners, "TEAM-A", null), teamA);
assert.equal(assignedParent(owners, "TEAM-B", teamA), teamA);
assert.equal(keptParent(teamA, teamB), teamA);

assert.equal(signupReady(true, false), false);
assert.equal(signupReady(false, true), false);
assert.equal(signupReady(true, true), true);

const player = {
  id: "player-1",
  name: "Ava",
  email: "ava@example.com",
  phone: "+12025550123",
  parentAgentId: teamA,
  suspended: false,
  banned: false,
  emailPromotions: true,
  smsMarketing: true,
};
const other = { ...player, id: "player-2", email: "other@example.com", phone: "+12025550124", parentAgentId: teamB };
const sent = new Set();
const day = "2026-10-08";
const secret = "test-secret";
const first = deliverOffer({
  players: [player, other],
  scope: { all: false, parentIds: [teamA] },
  day,
  sent,
  subject: "Bonus",
  emailBody: "Come back tonight.",
  smsBody: "Bonus is live",
  unsubscribeUrl: (id) => `https://example.com/unsubscribe/${id}/${unsubscribeToken(id, secret)}`,
});

assert.equal(first.email.length, 1);
assert.equal(first.sms.length, 1);
assert.equal(first.email[0].to, "ava@example.com");
assert.match(first.email[0].text, /Hi Ava/);
assert.match(first.email[0].text, /Unsubscribe:/);
assert.match(first.sms[0].text, /^Sweepstakes Hub:/);
assert.match(first.sms[0].text, /Reply STOP to opt out\.$/);
assert.equal(first.sms.some((row) => row.to === other.phone), false);

const replay = deliverOffer({
  players: [player, other],
  scope: { all: false, parentIds: [teamA] },
  day,
  sent,
  subject: "Bonus",
  emailBody: "Come back tonight.",
  smsBody: "Bonus is live",
  unsubscribeUrl: (id) => `https://example.com/unsubscribe/${id}`,
});
assert.equal(replay.email.length, 0);
assert.equal(replay.sms.length, 0);

player.emailPromotions = false;
const nextDay = new Set();
const afterUnsubscribe = deliverOffer({
  players: [player],
  scope: { all: true, parentIds: [] },
  day: "2026-10-09",
  sent: nextDay,
  subject: "Bonus",
  emailBody: "Again",
  smsBody: "Again",
  unsubscribeUrl: () => "https://example.com/unsubscribe",
});
assert.equal(afterUnsubscribe.email.length, 0);
assert.equal(afterUnsubscribe.sms.length, 1);

player.smsMarketing = false;
assert.equal(isStopMessage("STOP"), true);
const afterStop = deliverOffer({
  players: [player],
  scope: { all: true, parentIds: [] },
  day: "2026-10-10",
  sent: new Set(),
  subject: "Bonus",
  emailBody: "Again",
  smsBody: "Again",
  unsubscribeUrl: () => "https://example.com/unsubscribe",
});
assert.equal(afterStop.sms.length, 0);

const banned = { ...player, id: "banned", emailPromotions: true, smsMarketing: true, banned: true, parentAgentId: teamA };
const bannedSend = deliverOffer({
  players: [banned],
  scope: { all: true, parentIds: [] },
  day: "2026-10-10",
  sent: new Set(),
  subject: "Bonus",
  emailBody: "Again",
  smsBody: "Again",
  unsubscribeUrl: () => "https://example.com/unsubscribe",
});
assert.equal(bannedSend.email.length, 0);
assert.equal(bannedSend.sms.length, 0);

const token = unsubscribeToken("player-1", secret);
assert.equal(validUnsubscribeToken("player-1", token, secret), true);
assert.equal(validUnsubscribeToken("player-1", token, "other"), false);
assert.match(formatOfferEmail({ name: "Ava", body: "Hello", unsubscribeUrl: "https://example.com/u" }), /Hi Ava/);
assert.match(formatOfferSms("Hello"), /Reply STOP to opt out/);
assert.equal(claimOnce(new Set(["player-1:email:2026-10-08"]), "player-1", "email", "2026-10-08"), false);

const form = readFileSync(new URL("../src/components/auth/email-auth-form.tsx", import.meta.url), "utf8");
const auth = readFileSync(new URL("../src/lib/actions/auth.ts", import.meta.url), "utf8");
const signupPage = readFileSync(new URL("../src/app/(auth)/r/[code]/page.tsx", import.meta.url), "utf8");
assert.match(form, /I agree to receive bonus offers and promotions by email and SMS\. I can unsubscribe or reply STOP later\./);
assert.match(form, /disabled=\{mode === "register" \? !signupReady\(acceptedTerms, acceptedOffers\) \|\| loading : loading\}/);
assert.match(form, /Sign Up/);
assert.equal(form.includes("sendOffer"), false);
assert.equal(form.includes("getResend"), false);
assert.equal(auth.includes("sendOffer"), false);
assert.equal(auth.includes("getResend"), false);
assert.match(auth, /email_promotions: true/);
assert.match(auth, /sms_marketing: true/);
assert.match(auth, /offersConsent !== true/);
const constants = readFileSync(new URL("../src/lib/constants.ts", import.meta.url), "utf8");
assert.match(constants, /export const SITE_NAME = "Sweepstakes Hub"/);
assert.match(signupPage, /agentCode/);
assert.match(signupPage, /EmailAuthForm/);

const prefs = readFileSync(new URL("../src/lib/actions/account-prefs.ts", import.meta.url), "utf8");
assert.equal(prefs.includes("email_promotions: true"), false);
assert.equal(prefs.includes("sms_marketing: true"), false);

const sql = readFileSync(new URL("../supabase/migrations/20261008000170_signup_offers.sql", import.meta.url), "utf8");
assert.match(sql, /referred_by, role\)/);
assert.match(sql, /'customer'/);
assert.equal(/insert into public\.user_roles/i.test(sql), false);
assert.match(sql, /unique \(user_id, channel, sent_on\)/);

console.log("offer checks passed");
