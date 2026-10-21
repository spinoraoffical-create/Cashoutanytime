import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MARKETING_FROM,
  resolveMarketingFrom,
} from "../src/lib/email/marketing-from.ts";
import { promoEmailBlockReason, PROMO_SKIP_OFF } from "../src/lib/email/newsletter-consent.ts";

const savedMarketing = process.env.RESEND_MARKETING_FROM_EMAIL;
const savedTransactional = process.env.RESEND_FROM_EMAIL;
delete process.env.RESEND_MARKETING_FROM_EMAIL;
process.env.RESEND_FROM_EMAIL = "Sweepstakes Hub <noreply@sweeptakehub.com>";

const fallback = resolveMarketingFrom();
assert.equal(fallback.ok, true);
assert.equal(fallback.from, MARKETING_FROM);
assert.equal(fallback.from.includes("offers@news.sweeptakehub.com"), true);
assert.equal(fallback.from.includes("noreply@sweeptakehub.com"), false);

const explicit = resolveMarketingFrom("Sweepstakes Hub Offers <offers@news.sweeptakehub.com>");
assert.equal(explicit.ok, true);
assert.equal(explicit.from, MARKETING_FROM);

for (const bad of [
  "Sweepstakes Hub <noreply@sweeptakehub.com>",
  "Sweepstakes Hub Offers <offers@sweeptakehub.com>",
  "offers@news.sweeptakehub.com",
  "Bad <someone@news.example>",
  "Sweepstakes Hub Offers <offers@news.sweeptakehub.com>\nBcc: a@b.c",
]) {
  const refused = resolveMarketingFrom(bad);
  assert.equal(refused.ok, false);
  assert.equal(refused.from, undefined);
}

assert.equal(promoEmailBlockReason({
  prefsError: false,
  hasPrefs: true,
  emailPromotions: false,
  accountError: false,
  hasAccount: true,
  suspended: false,
  banned: null,
}), PROMO_SKIP_OFF);

function read(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const batch = read("../src/lib/email/newsletter-batch.ts");
const testSend = read("../src/lib/actions/admin/newsletters.ts");
const offers = read("../src/lib/offers/send.ts");
const welcome = read("../src/lib/notifications/welcome-mailer.ts");
const transactional = read("../src/lib/email/send.ts");
const resend = read("../src/lib/email/resend.ts");
const support = read("../src/lib/actions/admin/support.ts");

for (const source of [batch, testSend, offers, welcome]) {
  assert.match(source, /resolveMarketingFrom/);
  assert.equal(source.includes("from: FROM"), false);
  assert.equal(source.includes("noreply@sweeptakehub.com"), false);
}

assert.match(batch, /promoEmailHeaders\(promoUnsubscribeUrl/);
assert.match(batch, /\.eq\("status", "pending"\)/);
assert.match(batch, /if \(claimError \|\| !claimed\?\.length\) continue/);
assert.match(offers, /promoEmailHeaders\(promoUnsubscribeUrl/);
assert.match(testSend, /promoEmailHeaders\(promoUnsubscribeUrl/);

assert.match(transactional, /from: FROM/);
assert.equal(transactional.includes("resolveMarketingFrom"), false);
assert.match(resend, /process\.env\.RESEND_FROM_EMAIL/);
assert.equal(resend.includes("news.sweeptakehub.com"), false);
assert.match(support, /channel: "support"/);
assert.equal(support.includes("resolveMarketingFrom"), false);

if (savedMarketing === undefined) delete process.env.RESEND_MARKETING_FROM_EMAIL;
else process.env.RESEND_MARKETING_FROM_EMAIL = savedMarketing;
if (savedTransactional === undefined) delete process.env.RESEND_FROM_EMAIL;
else process.env.RESEND_FROM_EMAIL = savedTransactional;

console.log("marketing from checks passed");
