import assert from "node:assert/strict";

import { resolveSiteUrl } from "../src/lib/constants.ts";
import {
  PROMO_SKIP_BANNED,
  PROMO_SKIP_MISSING_ACCOUNT,
  PROMO_SKIP_OFF,
  PROMO_SKIP_SUSPENDED,
  PROMO_SKIP_UNKNOWN_ACCOUNT,
  PROMO_SKIP_UNKNOWN_PREFS,
  promoEmailBlockReason,
} from "../src/lib/email/newsletter-consent.ts";

const allowed = {
  prefsError: false,
  hasPrefs: true,
  emailPromotions: true,
  accountError: false,
  hasAccount: true,
  suspended: false,
  banned: false,
};

assert.equal(promoEmailBlockReason(allowed), null);
assert.equal(promoEmailBlockReason({ ...allowed, emailPromotions: false }), PROMO_SKIP_OFF);
assert.equal(promoEmailBlockReason({ ...allowed, emailPromotions: null }), PROMO_SKIP_OFF);
assert.equal(promoEmailBlockReason({ ...allowed, hasPrefs: false }), PROMO_SKIP_OFF);
assert.equal(promoEmailBlockReason({ ...allowed, prefsError: true }), PROMO_SKIP_UNKNOWN_PREFS);
assert.equal(promoEmailBlockReason({ ...allowed, banned: true }), PROMO_SKIP_BANNED);
assert.equal(promoEmailBlockReason({ ...allowed, suspended: true }), PROMO_SKIP_SUSPENDED);
assert.equal(promoEmailBlockReason({ ...allowed, hasAccount: false }), PROMO_SKIP_MISSING_ACCOUNT);
assert.equal(promoEmailBlockReason({ ...allowed, accountError: true }), PROMO_SKIP_UNKNOWN_ACCOUNT);

assert.equal(resolveSiteUrl(undefined), "https://www.sweeptakehub.com");
assert.equal(resolveSiteUrl(""), "https://www.sweeptakehub.com");
assert.equal(resolveSiteUrl("not a url"), "https://www.sweeptakehub.com");
assert.equal(resolveSiteUrl("sweeptakehub.com"), "https://www.sweeptakehub.com");
assert.equal(resolveSiteUrl("https://www.sweeptakehub.com/"), "https://www.sweeptakehub.com");
assert.equal(resolveSiteUrl("https://cashoutanytime.vercel.app"), "https://cashoutanytime.vercel.app");
assert.equal(resolveSiteUrl("http://localhost:3000"), "http://localhost:3000");

const batch = await import("node:fs/promises").then((fs) =>
  fs.readFile(new URL("../src/lib/email/newsletter-batch.ts", import.meta.url), "utf8")
);
const actions = await import("node:fs/promises").then((fs) =>
  fs.readFile(new URL("../src/lib/actions/admin/newsletters.ts", import.meta.url), "utf8")
);
const cron = await import("node:fs/promises").then((fs) =>
  fs.readFile(new URL("../src/app/api/cron/newsletter-send/route.ts", import.meta.url), "utf8")
);

assert.match(batch, /email_promotions/);
assert.match(batch, /status: "failed", error: block/);
assert.doesNotMatch(batch, /status: "pending"/);
assert.doesNotMatch(actions, /export async function processCampaignBatch/);
assert.match(actions, /from "@\/lib\/email\/newsletter-batch"/);
assert.match(cron, /verifyCronRequest/);
assert.match(cron, /from "@\/lib\/email\/newsletter-batch"/);
assert.doesNotMatch(cron, /from "@\/lib\/actions\/admin\/newsletters"/);

console.log("newsletter consent checks passed");
