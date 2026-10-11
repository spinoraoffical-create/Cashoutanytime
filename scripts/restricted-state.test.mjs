import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isRestrictedPaymentRequest,
  isRestrictedUsRegion,
  restrictedStateCodes,
} from "../src/lib/compliance/restricted-state.ts";

const states = restrictedStateCodes("WA,ID,NV,MI");
assert.equal(isRestrictedUsRegion("US", "WA", states), true);
assert.equal(isRestrictedUsRegion("US", "ID", states), true);
assert.equal(isRestrictedUsRegion("US", "CA", states), false);
assert.equal(isRestrictedUsRegion("US", "NY", states), false);
assert.equal(isRestrictedUsRegion("US", "", states), false);
assert.equal(isRestrictedUsRegion("US", null, states), false);
assert.equal(isRestrictedUsRegion("", "WA", states), false);
assert.equal(isRestrictedUsRegion(null, null, states), false);
assert.equal(isRestrictedUsRegion("CA", "WA", states), false);

function headers(country, region) {
  const values = new Map();
  if (country != null) values.set("x-vercel-ip-country", country);
  if (region != null) values.set("x-vercel-ip-country-region", region);
  return { get: (name) => values.get(name) ?? null };
}

const previous = process.env.RESTRICTED_STATES;
process.env.RESTRICTED_STATES = "WA,ID,NV,MI";
assert.equal(isRestrictedPaymentRequest(headers("US", "NV")), true);
assert.equal(isRestrictedPaymentRequest(headers("US", "TX")), false);
assert.equal(isRestrictedPaymentRequest(headers("US", null)), false);
assert.equal(isRestrictedPaymentRequest(headers(null, null)), false);
assert.equal(isRestrictedPaymentRequest(headers("GB", "WA")), false);
if (previous == null) delete process.env.RESTRICTED_STATES;
else process.env.RESTRICTED_STATES = previous;

const middleware = readFileSync(new URL("../src/middleware.ts", import.meta.url), "utf8");
const create = readFileSync(new URL("../src/app/api/payments/paydora/create/route.ts", import.meta.url), "utf8");
const payout = readFileSync(new URL("../src/app/api/payments/paydora/payout/route.ts", import.meta.url), "utf8");
const webhook = readFileSync(new URL("../src/app/api/payments/paydora/webhook/route.ts", import.meta.url), "utf8");
assert.match(middleware, /isRestrictedUsRegion/);
assert.match(middleware, /pathname = "\/restricted"/);
assert.match(middleware, /api\|_next\/static/);
assert.match(create, /isRestrictedPaymentRequest/);
assert.match(payout, /isRestrictedPaymentRequest/);
assert.equal(webhook.includes("isRestrictedPaymentRequest"), false);
assert.equal(webhook.includes("isRestrictedUsRegion"), false);
assert.match(webhook, /verifyPaydoraSignature/);

console.log("restricted state checks passed");
